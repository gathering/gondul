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
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

cache = redis.Redis(connection_pool=redis.ConnectionPool(
    host=os.environ.get('REDIS_HOST', 'localhost'), 
    port=os.environ.get('REDIS_PORT', 6379), 
    db=os.environ.get('REDIS_DB', 0), 
    decode_responses=True
  ))

nb = pynetbox.api(
    os.environ.get('NETBOX_URL'),
    token=os.environ.get('NETBOX_TOKEN'),
    threading=True
)

def get_devices():
    devices = {}
    for device in nb.dcim.devices.filter(role=["access-switch", "distro", "firewall", "internett-router", "leaf", "oob-switch", "spine"]):
        #print(device.name)
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
                
        if lag_id is not None:
            # get first lag member
            for interface in interfaces:
                if interface["lag"] is not None and interface["lag"]["id"] == lag_id:
                    distro = interface["lag"]["device"]["name"]
                    #print(distro)
                    uplink = interface["name"]
                    #print(uplink)
                    break

        if device.custom_fields["gondul_placement"] is None:
            placement = {"height":16,"x":random.randrange(50,1400,20),"y":random.randrange(50,600,20),"width":120}
        else:
            placement = device.custom_fields["gondul_placement"]
            if "x" not in placement:
                placement["x"] = random.randrange(50,1400,20)
            if "y" not in placement:
                placement["y"] = random.randrange(50,600,20)
            if "height" not in placement:
                placement["height"] = 16
            if "width" not in placement:
                placement["width"] = 120
                            
        devices.update({device.name: {
            "sysname": device.name,
            "mgmt_v4_addr": str(netaddr.IPNetwork(device.primary_ip4.address).ip) if device.primary_ip4 is not None else None,
            "mgmt_v6_addr": str(netaddr.IPNetwork(device.primary_ip6.address).ip) if device.primary_ip6 is not None else None,
            "mgmt_vlan": mgmt_vlan,
            "traffic_vlan": traffic_vlan,
            "last_updated": device.last_updated,
            "distro_name": distro,
            "distro_phy_port": uplink,
            "tags": [tag.slug for tag in list(device.tags)],
            "placement": placement
        }})

    return devices

def generateDevices():
    start_time = time.time()
    #print("Updating device cache")
    cache.set('devices:updated', round(time.time()))
    cache.set('devices:data', json.dumps(get_devices()))
    #print("Device cache updated")
    #print("--- %s seconds ---" % (time.time() - start_time))
    
    
def getSnmp():
    pass
    
def getPing():
    # gondul ouput
    #output = {
    #    "switch": {"ping": { "success": True, "v4_rtt": 0.00001, "v6_rtt": 0.0000009 }, "cvp": { "success": True, "latency": 0.6121 } }
    #}
    
    output = {"switch": { "success": True, "v4_rtt": 0.00001, "v6_rtt": 0.0000009 }}
    
    probe_success = requests.get("http://localhost:9090" + '/api/v1/query', params={'query': 'probe_success'})
    probe_icmp_duration_seconds = requests.get("http://localhost:9090" + '/api/v1/query', params={'query': 'probe_icmp_duration_seconds{phase="rtt"}'})
    
    if probe_success.ok and probe_success.json()["status"] == "success":
        for metric in probe_success.json()["data"]["result"]:
            print(f'{metric["metric"]["sysname"]}: {metric["value"][1]} ({metric["value"][0]})')
            print(datetime.fromtimestamp(metric["value"][0]).strftime('%Y-%m-%d %H:%M:%S'))
        pass
    pass

# DCIM
def dcim_main():
    while 1:
        job_func = dcim_jobqueue.get()
        job_func()
        dcim_jobqueue.task_done()

dcim_jobqueue = queue.Queue()
dcim_scheduler = schedule.Scheduler()
dcim_scheduler.every(5).seconds.do(dcim_jobqueue.put, generateDevices)
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
snmp_scheduler.every(30).seconds.do(snmp_jobqueue.put, getSnmp)
snmp_worker_thread = threading.Thread(daemon=True, target=snmp_main)
snmp_worker_thread.start()

# Main loop
while 1:
    dcim_scheduler.run_pending()
    ping_scheduler.run_pending()
    snmp_scheduler.run_pending()
    time.sleep(1)