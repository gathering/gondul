from fastapi import APIRouter, Depends, Request, Response, HTTPException
import json
import time
import hashlib

from ..models.device import PublicDevice, PublicDevices
from ..models.config import Config
from ..models.ping import Ping
from ..dependencies import get_redis

router = APIRouter(prefix="/api/public", tags=["public"])

# dhcp
# dhcp-summary

# distro-tree
# switch-state


# config
@router.get("/config")
async def config(request: Request, response: Response) -> Config:
    # TODO Read from env
    config = {
        "sitename": "Development",
        "publicvhost": "example.gondul.tg.no",
        "public": False,
        "shortname": "tgX",
    }

    etag = hashlib.md5(json.dumps(config, sort_keys=True).encode("utf-8")).hexdigest()
    response.headers["etag"] = etag
    if request.headers.get("If-None-Match") == etag:
        raise HTTPException(status_code=304)
    return {"config": config, "time": round(time.time()), "hash": etag}


# switches
@router.get("/switches")
async def devices(
    request: Request, response: Response, cache=Depends(get_redis)
) -> PublicDevices:
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
                for key in list(PublicDevice.__fields__.keys())
            }
            for device in devices
        },
        "time": cache.get("devices:updated"),
        "hash": etag,
    }


# ping
@router.get("/ping")
async def devices(
    request: Request, response: Response, cache=Depends(get_redis)
) -> Ping:
    updated = cache.get("ping:updated")
    etag = None
    if updated is not None:
        etag = hashlib.md5(updated.encode("utf-8")).hexdigest()
        response.headers["etag"] = etag
    if request.headers.get("If-None-Match") == etag:
        raise HTTPException(status_code=304)

    output = {}
    ping = json.loads(cache.get("ping:data")) if cache.exists("ping:data") else {}
    for device in ping:
        latency4 = (
            round(ping[device]["v4_rtt"] * 1000, 2)
            if "v4_rtt" in ping[device] and ping[device]["v4_rtt"] is not None
            else None
        )
        latency6 = (
            round(ping[device]["v6_rtt"] * 1000, 2)
            if "v6_rtt" in ping[device] and ping[device]["v6_rtt"] is not None
            else None
        )
        age4 = (
            (time.time() - ping[device]["v4_time"])
            if "v4_time" in ping[device]
            else None
        )
        age6 = (
            (time.time() - ping[device]["v6_time"])
            if "v6_time" in ping[device]
            else None
        )
        output.update(
            {
                device: {
                    "latency4": latency4,
                    "latency6": latency6,
                    "age4": age4,
                    "age6": age6,
                }
            }
        )
    return {"switches": output, "time": cache.get("ping:updated"), "hash": etag}


# ping
@router.get("/switch-state")
async def devices(cache=Depends(get_redis)) -> Ping:
    ping = json.loads(cache.get("ping:data")) if cache.exists("ping:data") else {}
    return {"switches": ping, "time": cache.get("ping:updated"), "hash": ""}
