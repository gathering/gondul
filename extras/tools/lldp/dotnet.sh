#!/usr/bin/env bash
set -xe
DATE="$(date --iso-8601=second | sed s/:/./g)"
JSON=lolwhat-${DATE}.json
./lolwhat.pl $* > ${JSON}
./draw-neighbors.pl < ${JSON} | dot -Tpng > lolwhat-${DATE}.png
./draw-neighbors.pl full < ${JSON} | dot -Tpng > lolwhat-${DATE}-full.png
echo File name: lolwhat-${DATE}*png
