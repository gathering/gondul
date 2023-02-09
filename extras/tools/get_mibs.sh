#!/bin/sh

ORIGPWD=$PWD
TMP=$(mktemp -d)
set -x
set -e
cd $TMP
#wget ftp://ftp.cisco.com/pub/mibs/v2/v2.tar.gz
wget https://www.juniper.net/techpubs/software/junos/junos223/juniper-mibs-22.3R1.12.tar
#tar xvzf v2.tar.gz  --strip-components=2
tar xvf juniper-mibs-22.3R1.12.tar
mkdir -p mibs

#mv v2 mibs/CiscoMibs
mv StandardMibs JuniperMibs mibs/
mv mibs ${ORIGPWD}/
cd ${ORIGPWD}
rm -rf ${TMP}
