#!/usr/bin/perl
use strict;
use warnings;
use DBI;
use POSIX;
#use Time::HiRes qw(time);
use SNMP;
use Data::Dumper;
use lib '../include';
use nms;

SNMP::initMib();
SNMP::addMibDirs("/srv/tgmanage/mibs/StandardMibs");
SNMP::addMibDirs("/srv/tgmanage/mibs/JuniperMibs");
SNMP::addMibDirs("/srv/tgmanage/mibs");
SNMP::loadModules('ALL');

our $dbh = nms::db_connect();
$dbh->{AutoCommit} = 0;
$dbh->{RaiseError} = 1;

my $qualification = <<"EOF";
(last_updated IS NULL OR now() - last_updated > poll_frequency)
AND (locked='f' OR now() - last_updated > '15 minutes'::interval)
AND mgmt_v4_addr is not null
EOF

# Borrowed from snmpfetch.pl 
our $qswitch = $dbh->prepare(<<"EOF")
SELECT 
  sysname,switch,host(mgmt_v4_addr) as ip,community,
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
		push @switches, {
			'sysname' => $ref->{'sysname'},
			'id' => $ref->{'switch'},
			'mgtip' => $ref->{'ip'},
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
	SNMP::MainLoop(10);
}

sub callback{
	my @top = $_[1];
	my %switch = %{$_[0]};
	my %tree;
	my %ttop;
	my %nics;
	my @nicids;

	for my $ret (@top) {
		for my $var (@{$ret}) {
			for my $inner (@{$var}) {
				my ($tag,$type,$name,$iid, $val) = ( $inner->tag ,$inner->type , $inner->name, $inner->iid, $inner->val);
				if ($tag eq "ifPhysAddress") {
					next;
				}
				$tree{$iid}{$tag} = $val;
				if ($tag eq "ifIndex") {
					push @nicids, $iid;
				}
			}
		}
	}

	my %tree2;
	for my $nic (@nicids) {
		$tree2{'ports'}{$tree{$nic}{'ifName'}} = $tree{$nic};
		delete $tree{$nic};
	}
	for my $iid (keys %tree) {
		for my $key (keys %{$tree{$iid}}) {
			$tree2{'misc'}{$key}{$iid} = $tree{$iid}{$key};
		}
	}
	$sth->execute($switch{'sysname'}, JSON::XS::encode_json(\%tree2));
	$qunlock->execute($switch{'id'})
		or die "Couldn't unlock switch";
	$dbh->commit;
	mylog( "Polled $switch{'sysname'} in " . (time - $switch{'start'}) . "s.");
}
while (1) {
	inner_loop();
}
