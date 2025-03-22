from fastapi import APIRouter, Depends, Request, Response, HTTPException
import json
import hashlib

from models.device import DeviceManagement, DevicesManagement
from models.network import Network, Networks
from models.snmp import Snmp
from models.oplog import Oplog
from dependencies import get_redis

router = APIRouter(
    prefix="/api/read",
    tags=["read"]
)

# switches-management
@router.get("/switches-management")
async def devices(request: Request, response: Response, cache = Depends(get_redis)) -> DevicesManagement:
    updated = cache.get('devices:updated')
    etag = None
    if updated is not None:
        etag = hashlib.md5(updated.encode('utf-8')).hexdigest()
        response.headers["etag"] = etag
    if(request.headers.get('If-None-Match') == etag):
        raise HTTPException(status_code=304)
    
    devices = json.loads(cache.get('devices:data')) if cache.exists('devices:data') else {}
    return {
        "switches": { device: { key: devices[device][key] for key in list(DeviceManagement.__fields__.keys()) } for device in devices },
        "time": cache.get('devices:updated'),
        "hash": etag
    }
    
# networks
@router.get("/networks")
async def networks(cache = Depends(get_redis)) -> Networks:
    devices = json.loads(cache.get('networks:data')) if cache.exists('networks:data') else {}
    return {
        "networks": { device: { key: devices[device][key] for key in list(Network.__fields__.keys()) } for device in devices },
        "time": cache.get('networks:updated'),
        "hash": ""
    }

# snmp
@router.get("/snmp")
async def snmp(cache = Depends(get_redis)) -> Snmp:
    snmp = json.loads(cache.get('snmp:data')) if cache.exists('snmp:data') else {}
    return {
        "snmp": snmp,
        "time": cache.get('snmp:updated'),
        "hash": ""
    }
    
# oplog
@router.get("/oplog")
async def oplog(request: Request, response: Response, cache = Depends(get_redis)) -> Oplog:
    updated = cache.get('oplog:updated')
    etag = None
    if updated is not None:
        etag = hashlib.md5(updated.encode('utf-8')).hexdigest()
        response.headers["etag"] = etag
    if(request.headers.get('If-None-Match') == etag):
        raise HTTPException(status_code=304)    

    oplog = json.loads(cache.get('oplog:data')) if cache.exists('oplog:data') else []
    return {
        "oplog": oplog,
        "time": updated,
        "hash": etag
    }