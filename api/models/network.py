from pydantic import BaseModel
import ipaddress

# name, vlan, networks.tags, switches.sysname as router, subnet4, subnet6, gw4, gw6
class Network(BaseModel):
    name: str = "switches-mgmt"
    vlan: int | None = 1337
    tags: list[str] = []
    subnet4: ipaddress.IPv4Network | None = "198.51.100.0/24"
    subnet6: ipaddress.IPv6Network | None = "2001:db8:5b96::/64"
    gw4: ipaddress.IPv4Address | None = "198.51.100.1"
    gw6: ipaddress.IPv6Address | None = "2001:db8:5b96::1"
    
class Networks(BaseModel):
    networks: dict[str, Network]
    time: int | None = None
    hash: str | None = None