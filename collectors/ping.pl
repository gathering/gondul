#! /usr/bin/perl
use DBI;
use POSIX;
use Time::HiRes qw(sleep time);
use Net::Oping;
use strict;
use warnings;
use Data::Dumper;
use IO::Socket::IP;

use lib '/opt/gondul/include';
use nms;

$|++;
my $dbh = nms::db_connect();
$dbh->{AutoCommit} = 0;
$dbh->{RaiseError} = 1;

my $influx = nms::influx_connect();

my $q = $dbh->prepare("SELECT switch,sysname,host(mgmt_v4_addr) as ip,host(mgmt_v6_addr) as secondary_ip FROM switches WHERE switches.deleted = false and (mgmt_v4_addr is not null or mgmt_v6_addr is not null) ORDER BY random();");
my $lq = $dbh->prepare("SELECT linknet,addr1,addr2 FROM linknets WHERE addr1 is not null and addr2 is not null;");

my $last = time();
my $target = 1.0;
while (1) {
	my $now = time();
	my $elapsed = ($now - $last);
	if ($elapsed < $target) {
		sleep($target - ($now - $last));
	}

	my @influx_tree = ();

	$last = time();
	# ping loopbacks
	my $ping = Net::Oping->new;
	$ping->timeout(0.6);

	$q->execute;
	my %ip_to_switch = ();
	my %secondary_ip_to_switch = ();
	my %sw_to_sysname = ();
	my $affected = 0;
	while (my $ref = $q->fetchrow_hashref) {
		$affected++;
		my $switch = $ref->{'switch'};
		my $sysname = $ref->{'sysname'};
		$sw_to_sysname{$switch} = $sysname;

		my $ip = $ref->{'ip'};
		if (defined($ip) ) {
			$ping->host_add($ip);
			$ip_to_switch{$ip} = $switch;
		}

		my $secondary_ip = $ref->{'secondary_ip'};
		if (defined($secondary_ip)) {
			$ping->host_add($secondary_ip);
			$secondary_ip_to_switch{$secondary_ip} = $switch;
		}
	}
	if ($affected == 0) {
		print "Nothing to do... sleeping 1 second...\n";
		sleep(1);
		next;
	}

	my $result = $ping->ping();
	die $ping->get_error if (!defined($result));
	my %dropped = %{$ping->get_dropped()};

	$dbh->do('COPY ping (switch, latency_ms) FROM STDIN');  # date is implicitly now.
	my $drops = 0;
	while (my ($ip, $latency) = each %$result) {
		my $switch = $ip_to_switch{$ip};
		if (!defined($switch)) {
			next;
		}
		my $sysname = $sw_to_sysname{$switch};

		if (!defined($latency)) {
			$drops += $dropped{$ip};
		}
		$latency //= "\\N";
		$dbh->pg_putcopydata("$switch\t$latency\n");
		if($latency ne "\\N") {
                    push (@influx_tree,
                    {
                        measurement => 'ping',
                        tags => {
                            switch =>  $sysname,
                            ip => $ip,
                            version => 'v4'
                        },
                        fields => {
                            latency => $latency,
                        },
                    });
		}
	}


	if ($drops > 0) {
		print "$drops ";
	}
	$dbh->pg_putcopyend();

	$dbh->do('COPY ping_secondary_ip (switch, latency_ms) FROM STDIN');  # date is implicitly now.
	while (my ($ip, $latency) = each %$result) {
		my $switch = $secondary_ip_to_switch{$ip};
		next if (!defined($switch));
		my $sysname = $sw_to_sysname{$switch};

		$latency //= "\\N";
		$dbh->pg_putcopydata("$switch\t$latency\n");
                if($latency ne "\\N") {
                    push (@influx_tree,
                    {   
                        measurement => 'ping',
                        tags => {
                            switch =>  $sysname,
                            ip => $ip, 
                            version => 'v6'
                        },
                        fields => { 
                            latency => $latency,
                        },              
                    }); 
                }
	}
	$dbh->pg_putcopyend();

	$dbh->commit;

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

}
