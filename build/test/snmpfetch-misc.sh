#!/bin/bash
service snmpd start
cd /opt/gondul/data
if [ ! -d mibs ]; then
	../extras/tools/get_mibs.sh
fi
exec /opt/gondul/collectors/snmpfetchng.pl
