#!/bin/sh

ORIGPWD=$PWD
TMP=$(mktemp -d)
set -x
set -e
cd $TMP
wget ftp://ftp.cisco.com/pub/mibs/v2/v2.tar.gz
tar xvzf v2.tar.gz  --strip-components=2
mkdir -p mibs

cp v2/* mibs/
mv mibs ${ORIGPWD}/
cd ${ORIGPWD}
rm -rf ${TMP}
