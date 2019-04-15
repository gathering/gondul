#!/usr/bin/perl
use strict;
use warnings;
use DBI;
use POSIX;
#use Time::HiRes qw(time);
use lib '/opt/gondul/include';
use FixedSNMP; 
use SNMP;
use Data::Dumper;
use nms qw(convert_mac convert_decimal);
use IO::Socket::IP;
use Scalar::Util qw(looks_like_number);
use Time::HiRes qw(time);

use Try::Tiny;

SNMP::initMib();
SNMP::addMibDirs("/opt/gondul/data/mibs/StandardMibs");
SNMP::addMibDirs("/opt/gondul/data/mibs/JuniperMibs");
SNMP::addMibDirs("/opt/gondul/data/mibs/CiscoMibs");
SNMP::loadModules('ALL');

our $dbh = nms::db_connect();
$dbh->{AutoCommit} = 0;
$dbh->{RaiseError} = 1;

my $influx = nms::influx_connect();
my $qualification = <<"EOF";
(last_updated IS NULL OR now() - last_updated > poll_frequency)
AND (locked='f' OR now() - last_updated > '15 minutes'::interval)
AND (mgmt_v4_addr is not null or mgmt_v6_addr is not null) AND deleted = false
EOF

# Borrowed from snmpfetch.pl
our $qswitch = $dbh->prepare(<<"EOF")
SELECT
  sysname,switch,host(mgmt_v6_addr) as ip2,host(mgmt_v4_addr) as ip,community,
  DATE_TRUNC('second', now() - last_updated - poll_frequency) AS overdue
FROM
  switches
WHERE
$qualification
ORDER BY
  overdue DESC
LIMIT ?
EOF
	or die "Couldn't prepare qswitch";
our $qlock = $dbh->prepare("UPDATE switches SET locked='t', last_updated=now() WHERE switch=?")
	or die "Couldn't prepare qlock";
our $qunlock = $dbh->prepare("UPDATE switches SET locked='f', last_updated=now() WHERE switch=?")
	or die "Couldn't prepare qunlock";
my @switches = ();

my $sth = $dbh->prepare("INSERT INTO snmp (switch,data) VALUES((select switch from switches where sysname=?), ?)");

sub mylog
{
	my $msg = shift;
	my $time = POSIX::ctime(time);
	$time =~ s/\n.*$//;
	printf STDERR "[%s] %s\n", $time, $msg;
}

sub populate_switches
{
	@switches = ();
	my $limit = $nms::config::snmp_max;
	$qswitch->execute($limit)
		or die "Couldn't get switch";
	$dbh->commit;
	while (my $ref = $qswitch->fetchrow_hashref()) {
		my $ip;
		$ip = $ref->{'ip'};
		if (!defined($ip) or $ip eq "") {
			$ip = 'udp6:[' . $ref->{'ip2'} . ']';
		}
		push @switches, {
			'sysname' => $ref->{'sysname'},
			'id' => $ref->{'switch'},
			'mgtip' => $ip,
			'community' => $ref->{'community'}
		};
	}
}

sub inner_loop
{
	populate_switches();
	my $poll_todo = "";
	for my $refswitch (@switches) {
		my %switch = %{$refswitch};
		$poll_todo .= "$switch{'sysname'} ";

		$switch{'start'} = time;
		$qlock->execute($switch{'id'})
			or die "Couldn't lock switch";
		$dbh->commit;
		my $s = SNMP::Session->new(DestHost => $switch{'mgtip'},
					  Community => $switch{'community'},
					  UseEnums => 1,
					  Version => '2');
		my $ret = $s->bulkwalk(0, 10, @nms::config::snmp_objects, sub{ callback(\%switch, @_); });
		if (!defined($ret)) {
			mylog("Fudge: ".  $s->{'ErrorStr'});
		}
	}
	mylog( "Polling " . @switches . " switches: $poll_todo");
	SNMP::MainLoop(5);
}

