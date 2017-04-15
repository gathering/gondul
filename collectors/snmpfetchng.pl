#!/usr/bin/perl
use strict;
use warnings;
use DBI;
use POSIX;
#use Time::HiRes qw(time);
use SNMP;
use Data::Dumper;
use lib '/opt/gondul/include';
use nms qw(convert_mac convert_decimal);
use IO::Socket::IP;

SNMP::initMib();
SNMP::addMibDirs("/opt/gondul/data/mibs/StandardMibs");
SNMP::addMibDirs("/opt/gondul/data/mibs/JuniperMibs");
SNMP::addMibDirs("/opt/gondul/data/mibs/CiscoMibs");
SNMP::loadModules('ALL');

our $dbh = nms::db_connect();
$dbh->{AutoCommit} = 0;
$dbh->{RaiseError} = 1;

my $qualification = <<"EOF";
(last_updated IS NULL OR now() - last_updated > poll_frequency)
AND (locked='f' OR now() - last_updated > '15 minutes'::interval)
AND (mgmt_v4_addr is not null or mgmt_v6_addr is not null)
EOF

# Borrowed from snmpfetch.pl 
our $qswitch = $dbh->prepare(<<"EOF")
SELECT 
  sysname,switch,host(mgmt_v4_addr) as ip,host(mgmt_v6_addr) as ip2,community,
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

# Hack to avoid starting the collector before graphite is up.
sleep(5);
my $sock = IO::Socket::IP->new(
       PeerHost => "$nms::config::graphite_host:$nms::config::graphite_port",
        Timeout => 20,
       ) or die "Cannot connect to graphite - $@";
 
 $sock->blocking( 0 );

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
	SNMP::MainLoop(6);
}

sub callback{
	my @top = $_[1];
	my %switch = %{$_[0]};
	my %tree;
	my %ttop;
	my %nics;
	my @nicids;
	my $total = 0;
	my $now_graphite = time();
	my %tree2;

	for my $ret (@top) {
		for my $var (@{$ret}) {
			for my $inner (@{$var}) {
				$total++;
				my ($tag,$type,$name,$iid, $val) = ( $inner->tag ,$inner->type , $inner->name, $inner->iid, $inner->val);
				if ($tag eq "ifPhysAddress" or $tag eq "jnxVirtualChassisMemberMacAddBase") {
					$val = convert_mac($val);
				}
				$tree{$iid}{$tag} = $val;
				if ($tag eq "ifIndex") {
					push @nicids, $iid;
				}
				if ($tag =~ m/^jnxVirtualChassisMember/) {
					$tree2{'vcm'}{$tag}{$iid} = $val;
				}
				if ($tag =~ m/^jnxVirtualChassisPort/ ) {
					my ($member,$lol,$interface) = split(/\./,$iid,3);
					my $decoded_if = convert_decimal($interface);
					$tree2{'vcp'}{$tag}{$member}{$decoded_if} = $val;
				}
			}
		}
	}

	for my $nic (@nicids) {
		$tree2{'ports'}{$tree{$nic}{'ifName'}} = $tree{$nic};
		for my $tmp_key (keys $tree{$nic}) {
			my $field = $tree{$nic}{'ifName'};
			$field =~ s/[^a-z0-9]/_/gi;
			my $path = "snmp.$switch{'sysname'}.ports.$field.$tmp_key";
			my $value = $tree{$nic}{$tmp_key};
			if ($value =~ m/^\d+$/) {
				print $sock "$path $value $now_graphite\n";
			}

		}
		delete $tree{$nic};
	}
	for my $iid (keys %tree) {
		for my $key (keys %{$tree{$iid}}) {
			$tree2{'misc'}{$key}{$iid} = $tree{$iid}{$key};
			my $localiid = $iid;
			if ($localiid eq "") {
				$localiid = "_";
			}
			$localiid =~ s/[^a-z0-9]/_/gi;
			my $path = "snmp.$switch{'sysname'}.misc.$key.$localiid";
			my $value = $tree{$iid}{$key};
			if ($value =~ m/^\d+$/) {
				print $sock "$path $value $now_graphite\n";
			}
		}
	}
	if ($total > 0) {
		$sth->execute($switch{'sysname'}, JSON::XS::encode_json(\%tree2));
	}
	$qunlock->execute($switch{'id'})
		or die "Couldn't unlock switch";
	$dbh->commit;
	if ($total > 0) {
		if ((time - $switch{'start'}) > 10) {
			mylog( "Polled $switch{'sysname'} in " . (time - $switch{'start'}) . "s.");
		}
	} else {
		mylog( "Polled $switch{'sysname'} in " . (time - $switch{'start'}) . "s - no data. Timeout?");
	}
}
while (1) {
	inner_loop();
}
