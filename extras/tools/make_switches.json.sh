#!/bin/bash

CORE="core"
DISTRO="distro"
ROWS0="1 3 5 7 9"
ROWS1="11 13 15 17 19"
ROWS2="21 23 25 27 29"
ROWS3="31 33 35 37 39"
N=1
inc() {
	N=$(( $N + 1 ))
}
echo "[{\"sysname\": \"$core\", \"mgmt_v4_addr\": \"127.0.0.$N\"},"
inc
mkswitch() {
	cat <<_EOF_
{"sysname": "$1", "distro": "$2", "mgmt_v4_addr": "127.0.0.$N"},
_EOF_
inc
}
mkswitch ${DISTRO}0 core
for a in $ROWS0; do
	mkswitch row${a}-1 distro0
	mkswitch row${a}-2 distro0
done
	
mkswitch ${DISTRO}1 core
for a in $ROWS1; do
	mkswitch row${a}-1 distro1
	mkswitch row${a}-2 distro1
done

mkswitch ${DISTRO}2 core
for a in $ROWS2; do
	mkswitch row${a}-1 distro2
	mkswitch row${a}-2 distro2
done
mkswitch ${DISTRO}3 core
for a in $ROWS3; do
	mkswitch row${a}-1 distro3
	mkswitch row${a}-2 distro3
done
cat <<_WOF_
{"sysname": "noc", "distro": "core", "mgmt_v4_addr": "127.0.0.$N" }]
_WOF_

