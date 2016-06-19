#!/usr/bin/perl

use strict;
use JSON;

my $in;
my ($full) = @ARGV;
while (<STDIN>) {
	$in .= $_;
}

my %assets = %{JSON::XS::decode_json($in)};
my %peermap = %{$assets{peermap}};
my %map2 = %{$assets{lldpmap}};
my %ipmap = %{$assets{ipmap}};

print "strict graph network {\n";
if ($full ne "lldp") {
	while (my ($key, $value) = each %peermap) {
		print_tree ($key,0,undef);
	}
} else {
	while (my ($key, $value) = each %map2) {
		print_lldp ($key, 0, undef);
	}
}
print "}\n";

sub print_lldp
{
	my ($id,$indent,$parent,$max) = @_;
	my $name = $id;
	if (defined($assets{lldppeers}{$id}{name}) and $assets{lldppeers}{$id}{name} ne "") {
		$name = $assets{lldppeers}{$id}{name};
	}
	print " \"$name\" -- {";
	my @n;
	while (my ($key, $value) = each %{$map2{$id}}) {
		my $peer = $key;
		if (defined($assets{lldppeers}{$key}{name}) and $assets{lldppeers}{$key}{name} ne "") {
			$peer = $assets{lldppeers}{$key}{name};
		}
		push @n, "\"$peer\"";
	}
	print join(",",@n) . "};\n";
}
sub print_tree
{
	my ($ip) = @_;
	my $name = $ip;
	if ($assets{snmpresults}{$ip}{sysName}) {
		$name = $assets{snmpresults}{$ip}{sysName};
	}
	print " \"$name\" -- {";
	my @n;
	while(my ($peer, $garbage) = each %{$peermap{$ip}}) {
		my $name = get_name($peer);
		if ($name ne $peer or $full eq "full") {
			push @n, "\"$name\"";
		}
	}
	print join(",",@n) . "};\n";
}

sub get_name {
	my ($ip) = @_;
	if (defined($ipmap{$ip})) {
		$ip = $ipmap{$ip};
	}
	my $name = $ip;
	if (defined($assets{snmpresults}{$ip}{sysName})) {
		$name = $assets{snmpresults}{$ip}{sysName};
		if ($name eq "") {
			$name = $assets{snmpresults}{$ip}{lldpLocChassisId} || $ip;
		}
		return $name;
	}
	return $name;
}
