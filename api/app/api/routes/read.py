from fastapi import APIRouter, Request, Response, HTTPException, Depends
import json
import time
import hashlib


from app.models.device import DeviceManagement, DevicesManagement
from app.models.network import Network, Networks
from app.models.snmp import Snmp
from app.api.deps import get_cache

router = APIRouter(prefix="/api/read", tags=["read"])

# switches-management
@router.get("/switches-management")
async def devices(
    request: Request, response: Response, cache=Depends(get_cache)
) -> DevicesManagement:
    updated = cache.get("devices:updated")
    etag = None
    if updated is not None:
        etag = hashlib.md5(updated.encode("utf-8")).hexdigest()
        response.headers["etag"] = etag
    if request.headers.get("If-None-Match") == etag:
        raise HTTPException(status_code=304)

    devices = (
        json.loads(cache.get("devices:data")) if cache.exists("devices:data") else {}
    )
    return {
        "switches": {
            device: {
                key: devices[device][key]
                for key in list(DeviceManagement.__fields__.keys())
            }
            for device in devices
        },
        "time": cache.get("devices:updated"),
        "hash": etag,
    }


# networks
@router.get("/networks")
async def networks(cache=Depends(get_cache)) -> Networks:
    devices = (
        json.loads(cache.get("networks:data")) if cache.exists("networks:data") else {}
    )
    return {
        "networks": {
            device: {
                key: devices[device][key] for key in list(Network.__fields__.keys())
            }
            for device in devices
        },
        "time": cache.get("networks:updated"),
        "hash": "",
    }


# snmp
@router.get("/snmp")
async def snmp(request: Request, response: Response, cache=Depends(get_cache)) -> Snmp:
    updated = cache.get("snmp:updated")
    etag = None
    if updated is not None:
        etag = hashlib.md5(updated.encode("utf-8")).hexdigest()
        response.headers["etag"] = etag
    if request.headers.get("If-None-Match") == etag:
        raise HTTPException(status_code=304)

    output = {}
    snmp_data = (
        json.loads(cache.get("snmp:data:data"))
        if cache.exists("snmp:data:data")
        else {}
    )
    for device in snmp_data:
        output.update(
            {
                device: {
                    "misc": {
                        "sysName": {"0": snmp_data[device]["sysName"]},
                        "sysUpTimeInstance": {"": snmp_data[device]["sysUpTime"]},
                        "sysDescr": {"0": snmp_data[device]["sysDescr"]},
                        "entPhysicalSerialNum": {
                            "1": snmp_data[device]["entPhysicalSerialNum"]
                        },
                    }
                }
            }
        )
    return {"snmp": output, "time": cache.get("snmp:updated"), "hash": etag}
