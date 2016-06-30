#! /usr/bin/perl
# 
# What? WHAAAAT? What's going on?
#
# Simple to to figure out what those tools in the network department have
# actually done. Uses SNMP to gather information about your network, using
# multiple techniques to father information about "next hop".
#
# Usage: ./lolwhat.pl <ip> <community>
#
# This will connect to <ip> and poll it for SNMP-data, then add that to an
# asset database. 
use POSIX;
use Time::HiRes;
use strict;
use warnings;
use Data::Dumper;

use lib '/opt/gondul/include';
use FixedSNMP;
use nms;
use nms::snmp;

# If we are given one switch on the command line, add that and then exit.
my $cmdline_community = shift;
my @ips = @ARGV;

# Actual SNMP results - keyed by IP
my %snmpresults = ();

# LLDP peers detected from remotes.
# Keyed by chassis ID - as seen remotely.
my %lldppeers = ();

my %lldpmap = ();
my %lldpnamemap = ();

my %lldpresolver = ();
my %ipmap = ();
my %peermap = ();
my %claimedips = ();

# tracking for log indentation
my $mylogindent = "";

mylog("Polling initial systems");

logindent(1);
foreach my $target (@ips) {
	probe_sys($target, $cmdline_community);
	pad_snmp_results();
}
logindent(-1);


peerdetect();
pad_snmp_results();

# List of chassis IDs checked.
# Note that we deliberately don't add the chassis id's from systems prboed
# directly from the command line. Experience has shown us that
# lldpLocChassisId can be unreliable, so we don't trust it, even if it does
# mean we might end up polling the same system multiple times.
my @chassis_ids_checked = ();
while (scalar keys %lldppeers > scalar @chassis_ids_checked) {
	mylog("Probed auto-detected peers: " . scalar @chassis_ids_checked . " Total detected: " . scalar keys %lldppeers );
	logindent(1);
	OUTER: for my $id (keys %lldppeers) {
	       for my $id2 (@chassis_ids_checked) {
		       if ($id2 eq $id) {
			       next OUTER;
		       }
	       }
	       probe_sys($lldppeers{$id}{ip}, $cmdline_community);
	       push @chassis_ids_checked,$id;
	}
	pad_snmp_results();
	peerdetect();
	logindent(-1);
}
mylog("Probing complete. Trying to make road in the velling");

pad_snmp_results();
deduplicate();
pad_snmp_results();

populate_lldpmap();
populate_ipmap();
populate_peermap();

my %result = ( snmpresults => \%snmpresults, ipmap => \%ipmap, peermap => \%peermap, lldpmap => \%lldpmap, lldppeers => \%lldppeers);

mylog("Done. Outputting JSON.");
print JSON::XS::encode_json(\%result);
exit;

