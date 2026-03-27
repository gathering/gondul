from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, Response, Request
import redis
import hashlib

from .cache import pool
from .main import Job, get_devices, getPing, getSnmp, getSnmpPorts, devicesAdapter, getSnmpPortsSql, getSnmpSql, pingAdapter

def get_cache():
    return redis.Redis(connection_pool=pool)

jobs = {
    "devices": Job("devices", get_devices, 6, dump_adapter=devicesAdapter),
    "ping": Job("ping", getPing, 1, dump_adapter=pingAdapter),
    "snmp": Job("snmp", getSnmpSql, 5),
    "snmp:ports": Job("snmp:ports", getSnmpPortsSql, 5),
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    for _, job in jobs.items():
        job.start()

    yield

    # stop things before we shut down
    for _, job in jobs.items():
        job.stop()

app = FastAPI(lifespan=lifespan)

@app.post('/update/device/{device}')
async def update_device(device: str, request: Request, response: Response, cache=Depends(get_cache)):
    if not request.headers.get("If-None-Match"):
        raise HTTPException(status_code=400, detail="Set 'If-None-Match' to the etag value you currently have, so we know if we have to update or not")

    updated = cache.get("devices:updated")
    etag = None
    if updated is not None:
        etag = hashlib.md5(updated.encode("utf-8")).hexdigest()
        response.headers["etag"] = etag
    if request.headers.get("If-None-Match") == etag:
        raise HTTPException(status_code=304)
    jobs["devices"].add_now()
    return {"ok": "ok", "device": device}
