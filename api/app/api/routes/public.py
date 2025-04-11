from fastapi import APIRouter, Request, Response, HTTPException, Depends
import json
import time
import hashlib

from app.core.config import settings
from app.models.config import Config
from app.models.device import PublicDevice, PublicDevices
from app.models.ping import Ping
from app.api.deps import get_cache

router = APIRouter(prefix="/api/public", tags=["public"])

# config
@router.get("/config")
async def config(request: Request, response: Response) -> Config:
    # TODO Read from settings
    config = {
        "sitename": f"{settings.PROJECT_NAME} - {settings.ENVIRONMENT}",
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
    request: Request, response: Response, cache=Depends(get_cache)
) -> PublicDevices:
    updated = cache.get("devices:updated")
    etag = None
    if updated is not None:
        etag = hashlib.md5(updated.encode("utf-8")).hexdigest()
        response.headers["etag"] = etag
    if etag is not None and request.headers.get("If-None-Match") == etag:
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
async def ping(
    request: Request, response: Response, cache=Depends(get_cache)
) -> Ping:
    updated = cache.get("ping:updated")
    etag = None
    if updated is not None:
        etag = hashlib.md5(updated.encode("utf-8")).hexdigest()
        response.headers["etag"] = etag
    if etag is not None and request.headers.get("If-None-Match") == etag:
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

# Not implemented
@router.get("/switch-state")
async def switch_state():
    return {}