sub compare_targets_depth {
	my ($t1, $t2)  = @_;
	my $res = 0;
	my $matches = 0;
	while (my ($port, $data) = each %{$snmpresults{$t1}{interfaces}}) {
		my $one = $data->{ifPhysAddress};
		my $two = $snmpresults{$t2}{interfaces}{$port}{ifPhysAddress};
		if (!defined($one) and !defined($two)) {
			next;
		}
		if (!defined($one) or !defined($two)) {
			$res++;
		}  elsif ($one ne $two) {
			$res++;
		} else {
			if ($one ne "" and $two ne "") {
				if ($one ne "00:00:00:00:00:00") {
					$matches++;
				}
			}
		}
	}
	if ($matches > 10 and $res == 0) {
		mylog("$matches interfaces share MAC address. Calling it OK.");
		return $res;
	} else {
		mylog("$res mismatched interfaces versus $matches matched. Not enough for confidence.");
		$res++;
	}
	return $res;
}
sub compare_targets {
	my ($t1, $t2)  = @_;
	my $res = 0;
	my $fuckperl = 0;
	my $bad = "";
	$bad = "$t2 not found on $t1";
	foreach my $t1ip (@{$snmpresults{$t1}{ips}}) {
		if ($fuckperl == 0) {
			if ($t1ip eq $t2) {
				$res = 1;
				$fuckperl = 1;
			}
		}
	}
	$fuckperl = 0;
	if ($res == 0) {
		$bad = "$t1 not found on $t2";
	}
	foreach my $t2ip (@{$snmpresults{$t2}{ips}}) {
		if ($fuckperl == 0) {
			if ($t2ip eq $t1) {
				$res = $res + 1;
				$fuckperl = 1;
			}
		}
	}
	if ($res == 1) {
		mylog("... So there are two systems that look 50% similar. $bad (But not the other way around)");
	}
	if ($res != 2) {
		mylog("Lacking confidence. Doing in-depth comparison instead");
		logindent(1);
		$res = compare_targets_depth($t1, $t2);
		if ($res == 0) {
			$res = 2;
			mylog("Gained confidence. Injecting missing IPs to both canidates.");
			logindent(1);
			inject_ips($t1, $t2);
			logindent(-1);
		}
		logindent(-1);
	}
	return $res;
}
# Get raw SNMP data for an ip/community.
sub get_snmp_data {
	my ($ip, $community) = @_;
	my %ret = ();
	mylog("Polling $ip");
	eval {
		my $session = nms::snmp::snmp_open_session($ip, $community);
		$ret{'sysName'} = $session->get('sysName.0');
		$ret{'sysDescr'} = $session->get('sysDescr.0');
		$ret{'lldpLocChassisId'} = $session->get('lldpLocChassisId.0');
		$ret{'lldpRemManAddrTable'} = $session->gettable("lldpRemManAddrTable");
		$ret{'lldpRemTable'} = $session->gettable("lldpRemTable");
		$ret{'ipNetToMediaTable'} = $session->gettable('ipNetToMediaTable');
		$ret{'ifTable'} = $session->gettable('ifTable');
		$ret{'ifXTable'} = $session->gettable('ifXTable');
		$ret{'ipAddressTable'} = $session->gettable('ipAddressTable');
		$ret{'ipAddrTable'} = $session->gettable('ipAddrTable');
		#print Dumper(\%ret);
	};
	if ($@) {
		my $tmp = "$@";
		chomp($tmp);
		mylog($tmp);
		return undef;
	}
	if (!defined($ret{sysName})) {
		return undef;
	}
	return \%ret;
}

# Compare a new LLDP with old ones.
sub compare
{
	my %in = %{$_[0]};
	if (!defined($lldppeers{$in{id}})) {
		return 1;
	}
	my %old = %{$lldppeers{$in{id}}};
	if ($old{name} eq $in{name}) {
		return 0;
	} else {
		mylog("\t\tXXX: Fu... chassis ID collision from remote ID $in{id}.");
		mylog("\t\t\tXXX: Old sysname/ip: $old{name} / $old{ip}");
		mylog("\t\t\tXXX: New sysname/ip: $in{name} / $in{ip}");
		return -1;
	}
}

sub peerdetect
{
	mylog("Detecting new candidates for probes");
	  
	logindent(1);
	while (my ($target, $value) = each %snmpresults) {
		while (my ($port, $data) = each %{$value->{interfaces}}) {
			my %d = ( ip => $data->{lldpRemManAddr}, id => $data->{lldpRemChassisId}, name => $data->{lldpRemSysName} );
			if (!defined($d{ip})) {
				next;
			}
			if (!defined($d{id})) {
				mylog("wtf is up here? Man addr but no chassis id? I HATE NETWORK EQUIPMENT");
				next;
			}
			if (!defined($d{name})) {
				mylog("I. Hate. Network. Equipment. We got IP, chassis id but no sysname.");
				next;
			}
			if (compare(\%d) > 0) {
				%{$lldppeers{$d{id}}} = %d;
				mylog("Adding peer $d{name} / $d{ip} / $d{id}");
			}
		}
	}
	logindent(-1);
}

