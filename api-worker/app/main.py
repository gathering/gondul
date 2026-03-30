from importlib.metadata import metadata
import logging
import time
import threading
import schedule
import queue
import json
import redis
import os

import pynetbox
import random
import requests
import netaddr

from datetime import datetime, timedelta
from ipaddress import IPv4Address, IPv6Address
from pydantic import Field, TypeAdapter
from sqlalchemy import Column, MetaData, Table, create_engine, select
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

from .cache import pool
from .config import settings
from .gondul_models import BaseModel, DeviceManagement, Network, Placement

class GondulDevice(DeviceManagement):
    placement: Placement | None = Field(None, title='Gondul Placement')
    tags: list[str] = Field(list(), title='Tags')
devicesAdapter = TypeAdapter(dict[str, GondulDevice])

class GondulPingData(BaseModel):
    v4_rtt: float | None = Field(None, title='IPv4 ping')
    v6_rtt: float | None = Field(None, title='IPv6 ping')
    v4_time: float | None = Field(None, title='IPv4 ping age (timestamp)') # TODO: serialize to timestamp
    v6_time: float | None = Field(None, title='IPv6 ping age (timestamp)') # TODO: serialize to timestamp
pingAdapter = TypeAdapter(dict[str, GondulPingData])

networkAdapter = TypeAdapter(dict[str, Network])


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

logger.info("Starting API worker")

cache = redis.Redis(
    connection_pool=pool
)

snmp_table_metadata = MetaData()
snmp_table = Table(
    'snmp', snmp_table_metadata,
    Column('time', TIMESTAMP),
    Column('metadata', JSONB),
    Column('data', JSONB),
)
psql_engine = create_engine(settings.PSQL_CONNECTION_STRING)

def _update_cache(key: str, data):
    start_time = time.time()
    logger = logging.getLogger(f"cache_{key}")
    logger.info(f"Updating cache")
    cache.set(f"{key}:updated", round(time.time()))
    cache.set(f"{key}:data", data)
    logger.info(f"Cache updated in %.2f seconds" % (time.time() - start_time))

def get_devices() -> dict[str, GondulDevice]:
    nb = pynetbox.api(
        settings.NETBOX_URL, token=settings.NETBOX_TOKEN, threading=True
    )
    devices: dict[str, GondulDevice] = {}
    for device in nb.dcim.devices.filter(
        role=[
            "access-switch",
            "distro",
            "firewall",
            "internett-ruter",
            "leaf",
            "oob-switch",
            "spine",
        ]
    ):
        # print(device.name)
        distro = None
        uplink = None
        mgmt_vlan = None
        traffic_vlan = None

        lag_id = None

        # Find distro and distro port through the cable connected on uplink ae.
        interfaces = list(nb.dcim.interfaces.filter(device_id=device.id))
        for interface in interfaces:
           if interface["type"]["value"] == "lag":
               lag_id = interface["id"]
               if len(interface["tagged_vlans"]) > 0:
                   mgmt_vlan = interface["tagged_vlans"][0]["name"]
               if len(interface["tagged_vlans"]) > 1:
                   traffic_vlan = interface["tagged_vlans"][1]["name"]
               break

        # if lag_id is not None:
        #    # get first lag member
        #    for interface in interfaces:
        #        if interface["lag"] is not None and interface["lag"]["id"] == lag_id:
        #            distro = interface["lag"]["device"]["name"]
        #            #print(distro)
        #            uplink = interface["name"]
        #            #print(uplink)
        #            break

        placement: Placement
        if "gondul_placement" in device.custom_fields and device.custom_fields["gondul_placement"]:
            _placement = device.custom_fields["gondul_placement"]
            if 'x' not in _placement or _placement['x'] is None:
                _placement['x'] = random.randrange(50, 1400, 20)
            if 'y' not in _placement or _placement['y'] is None:
                _placement['y'] = random.randrange(50, 600, 20)
            placement = Placement(
                x=_placement["x"],
                y=_placement["y"],
                height=_placement["height"],
                width=_placement["width"],
            )
        else:
            _placement = device.custom_fields["gondul_placement"]
            placement = Placement(
                x=_placement["x"],
                y=_placement["y"],
                height=_placement["height"],
                width=_placement["width"],
            )
            if not placement.x:
                placement.x = random.randrange(50, 1400, 20)
            if not placement.y:
                placement.y = random.randrange(50, 600, 20)
            if not placement.height:
                placement.height = 16
            if not placement.width:
                placement.width = 120

        dev = GondulDevice(
                sysname=device.name,
                    mgmt_v4_addr=(
                        IPv4Address(str(netaddr.IPNetwork(device.primary_ip4.address).ip))
                        if device.primary_ip4 is not None
                        else None
                    ),
                    mgmt_v6_addr=(
                        IPv6Address(str(netaddr.IPNetwork(device.primary_ip6.address).ip))
                        if device.primary_ip6 is not None
                        else None
                    ),
                    mgmt_vlan=mgmt_vlan,
                    traffic_vlan=traffic_vlan,
                    last_updated=device.last_updated,
                    distro_name=distro,
                    distro_phy_port=uplink,
                    tags=[tag.slug for tag in list(device.tags)],
                    placement=placement,
                    serial=device.serial,
                    platform=(
                        device.platform.slug if device.platform is not None else None
                    ),
            )

        devices.update(
            {
                device.name: dev,
            }
        )

    return devices

