# A bugfix to the gettable functions of SNMP.pm, that deals properly
# with bulk responses being overridden. Original copyright:
#
#     Copyright (c) 1995-2006 G. S. Marzot. All rights reserved.
#     This program is free software; you can redistribute it and/or
#     modify it under the same terms as Perl itself.
#
# To use, just "use FixedSNMP;" and then use SNMP::Session as usual.

use strict;
use warnings;
use SNMP;

package FixedSNMP::Session;

sub _gettable_do_it() {
    my ($this, $vbl, $parse_indexes, $textnode, $state) = @_;

    my ($res);

    $vbl = $_[$#_] if ($state->{'options'}{'callback'});

    my $num_vbls = scalar @$vbl;
    my $num_stopconds = scalar @{$state->{'stopconds'}};

    while ($num_vbls > 0 && !$this->{ErrorNum}) {
        my @found_eof = (0) x $num_stopconds;

	for (my $i = 0; $i <= $#$vbl; $i++) {
	    my $row_oid = SNMP::translateObj($vbl->[$i][0]);
	    my $row_text = $vbl->[$i][0];
	    my $row_index = $vbl->[$i][1];
	    my $row_value = $vbl->[$i][2];
	    my $row_type = $vbl->[$i][3];

            my $stopcond_num = $i % $num_stopconds;
            my $stopcond = $state->{'stopconds'}[$stopcond_num];
	    if ($row_oid !~ /^\Q$stopcond\E/ || $row_value eq 'ENDOFMIBVIEW') {
                $found_eof[$stopcond_num] = 1;
            } else {

		if ($row_type eq "OBJECTID") {

		    # If the value returned is an OID, translate this
		    # back in to a textual OID

		    $row_value = SNMP::translateObj($row_value);

		}

		# continue past this next time

		$state->{'varbinds'}[$stopcond_num] = [ $row_text, $row_index ];

		# Place the results in a hash

		$state->{'result_hash'}{$row_index}{$row_text} = $row_value;
	    }
	}

	my @newstopconds = ();
        my @newvarbinds = ();
        for (my $i = 0; $i < $num_stopconds; ++$i) {
            unless ($found_eof[$i]) {
                push @newstopconds, $state->{'stopconds'}[$i];
                push @newvarbinds, $state->{'varbinds'}[$i];
            }
	}
	if ($#newstopconds == -1) {
	    last;
	}
	$state->{'varbinds'} = \@newvarbinds;
	$state->{'stopconds'} = \@newstopconds;
	$vbl = $state->{'varbinds'};
        $num_vbls = scalar @newvarbinds;
        $num_stopconds = scalar @newstopconds;

        #
        # if we've been configured with a callback, then call the
        # sub-functions with a callback to our own "next" processing
        # function (_gettable_do_it).  or else call the blocking method and
        # call the next processing function ourself.
        #
	if ($state->{'options'}{'callback'}) {
	    if ($this->{Version} ne '1' && !$state->{'options'}{'nogetbulk'}) {
		$res = $this->getbulk(0, $state->{'repeatcount'}, $vbl,
				      [\&_gettable_do_it, $this, $vbl,
				       $parse_indexes, $textnode, $state]);
	    } else {
		$res = $this->getnext($vbl,
				      [\&_gettable_do_it, $this, $vbl,
				       $parse_indexes, $textnode, $state]);
	    }
	    return;
	} else {
	    if ($this->{Version} ne '1' && !$state->{'options'}{'nogetbulk'}) {
		$res = $this->getbulk(0, $state->{'repeatcount'}, $vbl);
	    } else {
		$res = $this->getnext($vbl);
	    }
	}
    }

    # finish up
    _gettable_end_routine($state, $parse_indexes, $textnode);

    # return the hash if no callback was specified
    if (!$state->{'options'}{'callback'}) {
	return($state->{'result_hash'});
    }

    #
    # if they provided a callback, call it
    #   (if an array pass the args as well)
    #
    if (ref($state->{'options'}{'callback'}) eq 'ARRAY') {
	my $code = shift @{$state->{'options'}{'callback'}};
	$code->(@{$state->{'options'}{'callback'}}, $state->{'result_hash'});
    } else {
	$state->{'options'}{'callback'}->($state->{'result_hash'});
    }
}

*FixedSNMP::Session::_gettable_end_routine = *SNMP::Session::_gettable_end_routine;
*SNMP::Session::_gettable_do_it = *FixedSNMP::Session::_gettable_do_it;
