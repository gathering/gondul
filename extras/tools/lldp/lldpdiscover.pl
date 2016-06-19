#! /usr/bin/perl
# 
# Basic tool to discover your neighbourhood systems, using LLDP, as seen
# through SNMP.
#
# Usage: ./lldpdiscover.pl <ip> <community>
#
# This will connect to <ip> and poll it for SNMP-data, then add that to an
# asset database. After that's done, we parse the LLDP neighbor table
# provided over SNMP and add those systems to assets, then try to probe
# THEM with SNMP, using the same community, and so on.
#
# If the entire internet exposed LLDP and SNMP in a public domain, we could
# theoretically map the whole shebang.
#
# Note that leaf nodes do NOT need to reply to SNMP to be added, but
# without SNMP, there'll obviously be some missing data.
#
# The output is a JSON blob of all assets, indexed by chassis id. It also
# includes a neighbor table for each asset which can be used to generate a
# map (See dotnet.sh or draw-neighbors.pl for examples). It can also be
# used to add the assets to NMS.
#
# A sensible approach might be to run this periodically, store the results
# to disk, then have multiple tools parse the results.
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
my @chassis_ids_checked;
my @chassis_ids_to_check;

# If we are given one switch on the command line, add that and then exit.
my ($cmdline_ip, $cmdline_community) = @ARGV;
if (defined($cmdline_ip) && defined($cmdline_community)) {
	my $chassis_id;
	eval {
	# Special-case for the first switch is to fetch chassis id
	# directly. Everything else is fetched from a neighbour
	# table.
		my $session = nms::snmp::snmp_open_session($cmdline_ip, $cmdline_community);
		$chassis_id = get_lldp_chassis_id($session);
		$assets{$chassis_id}{'community'} = $cmdline_community;
		$assets{$chassis_id}{'ip'} = $cmdline_ip;
		push @chassis_ids_to_check, $chassis_id;
	};
	if ($@) {
		mylog("Error during SNMP  : $@");
		exit 1;
	}

	# Welcome to the main loop!
	while (scalar @chassis_ids_to_check > scalar @chassis_ids_checked) {
		# As long as you call it something else, it's not really a
		# goto-statement, right!?
		OUTER: for my $id (@chassis_ids_to_check) {
		       for my $id2 (@chassis_ids_checked) {
			       if ($id2 eq $id) {
				       next OUTER;
			       }
		       }
		       mylog("Adding $id");
		       add_switch($id);
		       mylog("Discovering neighbors for $id");
		       discover_lldp_neighbors($id);
		       push @chassis_ids_checked,$id;
	       }
	}
	while (my ($mac, $entry) = each %arp) {
		if (!defined($entry->{'neighbors'})) {
			delete $arp{$mac};
			next;
		}
		my $sysn = $entry->{sysName};
		for my $aentry (@{$entry->{'neighbors'}}) {
			if (defined($entry->{chassis_id}) and $aentry->{origin} eq $entry->{chassis_id}) {
				next;
			}
                        if ($aentry->{ipNetToMediaType} eq "static") {
				next;
			}
			$arp{$mac}{ips}{$aentry->{ipNetToMediaNetAddress}} = 1;
			if (!defined($arp{$mac}{sysName})) {
				$arp{$mac}{sysName}= $aentry->{ipNetToMediaNetAddress};
				$arp{$mac}{namefromip} = 1;
			}
			$arp{$mac}{nsystems}{$aentry->{origin_sysname}} = 1;
		}
	}
	my %map = ();
	while (my ($mac, $entry) = each %arp) {
		while (my ($sys, $ientry) = each %{$entry->{nsystems}}) {
			$map{$entry->{sysName}}{$sys} = 1;
			$map{$sys}{$entry->{sysName}} = 1;
		}
	}

	my %major = ();
	$major{assets} = \%assets;
	$major{arp} = \%arp;
	$major{map} = \%map;
	print JSON::XS::encode_json(\%major);
# Creates corrupt output, hooray.
#	print JSON::XS->new->pretty(1)->encode(\%assets);
	exit;
} else {
	print "RTFSC\n";
}
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

