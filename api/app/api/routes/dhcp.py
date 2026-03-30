from hashlib import md5

from fastapi import APIRouter, Depends, Request, Response

from app.api.deps import get_cache
from app.core.dhcp import dhcp

router = APIRouter(prefix="/v2/dhcp", tags=["dhcp"])


@router.get("/")
async def get_details():
    return dhcp.get_details()


@router.get("/summary")
async def get_summary():
    return dhcp.get_summary()
