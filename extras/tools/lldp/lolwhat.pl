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

print JSON::XS::encode_json(\%result);
exit;

# Filter out stuff we don't scan. Return true if we care about it.
# XXX: Several of these things are temporary to test (e.g.: AP).
sub filter {
	my %sys = %{$_[0]};
	if (!defined($sys{'lldpRemSysCapEnabled'})) {
		return 0;
	}
	my %caps = %{$sys{'lldpRemSysCapEnabled'}};
	my $sysdesc = $sys{'lldpRemSysDesc'};
	my $sysname = $sys{'lldpRemSysName'};

	if ($caps{'cap_enabled_ap'}) {
		return 1;
	}
	if ($caps{'cap_enabled_telephone'}) {
		return 0;
	}
	if (!defined($sysdesc)) {
		return 1;
	}
	if ($sysdesc =~ /\b(C1530|C3600|C3700)\b/) {
		return 0;
	}
	if (!$caps{'cap_enabled_bridge'} && !$caps{'cap_enabled_router'}) {
		return 1;
	}
	if ($sysname =~ /BCS-OSL/) {
		return 1;
	}
	return 1;
}

# Discover neighbours of a switch. The data needed is already present int
# %assets , so this shouldn't cause any extra SNMP requests. It will add
# new devices as it finds them.
sub discover_lldp_neighbors {
	my $local_id = $_[0];
	#print "local id: $local_id\n";
	my $ip = $assets{$local_id}{mgmt};
	my $local_sysname = $assets{$local_id}{snmp}{sysName};
	my $community = $assets{$local_id}{community};
	my $addrtable;
	while (my ($key, $value) = each %{$assets{$local_id}{snmp_parsed}}) {
		my $chassis_id = $value->{'lldpRemChassisId'};

		my $sysname = $value->{'lldpRemSysName'};
		if (!defined($sysname)) {
			$sysname = $chassis_id;
		}

		if (defined($value->{lldpRemManAddr})) {
			$sysname =~ s/\..*$//;
		} else {
			next;
		}
		# Do not try to poll servers.
		if (!filter(\%{$value})) {
			mylog("\tFiltered out $sysname  ($local_sysname -> $sysname)");
			next;
		}
		mylog("\tFound $sysname ($chassis_id) ($local_sysname -> $sysname )");
		if (defined($assets{$chassis_id}{'sysName'})) {
			mylog("\t\tDuplicate $sysname: \"$sysname\" vs \"$assets{$chassis_id}{'sysName'}\" - $value->{'lldpRemManAddr'} vs $assets{$chassis_id}{'ip'}");
			if ($assets{$chassis_id}{'sysName'} eq "") {
				$assets{$chassis_id}{'sysName'} = $sysname;
			}
		} else {
			$assets{$chassis_id}{'sysName'} = $sysname;
		}

		# FIXME: We should handle duplicates better and for more
		# than just sysname. These happen every time we are at
		# least one tier down (given A->{B,C,D,E}, switch B, C, D
		# and E will all know about A, thus trigger this). We also
		# want to _add_ information only, since two nodes might
		# know about the same switch, but one might have incomplete
		# information (as is the case when things start up).

		# We simply guess that the community is the same as ours.
		$assets{$chassis_id}{'community'} = $community;
		$assets{$chassis_id}{'ip'} = $value->{lldpRemManAddr};

		$assets{$chassis_id}{'neighbors'}{$local_id} = 1;
		$assets{$local_id}{'neighbors'}{$chassis_id} = 1;
		check_neigh($chassis_id);
		#print "checking $chassis_id\n";
	}
}


