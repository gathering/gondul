#!/usr/bin/env bash
set -xe
DATE="$(date --iso-8601=second | sed s/:/./g)"
OUT=out/
mkdir -p $OUT
JSON=${OUT}lolwhat-${DATE}.json
./lolwhat.pl $* > ${JSON}
./draw-neighbors.pl < ${JSON} | dot -Tpng > ${OUT}lolwhat-${DATE}.png
./draw-neighbors.pl full < ${JSON} | dot -Tpng > ${OUT}lolwhat-${DATE}-full.png
./draw-neighbors.pl lldp < ${JSON} | dot -Tpng > ${OUT}lolwhat-${DATE}-lldp.png
echo File name: ${OUT}lolwhat-${DATE}*png
