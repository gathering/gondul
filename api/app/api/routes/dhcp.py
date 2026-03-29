from fastapi import APIRouter


router = APIRouter(prefix="/v2/dhcp", tags=["dhcp"])

@router.get("/")
async def get_details():
  pass

@router.get("/summary")
async def get_summary():
  pass