def get_networks() -> dict[str, Network]:
    nb = pynetbox.api(
        settings.NETBOX_URL, token=settings.NETBOX_TOKEN, threading=True
    )
    networks: dict[str, Network] = {}
    for vlan in nb.ipam.vlans.all():
        subnet4 = None
        gw4: IPv4Address | None = None
        subnet6 = None
        gw6: IPv6Address | None = None

        for prefix in nb.ipam.prefixes.filter(vlan_id=vlan.id, family=4):
            if subnet4 is not None or gw4 is not None:
                print(f"Found more than one networks for v4 prefix in vlan={vlan.id}, selected first...")
                break
            net = netaddr.IPNetwork(prefix.prefix)
            subnet4 = prefix.prefix
            gw4 = IPv4Address(netaddr.IPAddress(net.first + 1))

        for prefix in nb.ipam.prefixes.filter(vlan_id=vlan.id, family=6):
            if subnet6 is not None or gw6 is not None:
                print(f"Found more than one networks for v6 prefix in vlan={vlan.id}, selected first...")
                break
            net = netaddr.IPNetwork(prefix.prefix)
            subnet6 = prefix.prefix
            gw6 = IPv6Address(netaddr.IPAddress(net.first + 1))

        network = Network(
            name=vlan.name,
            vlan=vlan.id,
            gw6=gw6,
            gw4=gw4,
            subnet4=subnet4,
            subnet6=subnet6,
            tags=[tag.name for tag in vlan.tags],
        )
        networks[vlan.name] = network

    return networks

# {
#     "ifInErrors":"0",
#     "ifInDiscards":"0",
#     "ifHCInOctets":"0",
#     "ifOutDiscards":"0",
#     "ifName":"ge-0/0/36.0",
#     "ifAdminStatus":"up",
#     "ifOperStatus":"lowerLayerDown",
#     "ifIndex":"588",
#     "ifOutQLen":"0",
#     "ifAlias":"",
#     "ifInUnknownProtos":"0",
#     "ifOutErrors":"0",
#     "ifType":"propVirtual",
#     "ifPhysAddress":"44:f4:77:69:38:67",
#     "ifHighSpeed":"0",
#     "ifDescr":"ge-0/0/36.0",
#     "ifHCOutOctets":"0",
#     "ifLastChange":"6312"
#  }

