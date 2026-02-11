import time
import threading
import schedule
import queue
import json
import redis
import os

import pynetbox
import random
import netaddr

import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

cache = redis.Redis(
    connection_pool=redis.ConnectionPool(
        host=os.environ.get("REDIS_HOST", "localhost"),
        port=os.environ.get("REDIS_PORT", 6379),
        db=os.environ.get("REDIS_DB", 0),
        decode_responses=True,
    )
)

nb = pynetbox.api(
    os.environ.get("NETBOX_URL"), token=os.environ.get("NETBOX_TOKEN"), threading=True
)


def get_devices():
    devices = {}
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
        # interfaces = list(nb.dcim.interfaces.filter(device_id=device.id))
        # for interface in interfaces:
        #    if interface["type"]["value"] == "lag":
        #        lag_id = interface["id"]
        #        if len(interface["tagged_vlans"]) > 0:
        #            mgmt_vlan = interface["tagged_vlans"][0]["name"]
        #        if len(interface["tagged_vlans"]) > 1:
        #            traffic_vlan = interface["tagged_vlans"][1]["name"]
        #        break

        # if lag_id is not None:
        #    # get first lag member
        #    for interface in interfaces:
        #        if interface["lag"] is not None and interface["lag"]["id"] == lag_id:
        #            distro = interface["lag"]["device"]["name"]
        #            #print(distro)
        #            uplink = interface["name"]
        #            #print(uplink)
        #            break

        if "gondul_placement" not in device.custom_fields or device.custom_fields["gondul_placement"] is None:
            placement = {
                "height": 16,
                "x": random.randrange(50, 1400, 20),
                "y": random.randrange(50, 600, 20),
                "width": 120,
            }
        else:
            placement = device.custom_fields["gondul_placement"]
            if "x" not in placement or placement["x"] is None:
                placement["x"] = random.randrange(50, 1400, 20)
            if "y" not in placement or placement["y"] is None:
                placement["y"] = random.randrange(50, 600, 20)
            if "height" not in placement or placement["height"] is None:
                placement["height"] = 16
            if "width" not in placement or placement["width"] is None:
                placement["width"] = 120

        devices.update(
            {
                device.name: {
                    "sysname": device.name,
                    "mgmt_v4_addr": (
                        str(netaddr.IPNetwork(device.primary_ip4.address).ip)
                        if device.primary_ip4 is not None
                        else None
                    ),
                    "mgmt_v6_addr": (
                        str(netaddr.IPNetwork(device.primary_ip6.address).ip)
                        if device.primary_ip6 is not None
                        else None
                    ),
                    "mgmt_vlan": mgmt_vlan,
                    "traffic_vlan": traffic_vlan,
                    "last_updated": device.last_updated,
                    "distro_name": distro,
                    "distro_phy_port": uplink,
                    "tags": [tag.slug for tag in list(device.tags)],
                    "placement": placement,
                    "serial": device.serial,
                    "platform": (
                        device.platform.slug if device.platform is not None else None
                    ),
                }
            }
        )

    return devices


def generateDevices():
    start_time = time.time()
    print("Updating device cache")
    cache.set("devices:updated", round(time.time()))
    cache.set("devices:data", json.dumps(get_devices()))
    print("Device cache updated")
    print("--- %s seconds ---" % (time.time() - start_time))

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
    basic = HTTPBasicAuth(os.environ.get("PROM_USER"), os.environ.get("PROM_PASSWORD"))
    prom_url = os.environ.get("PROM_URL")

    ifIndex = requests.get(
        prom_url + "/api/v1/query",
        params={"query": "ifType_info"},
        auth=basic
    )
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
    ifAdminStatus = requests.get(
        prom_url + "/api/v1/query",
        params={"query": "ifAdminStatus"},
        auth=basic
    )
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
    ifOperStatus = requests.get(
        prom_url + "/api/v1/query",
        params={"query": "ifOperStatus"},
        auth=basic
    )
    if ifOperStatus.ok and ifOperStatus.json()["status"] == "success":
        for metric in ifOperStatus.json()["data"]["result"]:
            if metric["metric"]["sysname"] not in switches:
                switches[metric["metric"]["sysname"]] = {"ports": {}}
            if metric["metric"]["ifName"] not in switches[metric["metric"]["sysname"]]["ports"]:
                switches[metric["metric"]["sysname"]]["ports"][metric["metric"]["ifName"]] = {}
            switches[metric["metric"]["sysname"]]["ports"][metric["metric"]["ifName"]].update({
                "ifOperStatus": ifOperStatusMapping[str(metric["value"][1])]
            })
    

    ifHighSpeed = requests.get(
        prom_url + "/api/v1/query",
        params={"query": "ifHighSpeed"},
        auth=basic
    )
    if ifHighSpeed.ok and ifHighSpeed.json()["status"] == "success":
        for metric in ifHighSpeed.json()["data"]["result"]:
            if metric["metric"]["sysname"] not in switches:
                switches[metric["metric"]["sysname"]] = {"ports": {}}
            if metric["metric"]["ifName"] not in switches[metric["metric"]["sysname"]]["ports"]:
                switches[metric["metric"]["sysname"]]["ports"][metric["metric"]["ifName"]] = {}
            switches[metric["metric"]["sysname"]]["ports"][metric["metric"]["ifName"]].update({
                "ifHighSpeed": metric["value"][1]
            })
        
    cache.set("snmp:ports:updated", round(time.time()))
    cache.set("snmp:ports:data", json.dumps(switches))
            
