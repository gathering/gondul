#!/bin/bash
set -e
if [ ! -d /var/lib/postgresql/9.4/main ];  then
	echo Bootstrapping DB
	mkdir -p /var/lib/postgresql/9.4/main
	chown -R postgres /var/lib/postgresql/9.4 
	su postgres -c '/usr/lib/postgresql/9.4/bin/initdb /var/lib/postgresql/9.4/main'
	service postgresql start
	su postgres -c "psql --command=\"CREATE ROLE nms PASSWORD 'risbrod' NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT LOGIN;\""
	su postgres -c "createdb -O nms nms"
	su postgres -c "psql --command=\"CREATE ROLE grafana PASSWORD 'grafana' NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT LOGIN;\""
	su postgres -c "createdb -O grafana grafana"
	su postgres -c "cat /opt/gondul/build/schema.sql | psql nms"
	service postgresql stop
	echo Bootstrap done
fi
exec pg_ctlcluster --foreground 9.4 main start
