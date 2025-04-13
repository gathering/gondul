from fastapi import APIRouter

from app.api.routes import utils, public, prometheus, oplog, read, devices

api_router = APIRouter()
api_router.include_router(utils.router)
api_router.include_router(public.router)
api_router.include_router(prometheus.router)
api_router.include_router(oplog.router)
api_router.include_router(read.router)
api_router.include_router(devices.router)
