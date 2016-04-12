#! /usr/bin/perl
use DBI;
use POSIX;
use lib '../include';
use nms;
use strict;
use Data::Dumper;
use warnings;

BEGIN {
        require "../include/config.pm";
        eval {
                require "../include/config.local.pm";
        };
}

my $year = $nms::config::tgname;
$year =~ s/tg/20/; # hihi

my %months = (
	Jan => 1,
	Feb => 2,
	Mar => 3,
	Apr => 4,
	May => 5,
	Jun => 6,
	Jul => 7,
	Aug => 8,
	Sep => 9,
	Oct => 10,
	Nov => 11,
	Dec => 12
);

my $realtime = 0;
my ($dbh, $q,$check);
$dbh = nms::db_connect();
$q = $dbh->prepare("INSERT INTO dhcp (switch,time,ip,mac) VALUES((SELECT switch FROM switches WHERE ?::inet << subnet4 ORDER BY sysname LIMIT 1),?,?,?)");
$check = $dbh->prepare("SELECT max(time)::timestamp - ?::timestamp < '0s'::interval as doit FROM dhcp;");

open(SYSLOG, "tail -n 9999999 -F /var/log/syslog |") or die "Unable to tail syslog: $!";
while (<SYSLOG>) {
	/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)\s+(\d+:\d+:\d+).*DHCPACK on (\d+\.\d+\.\d+\.\d+) to (\S+) / or next;
	my $date = $year . "-" . $months{$1} . "-" . $2 . " " . $3 . " Europe/Oslo";
	my $machine = $5;
	my $via = $6;
	$check->execute($date);
	$dbh->commit;
	my $cond = $check->fetchrow_hashref();
	if (!defined($cond) or !defined($cond->{'doit'}) or $cond->{'doit'} eq '1') {
		if ($realtime != 1) {
			$realtime = 1;
			print "real time achieved...\n";
		}
		$q->execute($4,$date,$4,$machine);
		$dbh->commit;
	}
}
close SYSLOG;