sub mylog {
	my $msg = shift;
	my $time = POSIX::ctime(time);
	$time =~ s/\n.*$//;
	printf STDERR "[%s] %s\n", $time, $msg;
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
		$ret{'lldpRemManAddrTable'} = $session->gettable("lldpRemManAddrTable");
		$ret{'lldpRemTable'} = $session->gettable("lldpRemTable");
		$ret{'ipNetToMediaTable'} = $session->gettable('ipNetToMediaTable');
		$ret{'ifTable'} = $session->gettable('ifTable');
		$ret{'ifXTable'} = $session->gettable('ifXTable');
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
	while (my ($key, $value) = each %{$snmp}) {
		$result{$key} = $value;
	}
	while (my ($key, $value) = each %{$snmp->{lldpRemTable}}) {
		my $chassis_id = nms::convert_mac($value->{'lldpRemChassisId'});
		foreach my $key2 (keys %$value) {
			$lol{$value->{lldpRemIndex}}{$key2} = $value->{$key2};
		}
		$lol{$value->{lldpRemIndex}}{'lldpRemChassisId'} = $chassis_id;
		my %caps = ();
		nms::convert_lldp_caps($value->{'lldpRemSysCapEnabled'}, \%caps);
		$lol{$value->{lldpRemIndex}}{'lldpRemSysCapEnabled'} = \%caps;
	}
	while (my ($key, $value) = each %{$snmp->{lldpRemManAddrTable}}) {
		my $old = 0;
		if (defined($lol{$value->{lldpRemIndex}}{lldpRemManAddr})) {
			mylog("\t\tFound existing address: $lol{$value->{lldpRemIndex}}{lldpRemManAddr}");
			$old = $lol{$value->{lldpRemIndex}}{lldpRemManAddrSubtype};
		}
		my $addr = $value->{'lldpRemManAddr'};
		my $addrtype = $value->{'lldpRemManAddrSubtype'};
		foreach my $key2 (keys %$value) {
			if ($key2 eq 'lldpRemManAddr') {
				next;
			}
			$lol{$value->{lldpRemIndex}}{$key2} = $value->{$key2};
		}
		if ($addrtype == 1) {
			$lol{$value->{lldpRemIndex}}{lldpRemManAddr} = nms::convert_ipv4($addr);
		} elsif ($addrtype == 2 && $old == 0) {
			$lol{$value->{lldpRemIndex}}{lldpRemManAddr} = nms::convert_ipv6($addr);
		}
	}
	while (my ($key, $value) = each %{$snmp->{ipNetToMediaTable}}) {
		$value->{ipNetToMediaPhysAddress} = nms::convert_mac($value->{ipNetToMediaPhysAddress});
		push @{$lol{$value->{ipNetToMediaIfIndex}}{ARP}}, $value;
	}
	while (my ($key, $value) = each %{$snmp->{ifTable}}) {
		$value->{ifPhysAddress} = nms::convert_mac($value->{ifPhysAddress});
		foreach my $key2 (keys %$value) {
			$lol{$value->{ifIndex}}{$key2} = $value->{$key2};
		}
	}
	while (my ($key, $value) = each %{$snmp->{ifXTable}}) {
		foreach my $key2 (keys %$value) {
			$lol{$key}{$key2} = $value->{$key2};
		}
	}
	return \%lol;
}

# Add a chassis_id to the list to be checked, but only if it isn't there.
# I'm sure there's some better way to do this, but meh, perl. Doesn't even
# have half-decent prototypes.
sub check_neigh {
	my $n = $_[0];
	for my $v (@chassis_ids_to_check) {
		if ($v eq $n) {
			return 0;
		}
	}
	push @chassis_ids_to_check,$n;
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
	$assets{$chassis_id}{'snmp_parsed'} = parse_snmp($snmp);
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
	#printf "get lldpLocChassisId.0\n";
	$response = $session->get('lldpLocChassisId.0');
	#print "\tconverted: " . nms::convert_mac($response) . "\n";
	#print "\tstring: " . $response . "\n";
	my $real = nms::convert_mac($response);
	#printf "getnext lldpLocChassisId.0\n";
	$response = $session->getnext('lldpLocChassisId.0');
	#print "\tconverted: " . nms::convert_mac($response) . "\n";
	#print "\tstring: " . $response . "\n";

	#printf "get lldpLocChassisId\n";
	$response = $session->get('lldpLocChassisId');
	#print "\tconverted: " . nms::convert_mac($response) . "\n";
	#print "\tstring: " . $response . "\n";

	#printf "getnext lldpLocChassisId\n";
	$response = $session->getnext('lldpLocChassisId');
	#print "\tconverted: " . nms::convert_mac($response) . "\n";
	#print "\tstring: " . $response . "\n";
	
	return $real;
}
