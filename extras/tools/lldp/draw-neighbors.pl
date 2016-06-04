#!/usr/bin/perl

use strict;
use JSON;

my $in;
my ($full) = @ARGV;
while (<STDIN>) {
	$in .= $_;
}

my %assets = %{JSON::XS::decode_json($in)};
my %map = %{$assets{hood}};
my %map2 = %{$assets{extended}};
my %map3 = %{$assets{lldpmap}};

print "strict graph network {\n";
if ($full ne "lldp") {
	while (my ($key, $value) = each %map) {
		print_tree ($key,0,undef);
	}
	if ($full eq "full") {
		while (my ($key, $value) = each %map2) {
			print_tree2 ($key,0,undef);
		}
	}
} else {
	while (my ($key, $value) = each %map3) {
		print_tree3 ($key, 0, undef);
	}
}
print "}\n";

sub print_tree3
{
	my ($id,$indent,$parent,$max) = @_;
	my $name = $id;
	if (defined($map3{$id}{sysName}) and $map3{$id}{sysName} ne "") {
		$name = $map3{$id}{sysName};
	}
	if ($indent > 50) {
		die "Possible loop detected.";
	}
	print " \"$name\" -- {";
	my @n;
	while (my ($key, $value) = each %{$map3{$id}{peers}}) {
		my $peer = $key;
		if (defined($map3{$key}{sysName}) and $map3{$key}{sysName} ne "") {
			$peer = $map3{$key}{sysName};
		}
		push @n, "\"$peer\"";
	}
	print join(",",@n) . "};\n";
}
sub print_tree
{
	my ($name,$indent,$parent,$max) = @_;
	if (!defined($parent)) {
		$parent = "";
	}
	if ($indent > 50) {
		die "Possible loop detected.";
	}
	print " \"$name\" -- {";
	my @n;
	while (my ($key, $value) = each %{$map{$name}}) {
		push @n, "\"$key\"";
	}
	print join(",",@n) . "};\n";
}

sub print_tree2
{
	my ($name,$indent,$parent,$max) = @_;
	if (!defined($parent)) {
		$parent = "";
	}
	if ($indent > 50) {
		die "Possible loop detected.";
	}
	print " \"$name\" -- {";
	my @n;
	while (my ($key, $value) = each %{$map2{$name}}) {
		push @n, "\"$key\"";
	}
	print join(",",@n) . "};\n";
}
