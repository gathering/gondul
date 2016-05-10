#!/bin/sh

ORIGPWD=$PWD
TMP=$(mktemp -d)
set -x
set -e
cd $TMP
wget ftp://ftp.cisco.com/pub/mibs/v2/v2.tar.gz
wget https://www.juniper.net/techpubs/software/junos/junos151/juniper-mibs-15.1R3.6.tgz
tar xvzf v2.tar.gz  --strip-components=2
tar xvzf juniper-mibs-15.1R3.6.tgz
mkdir -p mibs

mv v2 mibs/CiscoMibs
mv StandardMibs JuniperMibs mibs/
mv mibs ${ORIGPWD}/
cd ${ORIGPWD}
rm -rf ${TMP}
