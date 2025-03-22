from fastapi import APIRouter, Depends, Request, Response, HTTPException
import json
import hashlib

from ..dependencies import get_redis

router = APIRouter(
    prefix="/api/prometheus",
    tags=["prometheus"]
)

[
  {
    "targets": [ "<host>", ... ],
    "labels": {
      "<labelname>": "<labelvalue>",
    }
  },
]

#
@router.get("/")
async def devices(request: Request, response: Response, cache = Depends(get_redis)):
    updated = cache.get('devices:updated')
    etag = None
    if updated is not None:
        etag = hashlib.md5(updated.encode('utf-8')).hexdigest()
        response.headers["etag"] = etag
    if(request.headers.get('If-None-Match') == etag):
        raise HTTPException(status_code=304)
    
    output = []
    
    devices = json.loads(cache.get('devices:data')) if cache.exists('devices:data') else {}
    for sysname in devices:
        device = devices[sysname]
        if device["mgmt_v4_addr"]:
            output.append({
                "targets": [device["mgmt_v4_addr"]],
                "labels": {
                    "sysname": device["sysname"],
                    "type": "v4"
                }
            })
        if device["mgmt_v6_addr"]:
            output.append({
                "targets": [device["mgmt_v6_addr"]],
                "labels": {
                    "sysname": device["sysname"],
                    "type": "v6"
                }
            })
    return output
