# vim:ts=8:sw=8
use strict;
use warnings;
use utf8;
use DBI;
use Data::Dumper;
use JSON;
use nms;
package nms::oplog;

use base 'Exporter';
our @EXPORT = qw(oplog);
my $dbh;
my $query;
my $user;

use Data::Dumper;


sub oplog {
	$query->execute($_[0], "[$user]" . $_[1]);
	$dbh->commit;
}

BEGIN {
	$user = $ENV{'REMOTE_USER'} || "internal";
	$dbh = nms::db_connect();
	$query = $dbh->prepare("INSERT INTO oplog (username, systems, log) VALUES('system',?,?)");
}

END {
	$dbh->disconnect();
}
1;
