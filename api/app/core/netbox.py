import os
import pynetbox

from app.core.config import settings

def setup_netbox():
    return pynetbox.api(
        settings.NETBOX_URL,
        token=settings.NETBOX_TOKEN,
        threading=True,
    )

nb = setup_netbox()