def getSnmpPorts():
    switches = {}        

    ifIndex = prometheus_query("ifType_info")
    if ifIndex.ok and ifIndex.json()["status"] == "success":
        for metric in ifIndex.json()["data"]["result"]:
            if metric["metric"]["sysname"] not in switches:
                switches[metric["metric"]["sysname"]] = {"ports": {}}
            if metric["metric"]["ifName"] not in switches[metric["metric"]["sysname"]]["ports"]:
                switches[metric["metric"]["sysname"]]["ports"][metric["metric"]["ifName"]] = {}
            switches[metric["metric"]["sysname"]]["ports"][metric["metric"]["ifName"]].update({
                "ifIndex": metric["metric"]["ifIndex"] if "ifIndex" in metric["metric"] else None,
                "ifAlias": metric["metric"]["ifAlias"] if "ifAlias" in metric["metric"] else None,
                "ifName": metric["metric"]["ifName"] if "ifName" in metric["metric"] else None,
                "ifDescr": metric["metric"]["ifDescr"] if "ifDescr" in metric["metric"] else None,
                "ifType": metric["metric"]["ifType"] if "ifType" in metric["metric"] else None,
            })

    ifAdminStatusMapping = {"1": "up", "2": "down"}
    ifAdminStatus = prometheus_query("ifAdminStatus")
    if ifAdminStatus.ok and ifAdminStatus.json()["status"] == "success":
        for metric in ifAdminStatus.json()["data"]["result"]:
            if metric["metric"]["sysname"] not in switches:
                switches[metric["metric"]["sysname"]] = {"ports": {}}
            if metric["metric"]["ifName"] not in switches[metric["metric"]["sysname"]]["ports"]:
                switches[metric["metric"]["sysname"]]["ports"][metric["metric"]["ifName"]] = {}
            switches[metric["metric"]["sysname"]]["ports"][metric["metric"]["ifName"]].update({
                "ifAdminStatus": ifAdminStatusMapping[str(metric["value"][1])]
            })

    # 1-up, 2-down, 3-testing, 4-unknown, 5-dormant, 6-notPresent, 7-lowerLayerDown
    ifOperStatusMapping = {"1": "up", "2": "down", "3": "testing", "4": "unknown", "5": "dormant", "6": "notPresent", "7": "lowerLayerDown"}
    ifOperStatus = prometheus_query("ifOperStatus")
    if ifOperStatus.ok and ifOperStatus.json()["status"] == "success":
        for metric in ifOperStatus.json()["data"]["result"]:
            if metric["metric"]["sysname"] not in switches:
                switches[metric["metric"]["sysname"]] = {"ports": {}}
            if metric["metric"]["ifName"] not in switches[metric["metric"]["sysname"]]["ports"]:
                switches[metric["metric"]["sysname"]]["ports"][metric["metric"]["ifName"]] = {}
            switches[metric["metric"]["sysname"]]["ports"][metric["metric"]["ifName"]].update({
                "ifOperStatus": ifOperStatusMapping[str(metric["value"][1])]
            })
    

    ifHighSpeed = prometheus_query("ifHighSpeed")
    if ifHighSpeed.ok and ifHighSpeed.json()["status"] == "success":
        for metric in ifHighSpeed.json()["data"]["result"]:
            if metric["metric"]["sysname"] not in switches:
                switches[metric["metric"]["sysname"]] = {"ports": {}}
            if metric["metric"]["ifName"] not in switches[metric["metric"]["sysname"]]["ports"]:
                switches[metric["metric"]["sysname"]]["ports"][metric["metric"]["ifName"]] = {}
            switches[metric["metric"]["sysname"]]["ports"][metric["metric"]["ifName"]].update({
                "ifHighSpeed": metric["value"][1]
            })
        
    return switches

