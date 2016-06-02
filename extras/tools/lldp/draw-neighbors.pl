#!/usr/bin/perl

use strict;
use JSON;

my $in;
while (<STDIN>) {
	$in .= $_;
}

my %assets = %{JSON::XS::decode_json($in)};

print "strict graph network {\n";
while (my ($key, $value) = each %assets) {
	print_tree ($key,0,undef);
}
print "}\n";

sub print_tree
{
	my ($chassis_id,$indent,$parent,$max) = @_;
	if (!defined($parent)) {
		$parent = "";
	}
	if ($indent > 50) {
		die "Possible loop detected.";
	}
	print " \"$assets{$chassis_id}{sysName}\" -- {";
	my @n;
	while (my ($key, $value) = each %{$assets{$chassis_id}{neighbors}}) {
		push @n, "\"$assets{$key}{sysName}\"";
	}
	print join(",",@n) . "};\n";
}