sub callback{
	my @top = $_[1];
	my %switch = %{$_[0]};
	my %tree;
	my %ttop;
	my %nics;
	my @nicids;
	my $total = 0;
	my %tree2;
	my @influx_tree = ();

	for my $ret (@top) {
		for my $var (@{$ret}) {
			for my $inner (@{$var}) {
				$total++;
				my ($tag,$type,$name,$iid, $val) = ( $inner->tag ,$inner->type , $inner->name, $inner->iid, $inner->val);
				if ($tag eq "ifPhysAddress" or $tag eq "jnxVirtualChassisMemberMacAddBase") {
					$val = convert_mac($val);
				}
				elsif ($tag eq "ifIndex") {
					push @nicids, $iid;
				}
				elsif ($tag =~ m/^jnxVirtualChassisMember/) {
					$tree2{'vcm'}{$tag}{$iid} = $val;
				}
				elsif ($tag =~ m/^jnxVirtualChassisPort/ ) {
					my ($member,$lol,$interface) = split(/\./,$iid,3);
					my $decoded_if = convert_decimal($interface);
					$tree2{'vcp'}{$tag}{$member}{$decoded_if} = $val;
				}
				elsif($tag eq "dot1dBasePortIfIndex") {
					$val = $inner->iid;
					$iid = $inner->val;
				}
				elsif($tag eq "dot1qTpFdbPort") {
					$iid = substr(mac_dec_to_hex($iid),-17);
				}
				elsif($tag eq "ipNetToMediaPhysAddress") {
					my @ip = split(/\./, $iid);
					$iid = lc $ip[1].".".$ip[2].".".$ip[3].".".$ip[4];
					$val = unpack 'H*', $val;
					$val =~ s/(..)(?=.)/$1:/g;
				}
				elsif($tag eq "ipv6NetToMediaPhysAddress") {
					$val = unpack 'H*', $val;
					$val =~ s/(..)(?=.)/$1:/g;
					my @ip = split(/\./, $iid);
					$iid = sprintf("%X%X:%X%X:%X%X:%X%X:%X%X:%X%X:%X%X:%X%X", @ip[1], @ip[2], @ip[3], @ip[4], @ip[5], @ip[6], @ip[7], @ip[8], @ip[9], @ip[10], @ip[11], @ip[12], @ip[13], @ip[14], @ip[15], @ip[16]);
				}
				$tree{$iid}{$tag} = $val;
			}
		}
	}

	for my $nic (@nicids) {
		$tree2{'ports'}{$tree{$nic}{'ifName'}} = $tree{$nic};
		my $tmp_field = '';
		for my $tmp_key (keys %{$tree{$nic}}) {
				if(looks_like_number($tree{$nic}{$tmp_key})) {
					$tmp_field = $tree{$nic}{$tmp_key};
				} else {
					$tmp_field = '"'.$tree{$nic}{$tmp_key}.'"';
				}
				push (@influx_tree,
                                {
                                        measurement => 'ports',
                                        tags => {
                                                switch =>  $switch{'sysname'},
                                                interface => $tree{$nic}{'ifName'},
                                                },
                                        fields => { $tmp_key => $tmp_field },
                                });
		}

		delete $tree{$nic};
	}

	for my $iid (keys %tree) {
		my $tmp_field = '';
		for my $key (keys %{$tree{$iid}}) {
			$tree2{'misc'}{$key}{$iid} = $tree{$iid}{$key};

				if(looks_like_number($tree{$iid}{$key})) {
                                        $tmp_field = $tree{$iid}{$key};
                                } else {
                                        $tmp_field = '"'.$tree{$iid}{$key}.'"';
                                }

                                push (@influx_tree,
                                {
                                        measurement => 'snmp',
                                        tags => {
                                                switch =>  $switch{'sysname'},
                                                },
                                        fields => { $key => $tmp_field },
                                });
		}
	}
	if ($total > 0) {
		$sth->execute($switch{'sysname'}, JSON::XS::encode_json(\%tree2));
	}
	$qunlock->execute($switch{'id'})
		or die "Couldn't unlock switch";
	$dbh->commit;
	if ($total > 0) {
                push (@influx_tree,
                {
                    measurement => 'snmp',
                    tags => {
                        switch =>  $switch{'sysname'},
                    },
                    fields => { 'execution_time' => (time - $switch{'start'}) },
                });
		try {
			my $cv = AE::cv;
			$influx->write(
				database => $nms::config::influx_database,
				data => [@influx_tree],
				on_success => $cv,
				on_error => sub {
					$cv->croak("Failed to write data: @_");
				}
			);
			$cv->recv;
		} catch {
		        warn "caught error: $_";
		};

                if ((time - $switch{'start'}) > 10) {
                        mylog( "Polled $switch{'sysname'} in " . (time - $switch{'start'}) . "s.");
		}
	} else {
		mylog( "Polled $switch{'sysname'} in " . (time - $switch{'start'}) . "s - no data. Timeout?");
	}
}

sub mac_dec_to_hex{
	my $dec_mac = "@_";
	my @octets;

	foreach my $octet (split('\.', $dec_mac)){
		push(@octets, sprintf("%02x", $octet));
	}
	return join(':', @octets);
}

while (1) {
	inner_loop();
}
