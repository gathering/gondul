#!/bin/bash

# Generate a dependency list for debian packages needed to work
#
# This is ... somewhat extensive. And a good incentive for people to clean
# up their mess.

(
cat <<_EOF_
use lib '../include';
use lib '../web/streamlib';
_EOF_
find ../ -name '*pl' -exec egrep '^use ' {} \; | sort | uniq
cat <<_EOF_
foreach my \$key (keys %INC) {
	if (\$INC{\$key} =~ m/^\./) {
		next;
	}
	print \$INC{\$key} . "\n";
}
_EOF_
) |  perl 2>/dev/null | xargs realpath | xargs dpkg -S | awk '{print $1}' | sed 's/:$//' | sort | uniq
