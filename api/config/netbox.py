import os
import pynetbox
from functools import lru_cache
from dotenv import load_dotenv

@lru_cache
def create_netbox():
    load_dotenv() # take environment variables
    return pynetbox.api(
    os.environ.get('NETBOX_URL'),
    token=os.environ.get('NETBOX_TOKEN'),
    threading=True
)

nb = create_netbox()