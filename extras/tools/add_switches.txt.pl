#!/usr/bin/perl
# Usage: ./add_switches.txt.pl < switches.txt > switches.json
# 
# Parses switches.txt into json currently just throws it to stdout
#
# Actually adding them to a DB comes later.

use strict;
use warnings;
use Data::Dumper;
use lib '/home/tech/gondul/include';
use JSON;
use nms::util;

my @switches = parse_switches_txt(*STDIN);

print JSON::XS::encode_json(\@switches);