# Deduplicate entries of SNMP (in case we spotted the same thing twice) and
# detect collisions of sysnames and sort it out.
sub deduplicate
{
	my %remmap = ();
	my %syscollisions = ();
	my %locmap = ();
	my %okips = ();
	mylog("Building inventory of decent results/ips");
	logindent(1);
	while (my ($target, $value) = each %snmpresults) {
		if (defined($value->{fakeSnmp}) and $value->{fakeSnmp} eq "yes") {
			next;
		}
		if (defined($value->{sysName}) and defined($value->{ips})) {
			mylog("Ok: $target");
			foreach my $ip (@{$value->{ips}}) {
				$okips{$ip} = 1;
			}
		}
	}
	logindent(-1);
	mylog("Checking for empty SNMP results that are covered by other results");
	logindent(1);
	my @removals = ();
	while (my ($target, $value) = each %snmpresults) {
		if (defined($value->{fakeSnmp}) and $value->{fakeSnmp} eq "yes") {
			if (defined($okips{$target})) {
				push @removals,$target;
			}
		}
	}
	mylog("Removing " . join(", ", @removals));
	foreach my $removal (@removals) {
		delete $snmpresults{$removal};
	}
	logindent(-1);

	mylog("Checking for duplicated/corrupt chassis ids");
	logindent(1);
	mylog("Building sysname -> chassis id table where possible");
	logindent(1);
	while (my ($target, $value) = each %snmpresults) {
		while (my ($port, $data) = each %{$value->{interfaces}}) {
			if (!defined($data->{lldpRemSysName})) {
				next;
			}
			my $name = $data->{lldpRemSysName};
			my $id = $data->{lldpRemChassisId};
			if (defined($remmap{$name}) and $remmap{$name} ne $id) {
				mylog("sysName collision. This is only an issue if there is _also_ chassis id collision.");
				push @{$syscollisions{$name}}, $id;
			} else {
				$remmap{$name} = $id;
			}
		}
	}
	logindent(-1);
	mylog("Building local chassis id map");
	logindent(1);
	while (my ($target, $value) = each %snmpresults) {
		my $locchassis = $value->{lldpLocChassisId};
		if (!defined($locchassis)) {
			next;
		}
		push @{$locmap{$locchassis}}, $target;
	}
	logindent(-1);
	mylog("Checking for chassis id's with duplicate systems");
	logindent(1);
	my %fixlist = ();
	my %tested = ();
	while (my ($id, $value) = each %locmap) {
		if (@$value > 1) {
			mylog("Duplicate or collision: chassis id ($id) : " . join(", ", @$value));
			logindent(1);
			my @removed = ();
			foreach my $test (@$value) {
				foreach my $isremoved1 (@removed) {
					if ($isremoved1 eq $test) {
						next;
					}
				}
				foreach my $test2 (@$value) {
					if ($test2 eq $test) {
						next;
					}
					foreach my $isremoved2 (@removed) {
						if ($isremoved2 eq $test2) {
							next;
						}
					}
					if (defined($tested{$test}{$test2}) or defined($tested{$test2}{$test})) {
						next;
					} elsif (compare_targets($test, $test2) != 2) {
						mylog("Collision between $test and $test2. Adding to fixlist.");
						mylog("a: " . $snmpresults{$test}{sysName} . " b: ". $snmpresults{$test2}{sysName});
						$tested{$test}{$test2} = 1;
						$tested{$test2}{$test} = 1;
						$fixlist{$test} = 1;
						$fixlist{$test2} = 1;
					} else {
						$tested{$test}{$test2} = 1;
						$tested{$test2}{$test} = 1;
						push @removed, $test2;
					}
				}
			}
			foreach my $old (@removed) {
				delete $snmpresults{$old};
			}
			if (@removed > 0) {
				mylog("Removed duplicates: " . join(", ", @removed));
			}
			logindent(-1);
		}
	}
	logindent(-1);
	mylog("Applying fixes for ". (keys %fixlist) . " collisions");
	logindent(1);
	while (my ($ip, $value) = each %fixlist) {
		my $sysname = $snmpresults{$ip};
		if (defined($syscollisions{$sysname})) {
			mylog("Can't really fix $ip because there's also a sysname collision for that sysname");
			#$snmpresults{$ip}{lldpLocChassisId} = undef;
		} elsif (defined($remmap{$sysname})) {
			if ($remmap{$sysname} eq $snmpresults{$ip}{lldpLocChassisId}) {
				mylog("Couldn't fix $ip / $sysname. The extrapolated chassis id seen from remote is the same as the colliding one.... ");
				$snmpresults{$ip}{lldpLocChassisId} = undef;
			} else {
				mylog("Switching chassis ID from colliding $snmpresults{$ip}{lldpLocChassisId} to what remotes think matches: $remmap{$sysname}");
				$snmpresults{$ip}{lldpLocChassisId} = $remmap{$sysname};
			}
		} else {
			mylog("No alternate chassis IDs seen for $ip. Unsetting broken chassis ID anyway.");
			$snmpresults{$ip}{lldpLocChassisId} = undef;
		}
	}
	logindent(-1);
	logindent(-1);
}

