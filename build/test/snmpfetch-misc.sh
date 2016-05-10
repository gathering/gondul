#!/bin/bash
service snmpd start
exec /opt/nms/collectors/snmpfetchng.pl