# Get raw SNMP data for an ip/community.
# FIXME: This should be seriously improved. Three get()'s and four
# gettables could definitely be streamlined, but then again, I doubt it
# matters much unless we start running this tool constantly.
sub get_snmp_data {
	my ($ip, $community) = @_;
	my %ret = ();
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
	$result{sysName} = $snmp->{sysName};
	my $sysname = $snmp->{sysName};
	$result{sysDescr} = $snmp->{sysDescr};
	$result{lldpLocChassisId} = nms::convert_mac($snmp->{lldpLocChassisId});
	my $chassis_id = $result{lldpLocChassisId};
	mylog("$sysname: $chassis_id");
	my $bad_chassis_id = 0;
	if (defined($chassis_id) and defined($lldpmap{$chassis_id}{sysName})) {
		mylog("Spottet twin");
		if ($lldpmap{$chassis_id}{sysName} ne $sysname) {
			mylog("Spotted broken chassis id collision wtf omg lol");
			mylog("stored $lldpmap{$chassis_id}{sysName} ne $sysname");
			$bad_chassis_id = 1;
		}
	} else {
		if (defined($chassis_id)) {
			$lldpmap{$chassis_id}{sysName} = $sysname;
		} else {
			$bad_chassis_id = 1;
		}
	}
	@{$result{ips}} = ();
	@{$result{peers}} = ();
	@{$result{lldppeers}} = ();
	while (my ($key, $value) = each %{$snmp->{lldpRemTable}}) {
		my $idx = $value->{lldpRemLocalPortNum};
		my $rem_chassis_id = nms::convert_mac($value->{'lldpRemChassisId'});
		my $remname = $value->{lldpRemSysName};
		foreach my $key2 (keys %$value) {
			$lol{$idx}{$key2} = $value->{$key2};
		}
		$lol{$idx}{key} = $key;
		$lol{$idx}{'lldpRemChassisId'} = $rem_chassis_id;
		my %caps = ();
		nms::convert_lldp_caps($value->{'lldpRemSysCapEnabled'}, \%caps);
		$lol{$idx}{'lldpRemSysCapEnabled'} = \%caps;
		if ($bad_chassis_id == 1) {
			mylog("Skipping lldp-coupling due to broken/nonexistent lldpLocChassisId");
			next;
		}
		$lldpmap{$chassis_id}{peers}{$rem_chassis_id} = 1;
		$lldpmap{$rem_chassis_id}{peers}{$chassis_id} = 1;
		if (defined($lldpmap{$rem_chassis_id}{sysName})) {
			if ($lldpmap{$rem_chassis_id}{sysName} ne $remname) {
				mylog("Collision .... $rem_chassis_id: $remname vs $lldpmap{$rem_chassis_id}{sysName}");
			}
		} else {
			$lldpmap{$rem_chassis_id}{sysName} = $remname;
		}
	}
	while (my ($key, $value) = each %{$snmp->{lldpRemManAddrTable}}) {
		my $old = 0;
		my $idx = $value->{lldpRemLocalPortNum};
		my $remname = $lol{$idx}{lldpRemSysName};
		if (defined($lol{$idx}{lldpRemManAddr})) {
			mylog("\t\tFound existing address: $lol{$idx}{lldpRemManAddr}");
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
			$lol{$idx}{lldpRemManAddr} = nms::convert_ipv4($addr);
		} elsif ($addrtype == 2 && $old == 0) {
			$remip = nms::convert_ipv6($addr);
			$lol{$idx}{lldpRemManAddr} = nms::convert_ipv6($addr);
		} else {
			next;
		}
		if (!defined($ipmap{$remip})) {
			$ipmap{$remip} = $remname;
		}
		push @{$result{peers}}, $remip;
		push @{$lol{$idx}{peers}}, $remip;
	}
	while (my ($key, $value) = each %{$snmp->{ifTable}}) {
		$value->{ifPhysAddress} = nms::convert_mac($value->{ifPhysAddress});
		foreach my $key2 (keys %$value) {
			$lol{$value->{ifIndex}}{$key2} = $value->{$key2};
		}
	}
	while (my ($key, $value) = each %{$snmp->{ipNetToMediaTable}}) {
		my $mac = nms::convert_mac($value->{ipNetToMediaPhysAddress});
		my $idx = $value->{ipNetToMediaIfIndex};
		$value->{ipNetToMediaPhysAddress} = $mac;
		push @{$lol{$idx}{ARP}}, $value;
		if ($lol{$idx}{ifPhysAddress} eq $mac) {
			push @{$lol{$idx}{ips}}, $value->{ipNetToMediaNetAddress};
			push @{$result{ips}}, $value->{ipNetToMediaNetAddress};
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

# Add a chassis_id to the list to be checked, but only if it isn't there.
# I'm sure there's some better way to do this, but meh, perl. Doesn't even
# have half-decent prototypes.
sub check_neigh {
	my $n = $_[0];
	for my $v (@ips_to_check) {
		if ($v eq $n) {
			return 0;
		}
	}
	push @ips_to_check,$n;
	return 1;
}

# We've got a switch. Populate it with SNMP data (if we can).
sub add_switch {
	my $chassis_id = shift;
	my $addr;
	my $snmp = undef;
	$addr = $assets{$chassis_id}{'ip'};
	my $name = $assets{$chassis_id}{'sysName'} || "$addr";
	mylog("\tProbing $addr ($name)");
	$snmp = get_snmp_data($addr, $assets{$chassis_id}{'community'});
	
	return if (!defined($snmp));
	my $sysname = $snmp->{sysName};
	$sysname =~ s/\..*$//;
	$assets{$chassis_id}{'sysName'} = $sysname;
	$assets{$chassis_id}{'ip'} = $addr;
	$assets{$chassis_id}{'snmp'} = $snmp;
	populate_arp($chassis_id);
	return;
}

sub populate_arp {
	my ($id) = @_;
	while (my ($key, $value) = each %{$assets{$id}{snmp_parsed}}) {
		my $mac = $value->{'ifPhysAddress'};
		if (!defined($mac) || $mac eq "") {
			next;
		}
		mylog("mac: $mac - $assets{$id}{sysName}");
		$arp{$mac}{chassis_id} = $id;
		$arp{$mac}{port} = $key;
		$arp{$mac}{sysName} = $assets{$id}{sysName};
		if (!defined($value->{ARP})) {
			next;
		}
		for my $entry (@{$value->{ARP}}) {
			my $nmac = $entry->{ipNetToMediaPhysAddress};
			if (!defined($arp{$nmac}{neighbors})) {
				@{$arp{$nmac}{neighbors}} = ();
			}
			$entry->{'origin'} = $id;
			$entry->{'origin_sysname'} = $assets{$id}{sysName};
			$entry->{'origin_mgmt'} = $assets{$id}{ip};
			push @{$arp{$nmac}{neighbors}}, $entry;
		}
	}
}

sub get_lldp_chassis_id {
	my ($session) = @_;
	my $response;
	$response = $session->get('lldpLocChassisId.0');
	my $real = nms::convert_mac($response);
	return $real;
}
