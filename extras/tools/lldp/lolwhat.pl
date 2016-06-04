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

# Actual assets detected, indexed by chassis ID
my %assets;
my %arp;

# Tracking arrays. Continue scanning until they are of the same length.
my @ips_checked;
my @ips_to_check;


# If we are given one switch on the command line, add that and then exit.
my $cmdline_community = shift;
my @ips = @ARGV;

my %lldpmap = ();

sub mylog {
	my $msg = shift;
	my $time = POSIX::ctime(time);
	$time =~ s/\n.*$//;
	printf STDERR "[%s] %s\n", $time, $msg;
}



my %ipmap = ();
my %peermap = ();
my %snmpresults = ();
foreach my $target (@ips) {
	my $snmp = get_snmp_data($target, $cmdline_community);
	my $parsed = parse_snmp($snmp);
	$snmpresults{$target} = $parsed;

	#print Dumper(\$parsed);
}
#print Dumper(\%ipmap);
#print Dumper(\%peermap);

my %hood = ();
my %extended = ();

mylog("Building peermaps");
while (my ($ip, $value)  = each %peermap) {
	my $sys = $ipmap{$ip} || $ip;
	my $real = defined($ipmap{$ip});
	foreach my $sys2 (@{$value}) {
		if ($real) {
			$hood{$sys}{$sys2} = 1;
			$hood{$sys2}{$sys} = 1;
		} else {
			$extended{$sys2}{$sys} = 1;
		}
	}
}
#print Dumper(\%hood);
#print Dumper(\%extended);

my %result = ( snmpresults => \%snmpresults, hood => \%hood, extended => \%extended, ipmap => \%ipmap, peermap => \%peermap, lldpmap => \%lldpmap);

mylog("Done. Outputting JSON.");
print JSON::XS::encode_json(\%result);
exit;

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
		#print Dumper(\%ret);
	};
	if ($@) {
		my $tmp = "$@";
		chomp($tmp);
		mylog("\t" . $tmp);
		return undef;
	}
	return \%ret;
}

