#!/bin/bash
service snmpd start
exec /opt/gondul/collectors/snmpfetchng.pl