def getSnmp():
    output = {}

    basic = HTTPBasicAuth(os.environ.get("PROM_USER"), os.environ.get("PROM_PASSWORD"))
    prom_url = os.environ.get("PROM_URL")
    sysUpTime = requests.get(
        prom_url + "/api/v1/query",
        params={"query": "sysUpTime"},
        auth=basic,
    )
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

    sysName = requests.get(
        prom_url + "/api/v1/query",
        params={"query": "sysName"},
        auth=basic,
    )
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

    sysDescr = requests.get(
        prom_url + "/api/v1/query",
        params={"query": "sysDescr"},
        auth=basic,
    )
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

    entPhysicalSerialNum = requests.get(
        prom_url + "/api/v1/query",
        params={"query": "entPhysicalSerialNum"},
        auth=basic,
    )
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

    cache.set("snmp:updated", round(time.time()))
    cache.set("snmp:data:data", json.dumps(output))


def getPing():
    output = {}

    basic = HTTPBasicAuth(os.environ.get("PROM_USER"), os.environ.get("PROM_PASSWORD"))
    prom_url = os.environ.get("PROM_URL")
    probe_icmp_duration_seconds = requests.get(
        prom_url + "/api/v1/query",
        params={
            "query": 'probe_icmp_duration_seconds{phase="rtt"}',
            "latency_offset": "1ms",
        },
        auth=basic,
    )
    if (
        probe_icmp_duration_seconds.ok
        and probe_icmp_duration_seconds.json()["status"] == "success"
    ):
        for metric in probe_icmp_duration_seconds.json()["data"]["result"]:
            if metric["metric"]["sysname"] not in output:
                output[metric["metric"]["sysname"]] = {}
            if metric["value"][1] == "0":
                output[metric["metric"]["sysname"]].update(
                    {
                        f'{metric["metric"]["type"]}_time': metric["value"][0],
                        f'{metric["metric"]["type"]}_{metric["metric"]["phase"]}': None,
                    }
                )
            else:
                output[metric["metric"]["sysname"]].update(
                    {
                        f'{metric["metric"]["type"]}_time': metric["value"][0],
                        f'{metric["metric"]["type"]}_{metric["metric"]["phase"]}': float(
                            metric["value"][1]
                        ),
                    }
                )

    cache.set("ping:updated", round(time.time()))
    cache.set("ping:data", json.dumps(output))


# DCIM
def dcim_main():
    while 1:
        job_func = dcim_jobqueue.get()
        job_func()
        dcim_jobqueue.task_done()


dcim_jobqueue = queue.Queue()
dcim_scheduler = schedule.Scheduler()
dcim_scheduler.every(60).seconds.do(dcim_jobqueue.put, generateDevices)
dcim_worker_thread = threading.Thread(daemon=True, target=dcim_main)
dcim_worker_thread.start()


# Ping
def ping_main():
    while 1:
        job_func = ping_jobqueue.get()
        job_func()
        ping_jobqueue.task_done()


ping_jobqueue = queue.Queue()
ping_scheduler = schedule.Scheduler()
ping_scheduler.every(1).seconds.do(ping_jobqueue.put, getPing)
ping_worker_thread = threading.Thread(daemon=True, target=ping_main)
ping_worker_thread.start()


# Snmp
def snmp_main():
    while 1:
        job_func = snmp_jobqueue.get()
        job_func()
        snmp_jobqueue.task_done()


snmp_jobqueue = queue.Queue()
snmp_scheduler = schedule.Scheduler()
snmp_scheduler.every(5).seconds.do(snmp_jobqueue.put, getSnmp)
snmp_scheduler.every(5).seconds.do(snmp_jobqueue.put, getSnmpPorts)
snmp_worker_thread = threading.Thread(daemon=True, target=snmp_main)
snmp_worker_thread.start()

# Main loop
while 1:
    dcim_scheduler.run_pending()
    ping_scheduler.run_pending()
    snmp_scheduler.run_pending()
    time.sleep(1)
