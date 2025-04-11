from fastapi import APIRouter, Depends
import json

from app.api.deps import get_cache

router = APIRouter(prefix="/v2/prometheus", tags=["prometheus"])

@router.get("/ping")
async def devices(cache=Depends(get_cache)):
    output = []

    devices = (
        json.loads(cache.get("devices:data")) if cache.exists("devices:data") else {}
    )
    for sysname in devices:
        device = devices[sysname]
        if device["mgmt_v4_addr"]:
            output.append(
                {
                    "targets": [device["mgmt_v4_addr"]],
                    "labels": {"sysname": device["sysname"], "type": "v4"},
                }
            )
        if device["mgmt_v6_addr"]:
            output.append(
                {
                    "targets": [device["mgmt_v6_addr"]],
                    "labels": {"sysname": device["sysname"], "type": "v6"},
                }
            )
    return output


@router.get("/snmp")
async def devices(cache=Depends(get_cache)):
    output = []

    devices = (
        json.loads(cache.get("devices:data")) if cache.exists("devices:data") else {}
    )
    for sysname in devices:
        device = devices[sysname]
        if device["mgmt_v6_addr"]:
            output.append(
                {
                    "targets": [device["mgmt_v6_addr"]],
                    "labels": {
                        "sysname": device["sysname"],
                        "platform": device["platform"],
                    },
                }
            )
        elif device["mgmt_v4_addr"]:
            output.append(
                {
                    "targets": [device["mgmt_v4_addr"]],
                    "labels": {
                        "sysname": device["sysname"],
                        "platform": device["platform"],
                    },
                }
            )
    return output
