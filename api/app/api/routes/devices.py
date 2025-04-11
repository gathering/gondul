from fastapi import APIRouter, HTTPException, Depends

from app.models.device import Placement
from app.api.deps import get_netbox

router = APIRouter(prefix="/v2/devices", tags=["devices"])

# set device placement
@router.post("/{device_name}/placement")
async def set_device_placement(
    device_name, placement: Placement, nb=Depends(get_netbox)
) -> Placement:
    device = nb.dcim.devices.get(name=device_name)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    device["custom_fields"]["gondul_placement"] = placement.dict()
    nb.dcim.devices.update([device])

    return device["custom_fields"]["gondul_placement"]