# Filter raw SNMP data over to something more legible.
# This is the place to add all post-processed results so all parts of the
# tool can use them.
sub parse_snmp
{
	my $snmp = $_[0];
	my $targetip = $_[1];
	my %result = ();
	my %lol = ();
	if (!defined($snmp)) {
		mylog("XXX: No snmp data. Probably disconnect?");
		return;
	}
	my $sysname = $snmp->{sysName};
	mylog("Post-processing SNMP. Sysname: $sysname");
	logindent(1);
	$result{sysName} = $sysname;
	$result{sysDescr} = $snmp->{sysDescr};
	my $chassis_id =  nms::convert_mac($snmp->{lldpLocChassisId});
	if (defined($chassis_id)) {
		if (defined($result{lldpLocChassisId})) {
			if ($result{lldpLocChassisId} eq $chassis_id) {
				mylog("Chassis id matched remote...");
			} else {
				mylog("Bad chassis id.... Fudge. Ignoring direct result.");
			}
		} else {
			$result{lldpLocChassisId} = $chassis_id;
			mylog("Chassis id: $chassis_id");
		}
	} else {
		mylog("XXX: No lldpLocChassisId found. Bummer. Enable LLDP?");
	}
	@{$result{ips}} = ();
	@{$result{peers}} = ();
	mylog("Parsing lldp neighbors");
	logindent(1);
	while (my ($key, $value) = each %{$snmp->{lldpRemTable}}) {
		my $idx = $value->{lldpRemLocalPortNum};
		my $rem_chassis_id = nms::convert_mac($value->{'lldpRemChassisId'});
		my $remname = $value->{lldpRemSysName};
		mylog("Spotted $rem_chassis_id / $remname");
		foreach my $key2 (keys %$value) {
			$lol{$idx}{$key2} = $value->{$key2};
		}
		$lol{$idx}{key} = $key;
		$lol{$idx}{'lldpRemChassisId'} = $rem_chassis_id;
		my %caps = ();
		nms::convert_lldp_caps($value->{'lldpRemSysCapEnabled'}, \%caps);
		$lol{$idx}{'lldpRemSysCapEnabled'} = \%caps;
		my %caps2 = ();
		nms::convert_lldp_caps($value->{'lldpRemSysCapSupported'}, \%caps2);
		$lol{$idx}{'lldpRemSysCapSupported'} = \%caps2;
	}
	logindent(-1);
	mylog("Parsing lldp neighbors management interfaces");
	logindent(1);
	while (my ($key, $value) = each %{$snmp->{lldpRemManAddrTable}}) {
		my $old = 0;
		my $idx = $value->{lldpRemLocalPortNum};
		my $remname = $lol{$idx}{lldpRemSysName};
		if (defined($lol{$idx}{lldpRemManAddr})) {
			$old = $lol{$idx}{lldpRemManAddrSubtype};
		}
		my $addr = $value->{'lldpRemManAddr'};
		my $addrtype = $value->{'lldpRemManAddrSubtype'};
		foreach my $key2 (keys %$value) {
			if ($key2 eq 'lldpRemManAddr') {
				next;
			}
			$lol{$idx}{$key2} = $value->{$key2};
		}
		my $remip;
		if ($addrtype == 1) {
			$remip = nms::convert_ipv4($addr);
		} elsif ($addrtype == 2) {
			$remip = nms::convert_ipv6($addr);
		} else {
			next;
		}
		if ($old != 0) {
			if ($old != $addrtype) {
				mylog("Two management IPs discovered on port. v4 vs v6.");
				mylog("\t$lol{$idx}{lldpRemManAddr} vs $remip");
			}
			if ($old > $addrtype) {
				$lol{$idx}{lldpRemManAddr} = $remip;
			}
		} else {
			$lol{$idx}{lldpRemManAddr} = $remip;
		}
		push @{$result{peers}}, $remip;
		push @{$lol{$idx}{peers}}, $remip;
	}
	logindent(-1);
	mylog("Parsing local interfaces");
	logindent(1);
	while (my ($key, $value) = each %{$snmp->{ifTable}}) {
		$value->{ifPhysAddress} = nms::convert_mac($value->{ifPhysAddress});
		foreach my $key2 (keys %$value) {
			$lol{$value->{ifIndex}}{$key2} = $value->{$key2};
		}
	}
	logindent(-1);
	mylog("Parsing ARP table");
	logindent(1);
	while (my ($key, $value) = each %{$snmp->{ipNetToMediaTable}}) {
		my $mac = nms::convert_mac($value->{ipNetToMediaPhysAddress});
		my $idx = $value->{ipNetToMediaIfIndex};
		$value->{ipNetToMediaPhysAddress} = $mac;
		push @{$lol{$idx}{ARP}}, $value;
		if ($lol{$idx}{ifPhysAddress} eq $mac) {
			push @{$lol{$idx}{ips}}, $value->{ipNetToMediaNetAddress};
			push @{$result{ips}}, $value->{ipNetToMediaNetAddress};
			mylog("Found my self: " . $value->{ipNetToMediaNetAddress});
		} else {
			push @{$lol{$idx}{peers}}, $value->{ipNetToMediaNetAddress};
			push @{$result{peers}}, $value->{ipNetToMediaNetAddress};
		}
	}
	while (my ($key, $value) = each %{$snmp->{ifXTable}}) {
		foreach my $key2 (keys %$value) {
			$lol{$key}{$key2} = $value->{$key2};
		}
	}
	logindent(-1);
	mylog("Parsing ipAddressTable");
	logindent(1);
	while (my ($key, $value) = each %{$snmp->{ipAddressTable}}) {
		my $addr = $value->{ipAddressAddr};
		my $addrtype = $value->{ipAddressAddrType};
		if ($addrtype == 1) {
			$addr = nms::convert_ipv4($addr);
		} elsif ($addrtype == 2) {
			$addr = nms::convert_ipv6($addr);
		} else {
			next;
		}
		mylog("Local IP added: $addr");
		push @{$result{ips}}, $addr;
	}
	logindent(-1);
	mylog("Parsing ipAddrTable");
	logindent(1);
	while (my ($key, $value) = each %{$snmp->{ipAddrTable}}) {
		push @{$result{ips}}, $value->{ipAdEntAddr};
		mylog("Adding local ipv4 ip $value->{ipAdEntAddr}");
	}
	logindent(-1);
	@{$result{peers}} = sort @{$result{peers}};
	@{$result{ips}} = sort @{$result{ips}};
	$result{interfaces} = \%lol;
	mylog("Ensuring some sanity: Checking if the $targetip is among claimed IPs for the SNMP results");
	logindent(1);
	my $sanitytest = 0;
	foreach my $ip (@{$result{ips}}) {
		if ($ip eq $targetip) {
			mylog("Phew, it is...");
			$sanitytest = 1;
		}
	}
	if ($sanitytest == 0) {
		mylog("Didn't find myself. Hoping deduplication will take care of it?");
		$result{badSelf} = 1;
	}
	logindent(-1);
	mylog("Registering known ips for " . ($sysname || "?" ));
	foreach my $ip (@{$result{ips}}) {
		$claimedips{$ip} = $sysname || "?";
	}
	logindent(-1);
	
	return \%result;
}
sub inject_ips {
	my ($t1, $t2) = @_;
	push @{$snmpresults{$t1}{ips}}, $t1;
	push @{$snmpresults{$t1}{ips}}, $t2;
	push @{$snmpresults{$t2}{ips}}, $t1;
	push @{$snmpresults{$t2}{ips}}, $t2;
}
sub logindent {
	my $change = $_[0];
	if ($change > 0) {
		$mylogindent = $mylogindent . "\t";
	} else {
		chop $mylogindent;
	}
}
sub mylog {
	my $msg = shift;
	my $time = POSIX::ctime(time);
	$time =~ s/\n.*$//;
	printf STDERR "[%s] %s%s\n", $time, $mylogindent, $msg;
}
# Porbe a single system.
sub probe_sys
{
	my ($target, $community) = @_;
	if (defined($snmpresults{$target}) and defined($snmpresults{$target}{'probed'})) {
		mylog("Already probed $target. Skipping.");
		return;
	}
	if (defined($claimedips{$target})) {
		mylog("IP claimed by $claimedips{$target}. Skipping.");
		return;
	}
	my $snmp = get_snmp_data($target, $community);
	$snmpresults{$target}{'probed'} = 1;
	if (!defined($snmp)) {
		return;
	}
	my $parsed = parse_snmp($snmp,$target);
	if (!defined($parsed)) {
		return;
	}
	$snmpresults{$target} = $parsed;
	$snmpresults{$target}{'probed'} = 1;
}
sub populate_lldpmap
{
	mylog("Populate LLDP map");
	while (my ($ip, $value) = each %snmpresults) {
		my $sysname = $value->{sysName};
		my $id = $value->{lldpLocChassisId};
		while (my ($if, $data) = each %{$value->{interfaces}}) {
			if (!defined($data->{lldpRemSysName})) {
				next;
			} else {
				if (defined($id)) {
					$lldpmap{$id}{$data->{lldpRemChassisId}} = 1;
				}
				$lldpnamemap{$sysname}{$data->{lldpRemSysName}} = 1;
			}
		}
	}
}

