# vim:ts=8:sw=8
use strict;
use warnings;
use utf8;
use DBI;
use Data::Dumper;
use JSON;
use nms;
package nms::dbconfig;

use base 'Exporter';
our @EXPORT = qw(%config);
our %config;
my $dbh;

use Data::Dumper;


BEGIN {
	$dbh = nms::db_connect();
	my $q2 = $dbh->prepare('select * from config order by id desc limit 1;');
	$q2->execute();
	while (my $ref = $q2->fetchrow_hashref()) {
		%config = %$ref;
		$config{'data'} = JSON::XS::decode_json($ref->{'data'});
	}
	$dbh->disconnect();
}
1;
