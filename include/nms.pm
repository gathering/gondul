#! /usr/bin/perl
use strict;
use warnings;
use DBI;
use Data::Dumper;
use FileHandle;
use JSON;
use AnyEvent::InfluxDB;
package nms;

use base 'Exporter';
our @EXPORT = qw(db_connect convert_mac convert_decimal);

BEGIN {
	require "config.pm";
	eval {
		require "config.local.pm";
	};
}


sub db_connect {
	my $connstr = "dbi:Pg:dbname=" . $nms::config::db_name;
	$connstr .= ";host=" . $nms::config::db_host unless (!defined($nms::config::db_host));

	my $dbh = DBI->connect($connstr,
	                       $nms::config::db_username,
	                       $nms::config::db_password, {AutoCommit => 0})
	        or die "Couldn't connect to database";
	return $dbh;
}

sub influx_connect {
	my $ix = AnyEvent::InfluxDB->new(
		server => $nms::config::influx_host,
		username => $nms::config::influx_username,
		password => $nms::config::influx_password,
	) or die "Couldn't connect to InfluxDB";
	return $ix;
}

# A few utilities to convert from SNMP binary address format to human-readable.

sub convert_mac {
	return join(':', map { sprintf "%02x", $_ } unpack('C*', shift));
}

sub convert_ipv4 {
	return join('.', map { sprintf "%d", $_ } unpack('C*', shift));
}

sub convert_ipv6 {
	return join(':', map { sprintf "%x", $_ } unpack('n*', shift));
}

sub convert_addr {
	my ($data, $type) = @_;
	if ($type == 1) {
		return convert_ipv4($data);
	} elsif ($type == 2) {
		return convert_ipv6($data);
	} else {
		die "Unknown address type $type";
	}
}

# I am not a perl programmer
sub convert_decimal {
	return join("",(map { sprintf "%c", $_ } split(/\./,shift)));
}

# Convert raw binary SNMP data to list of bits.
sub convert_bytelist {
	return split //, unpack("B*", shift);
}

sub convert_lldp_caps {
	my ($caps_data, $data) = @_;

        my @caps = convert_bytelist($caps_data);
        my @caps_names = qw(other repeater bridge ap router telephone docsis stationonly);
        for (my $i = 0; $i < scalar @caps && $i < scalar @caps_names; ++$i) {
		$data->{'cap_enabled_' . $caps_names[$i]} = $caps[$i];
        }
}

1;