def getSnmp():
    output = {}

    sysUpTime = prometheus_query("sysUpTime")
    if sysUpTime.ok and sysUpTime.json()["status"] == "success":
        for metric in sysUpTime.json()["data"]["result"]:
            if metric["metric"]["sysname"] not in output:
                output[metric["metric"]["sysname"]] = {}
            if metric["value"][1] == "0":
                output[metric["metric"]["sysname"]].update(
                    {
                        f'{metric["metric"]["__name__"]}_time': metric["value"][0],
                        f'{metric["metric"]["__name__"]}': None,
                    }
                )
            else:
                output[metric["metric"]["sysname"]].update(
                    {
                        f'{metric["metric"]["__name__"]}_time': metric["value"][0],
                        f'{metric["metric"]["__name__"]}': metric["value"][1],
                    }
                )

    sysName = prometheus_query("sysName")
    if sysName.ok and sysName.json()["status"] == "success":
        for metric in sysName.json()["data"]["result"]:
            if metric["metric"]["sysname"] not in output:
                output[metric["metric"]["sysname"]] = {}
            if metric["value"][1] == "0":
                output[metric["metric"]["sysname"]].update(
                    {
                        f'{metric["metric"]["__name__"]}_time': metric["value"][0],
                        f'{metric["metric"]["__name__"]}': None,
                    }
                )
            else:
                output[metric["metric"]["sysname"]].update(
                    {
                        f'{metric["metric"]["__name__"]}_time': metric["value"][0],
                        f'{metric["metric"]["__name__"]}': metric["metric"]["sysName"],
                    }
                )

    sysDescr = prometheus_query("sysDescr")
    if sysDescr.ok and sysDescr.json()["status"] == "success":
        for metric in sysDescr.json()["data"]["result"]:
            if metric["metric"]["sysname"] not in output:
                output[metric["metric"]["sysname"]] = {}
            if metric["value"][1] == "0":
                output[metric["metric"]["sysname"]].update(
                    {
                        f'{metric["metric"]["__name__"]}_time': metric["value"][0],
                        f'{metric["metric"]["__name__"]}': None,
                    }
                )
            else:
                output[metric["metric"]["sysname"]].update(
                    {
                        f'{metric["metric"]["__name__"]}_time': metric["value"][0],
                        f'{metric["metric"]["__name__"]}': metric["metric"]["sysDescr"],
                    }
                )

    entPhysicalSerialNum = prometheus_query("entPhysicalSerialNum")
    if entPhysicalSerialNum.ok and entPhysicalSerialNum.json()["status"] == "success":
        for metric in entPhysicalSerialNum.json()["data"]["result"]:
            if metric["metric"]["sysname"] not in output:
                output[metric["metric"]["sysname"]] = {}
            if metric["value"][1] == "0":
                output[metric["metric"]["sysname"]].update(
                    {
                        f'{metric["metric"]["__name__"]}_time': metric["value"][0],
                        f'{metric["metric"]["__name__"]}': None,
                    }
                )
            else:
                output[metric["metric"]["sysname"]].update(
                    {
                        f'{metric["metric"]["__name__"]}_time': metric["value"][0],
                        f'{metric["metric"]["__name__"]}': metric["metric"][
                            "entPhysicalSerialNum"
                        ],
                    }
                )

    return output

def prometheus_query(query: str, params={}):
    basic = None
    if settings.PROM_USER and settings.PROM_PASSWORD:
        basic = HTTPBasicAuth(settings.PROM_USER, settings.PROM_PASSWORD)

    return requests.get(
        settings.PROM_URL + "/api/v1/query",
        params={
            "query": query,
            **params,
        },
        auth=basic,
    )


def getPing() -> dict[str, GondulPingData]:
    output: dict[str, GondulPingData] = {}

    probe_icmp_duration_seconds = prometheus_query('probe_icmp_duration_seconds{phase="rtt"}', params={
        "latency_offset": "1ms",
    })

    if (
        probe_icmp_duration_seconds.ok
        and probe_icmp_duration_seconds.json()["status"] == "success"
    ):
        for series in probe_icmp_duration_seconds.json()["data"]["result"]:
            metric = series["metric"]
            sysname = metric["sysname"]
            ip_family = metric["type"]

            value = series["value"]
            ping_time = value[0]
            ping_value = value[1]

            ping_data: GondulPingData

            # ping value is 0 if there was no reply
            if ping_value == "0":
                ping_data = GondulPingData(**{
                    f'{ip_family}_time': ping_time,
                    f'{ip_family}_{metric["phase"]}': None,
                })
            else:
                ping_data = GondulPingData(**{
                    f'{ip_family}_time': ping_time,
                    f'{ip_family}_{metric["phase"]}': float(ping_value),
                })

            if sysname in output:
                existing_ping_data = output[sysname]
                for key, val in ping_data.model_dump().items():
                    # Skip the empty values
                    if not val:
                        continue
                    setattr(existing_ping_data, key, val)
                output.update({sysname: existing_ping_data})
            else:
                output[sysname] = ping_data

    return output