# Filter raw SNMP data over to something more legible.
# This is the place to add all post-processed results so all parts of the
# tool can use them.
sub parse_snmp
{
	my $snmp = $_[0];
	my %result = ();
	my %lol = ();
	mylog("\tPost-processing SNMP");
	my $sysname = $snmp->{sysName};
	mylog("\tSysname: $sysname");
	$result{sysName} = $sysname;
	$result{sysDescr} = $snmp->{sysDescr};
	my $chassis_id =  nms::convert_mac($snmp->{lldpLocChassisId});
	my $bad_chassis_id = 0;
	if (defined($chassis_id)) {
		$result{lldpLocChassisId} = $chassis_id;
		mylog("\tChassis id: $chassis_id");
		if (defined($chassis_id) and defined($lldpmap{$chassis_id}{sysName})) {
			mylog("\t\tSwitch/chassis already known?");
			if ($lldpmap{$chassis_id}{sysName} ne $sysname) {
				mylog("\t\tXXX: Likely chassis ID collision");
				mylog("\t\tXXX: Chassis ID previously seen as $lldpmap{$chassis_id}{sysName}");
				mylog("\t\tXXX: But we are $sysname! This will dampen the mood.");
				$bad_chassis_id = 1;
			}
		} else {
				mylog("\t\tNew chassis");
				$lldpmap{$chassis_id}{sysName} = $sysname;
		}
	} else {
		mylog("\t\tNo lldpLocChassisId found. Bummer. Enable LLDP?");
		$bad_chassis_id = 1;
	}
	@{$result{ips}} = ();
	@{$result{peers}} = ();
	@{$result{lldppeers}} = ();
	mylog("\tParsing lldp neighbors");
	while (my ($key, $value) = each %{$snmp->{lldpRemTable}}) {
		my $idx = $value->{lldpRemLocalPortNum};
		my $rem_chassis_id = nms::convert_mac($value->{'lldpRemChassisId'});
		my $remname = $value->{lldpRemSysName};
		mylog("\t\tSpotted $rem_chassis_id / $remname");
		foreach my $key2 (keys %$value) {
			$lol{$idx}{$key2} = $value->{$key2};
		}
		$lol{$idx}{key} = $key;
		$lol{$idx}{'lldpRemChassisId'} = $rem_chassis_id;
		my %caps = ();
		nms::convert_lldp_caps($value->{'lldpRemSysCapEnabled'}, \%caps);
		$lol{$idx}{'lldpRemSysCapEnabled'} = \%caps;
		if ($bad_chassis_id == 1) {
			mylog("\t\tXXX:Skipping lldp-coupling due to broken/nonexistent lldpLocChassisId");
			next;
		}
		$lldpmap{$chassis_id}{peers}{$rem_chassis_id} = 1;
		$lldpmap{$rem_chassis_id}{peers}{$chassis_id} = 1;
		if (defined($lldpmap{$rem_chassis_id}{sysName})) {
			if ($lldpmap{$rem_chassis_id}{sysName} ne $remname) {
				mylog("\t\t\tXXX: Collision .... $rem_chassis_id: $remname vs $lldpmap{$rem_chassis_id}{sysName}");
			}
		} else {
			$lldpmap{$rem_chassis_id}{sysName} = $remname;
		}
	}
	mylog("\tParsing lldp neighbors management interfaces");
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
				mylog("\t\tTwo management IPs discovered on port. v4 vs v6.");
				mylog("\t\t\t$lol{$idx}{lldpRemManAddr} vs $remip");
			}
			if ($old > $addrtype) {
				$lol{$idx}{lldpRemManAddr} = $remip;
			}
		} else {
			$lol{$idx}{lldpRemManAddr} = $remip;
		}
		if (!defined($ipmap{$remip})) {
			$ipmap{$remip} = $remname;
		}
		mylog("\t\tPeer added: $remip");
		push @{$result{peers}}, $remip;
		push @{$lol{$idx}{peers}}, $remip;
	}
	mylog("\tParsing local interfaces");
	while (my ($key, $value) = each %{$snmp->{ifTable}}) {
		$value->{ifPhysAddress} = nms::convert_mac($value->{ifPhysAddress});
		foreach my $key2 (keys %$value) {
			$lol{$value->{ifIndex}}{$key2} = $value->{$key2};
		}
	}
	mylog("\tParsing ARP table");
	while (my ($key, $value) = each %{$snmp->{ipNetToMediaTable}}) {
		my $mac = nms::convert_mac($value->{ipNetToMediaPhysAddress});
		my $idx = $value->{ipNetToMediaIfIndex};
		$value->{ipNetToMediaPhysAddress} = $mac;
		push @{$lol{$idx}{ARP}}, $value;
		if ($lol{$idx}{ifPhysAddress} eq $mac) {
			push @{$lol{$idx}{ips}}, $value->{ipNetToMediaNetAddress};
			push @{$result{ips}}, $value->{ipNetToMediaNetAddress};
		} else {
			mylog("\t\tAdding peer: $value->{ipNetToMediaNetAddress}");
			push @{$lol{$idx}{peers}}, $value->{ipNetToMediaNetAddress};
			push @{$result{peers}}, $value->{ipNetToMediaNetAddress};
		}
	}
	while (my ($key, $value) = each %{$snmp->{ifXTable}}) {
		foreach my $key2 (keys %$value) {
			$lol{$key}{$key2} = $value->{$key2};
		}
	}
	mylog("\tParsing ipAddressTable");
	while (my ($key, $value) = each %{$snmp->{ipAddressTable}}) {
		my $addr = $value->{ipAddressAddr};
		my $addrtype = $value->{ipAddressAddrType};
		if ($addrtype == 1) {
			$addr = nms::convert_ipv4($addr);
		} elsif ($addrtype == 2) {
			$addr = nms::convert_ipv6($addr);
		} else {
			mylog("\t\tSkipping unknown addrtype: $addrtype");
			next;
		}
		mylog("\t\tLocal IP added: $addr");
		push @{$result{ips}}, $addr;
	}
	@{$result{peers}} = sort @{$result{peers}};
	@{$result{ips}} = sort @{$result{ips}};
	$result{interfaces} = \%lol;
	foreach my $localip (@{$result{ips}}) {
		$ipmap{$localip} = $result{sysName};
	}
	foreach my $peer (@{$result{peers}}) {
		if (!defined($peermap{$peer})) {
			@{$peermap{$peer}} = ();
		}
		push @{$peermap{$peer}}, $result{sysName};
	}
	return \%result;
}
