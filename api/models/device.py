from pydantic import BaseModel
import ipaddress

class Placement(BaseModel):
    x: int
    y: int
    height: int
    width: int

class PublicDevice(BaseModel):
    distro_name: str | None = None
    tags: list[str] = []
    placement: Placement | None = None

class PublicDevices(BaseModel):
    switches: dict[str, PublicDevice]
    time: int | None = None
    hash: str | None = None

class DeviceInterface(BaseModel):
    name: str
    descr: str
    type: str

class DeviceManagement(BaseModel):
    sysname: str = "e1-1"
    serial: str | None = None
    platform: str | None = None
    mgmt_v4_addr: ipaddress.IPv4Address | None = None
    mgmt_v6_addr: ipaddress.IPv6Address | None = None
    mgmt_vlan: str | None = None
    traffic_vlan: str | None = None
    last_updated: str | None = None
    distro_name: str | None = None
    distro_phy_port: str | None = None
    #interfaces: dict[str, DeviceInterface]

class DevicesManagement(BaseModel):
    switches: dict[str, DeviceManagement]
    time: int | None = None
    hash: str | None = None
