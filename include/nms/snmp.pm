#! /usr/bin/perl
use strict;
use warnings;
use FixedSNMP; 
use SNMP;
use nms;
package nms::snmp;

use base 'Exporter';
our @EXPORT = qw();

BEGIN {
	# $SNMP::debugging = 1;

	# sudo mkdir /usr/share/mibs/site
	# cd /usr/share/mibs/site
	# wget -O- ftp://ftp.cisco.com/pub/mibs/v2/v2.tar.gz | sudo tar --strip-components=3 -zxvvf -
	SNMP::initMib();
	SNMP::addMibDirs("/opt/gondul/mibs/StandardMibs");
	SNMP::addMibDirs("/opt/gondul/mibs/JuniperMibs");
	SNMP::addMibDirs("/opt/gondul/mibs/CiscoMibs");
	
	SNMP::loadModules('SNMPv2-MIB');
	SNMP::loadModules('ENTITY-MIB');
	SNMP::loadModules('JUNIPER-MIB');
	SNMP::loadModules('IF-MIB');
	SNMP::loadModules('LLDP-MIB');
	SNMP::loadModules('IP-MIB');
	SNMP::loadModules('IP-FORWARD-MIB');
}

sub snmp_open_session {
	my ($ip, $community, $async) = @_;

	$async //= 0;

	my %options = (UseEnums => 1, Retries => 0);
	if ($ip =~ /:/) {
		$options{'DestHost'} = "udp6:$ip";
	} else {
		$options{'DestHost'} = "udp:$ip";
	}

	if ($community =~ /^snmpv3:(.*)$/) {
		my ($username, $authprotocol, $authpassword, $privprotocol, $privpassword) = split /\//, $1;

		$options{'SecName'} = $username;
		$options{'SecLevel'} = 'authNoPriv';
		$options{'AuthProto'} = $authprotocol;
		$options{'AuthPass'} = $authpassword;

		if (defined($privprotocol) && defined($privpassword)) {
			$options{'SecLevel'} = 'authPriv';
			$options{'PrivProto'} = $privprotocol;
			$options{'PrivPass'} = $privpassword;
		}

		$options{'Version'} = 3;
	} else {
		$options{'Community'} = $community;
		$options{'Version'} = 2;
	}

	my $session = SNMP::Session->new(%options);
	if (defined($session) && ($async || defined($session->getnext('sysDescr')))) {
		return $session;
	} else {
		die 'Could not open SNMP session to ' . $ip;
	}
}

# Not currently in use; kept around for reference.
sub fetch_multi_snmp {
	my ($session, @oids) = @_;

	my %results = ();

	# Do bulk reads of 40 and 40; seems to be about the right size for 1500-byte packets.
	for (my $i = 0; $i < scalar @oids; $i += 40) {
		my $end = $i + 39;
		$end = $#oids if ($end > $#oids);
		my @oid_slice = @oids[$i..$end];

		my $localresults = $session->get_request(-varbindlist => \@oid_slice);
		return undef if (!defined($localresults));

		while (my ($key, $value) = each %$localresults) {
			$results{$key} = $value;
		}
	}

	return \%results;
}
1;
