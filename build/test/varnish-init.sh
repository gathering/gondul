#!/bin/sh

touch /opt/gondul/data/varnish-auth.vcl
exec varnishd -a :80 -f /opt/gondul/extras/misc/varnish.vcl -F