sub populate_ipmap
{
	mylog("Populating ipmap");
	my @conflicts = ();
	logindent(1);
	while (my ($ip, $value) = each %snmpresults) {
		my $sysname = $value->{sysName};
		if (defined($ipmap{$ip})) {
			mylog("Conflict for ip $ip");
		}
		$ipmap{$ip} = $ip;
		foreach my $localip (@{$value->{ips}}) {
			if (!defined($localip)) {
				next;
			} elsif (defined($ipmap{$localip}) and $ipmap{$localip} ne $ip) {
				mylog("IP conflict: $localip found multiple places ($ipmap{$localip} vs $ip)");
				push @conflicts, $localip;
			}
			$ipmap{$localip} = $ip;
		}
	}
	mylog("Removing conflicting IPs");
	foreach my $contested (@conflicts) {
		delete $ipmap{$contested};
	}
	logindent(-1);
}

sub pad_snmp_results
{
	mylog("Checking if there are peers from LLDP with no basic SNMP info");
	logindent(1);
	while (my ($id, $value) = each %lldppeers) {
		if (!defined($value->{ip}) or defined($snmpresults{$value->{ip}}{sysName})) {
			next;
		}
		mylog("Adding basic info for $value->{ip} / $value->{name} to snmp results");
		$snmpresults{$value->{ip}}{sysName} = $value->{name}; 
		$snmpresults{$value->{ip}}{lldpLocChassisId} = $value->{id};
		$snmpresults{$value->{ip}}{fakeSnmp} = "yes";
		push @{$snmpresults{$value->{ip}}{ips}}, $value->{ip};
	}
	logindent(-1);
}
sub populate_peermap
{
	mylog("Populate layer3 peermap");
	while (my ($ip, $value) = each %snmpresults) {
		my $sysname = $value->{sysName};
		foreach my $peer (@{$value->{peers}}) {
			$peermap{$ip}{$peer} = 1;
		}
	}
}
