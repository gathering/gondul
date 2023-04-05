#! /usr/bin/perl
use strict;
use warnings;
package nms::config;

# DB
our $db_name = "nms";
our $db_host = "localhost";
our $db_username = "nms";
our $db_password = "<REDACTED>";
our $graphite_host = "graphite";
our $graphite_port = "2003";

# Influx
our $influx_host = "http://localhost:8086";
our $influx_username = "gondulWrite";
our $influx_password = "<REDACTED>";
our $influx_database = "gondul";