def sql_query(query):
    interval = datetime.utcnow() - timedelta(minutes=15)
    # distinct/order by ifName is a bit hacky for non-ports, but the field exists, so it doesn't hurt..
    q = select(snmp_table) \
            .distinct(snmp_table.c.metadata["target"], snmp_table.c.metadata["ifName"]) \
            .order_by(snmp_table.c.metadata["target"], snmp_table.c.metadata["ifName"], snmp_table.c.time.desc()) \
            .where(snmp_table.c.time >= interval, snmp_table.c.metadata["id"].astext.endswith(f';{query}'))
    with psql_engine.connect() as conn:
        result = conn.execute(q)
        return result.all()

def getSnmpSql():
    rows = sql_query("system")
    output = {}

    for row in rows:
        timestamp = row[0]
        metadata = row[1]
        data = row[2]
        sysname = metadata['id'].split(';')[0]

        if sysname not in output:
            output[sysname] = {}

        for key, val in data.items():
            output[sysname][f'{key}_time'] = timestamp.timestamp()
            output[sysname][key] = val

    return output

def getSnmpPortsSql():
    rows = sql_query("ports")
    output = {}

    for row in rows:
        # timestamp = row[0] # TODO: figure out how ports data deals with timestamp
        metadata = row[1]
        data = row[2]
        sysname = metadata['id'].split(';')[0]
        if_name = metadata['ifName']

        if sysname not in output:
            output[sysname] = {}
            output[sysname]['ports'] = {}

        for key, val in data.items():
            if if_name not in output[sysname]['ports']:
                output[sysname]['ports'][if_name] = {}
            output[sysname]['ports'][if_name][key] = val

    return output


class Job:

    def __init__(self, name, poller_func, interval, dump_adapter: TypeAdapter | None=None) -> None:
        self.jobqueue = queue.Queue()
        self.scheduler = schedule.Scheduler()
        self.stopp = False
        self.name = name
        self.poller_func = poller_func
        self.interval = interval
        self.dump_adapter = dump_adapter

    def run(self):
        while not self.stopp:
            job_func = self.jobqueue.get()
            try:
                data = job_func()
                if self.dump_adapter:
                    _update_cache(self.name, self.dump_adapter.dump_json(data))
                else:
                    if isinstance(data, BaseModel):
                        _update_cache(self.name, json.dumps({sysname: data.model_dump() for sysname, data in data.items()}))
                    else:
                        _update_cache(self.name, json.dumps({sysname: data for sysname, data in data.items()}))
            except Exception as e:
                logger.error(f"{self.name} job failed: {e}")
            self.jobqueue.task_done()

    def ticker(self):
        while not self.stopp:
            self.scheduler.run_pending()
            time.sleep(1)

    def start(self) -> None:
        logger.info(f'starting job {self.name}')
        self.scheduler.every(self.interval).seconds.do(self.jobqueue.put, self.poller_func)
        self.thread = threading.Thread(daemon=True, target=self.run, name=self.name)
        self.thread.start()
        self.ticker_thread = threading.Thread(daemon=True, target=self.ticker, name=f"{self.name}-ticker")
        self.ticker_thread.start()

    def stop(self) -> None:
        logger.info(f'stopping job {self.name}')
        self.stopp = True
        self.thread.join(timeout=5.0)
        if self.thread.is_alive():
            logger.warning('failed stopping thread')

    def add_now(self) -> None:
        logger.info(f'triggering update of {self.name}')
        self.jobqueue.put(self.poller_func)
