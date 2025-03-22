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

cache = redis.Redis(connection_pool=redis.ConnectionPool(
    host=os.environ.get('REDIS_HOST', 'localhost'), 
    port=os.environ.get('REDIS_PORT', 6379), 
    db=os.environ.get('REDIS_DB', 0), 
    decode_responses=True
  ))
nb = pynetbox.api(
    'https://netbox.tg25.tg.no',
    token='c49232497b8c8b966be0365f5335669b524cb190',
    threading=True
)

def get_devices():
    devices = {}
    for device in nb.dcim.devices.filter(role=["access-switch", "distro", "firewall", "inet-router", "leaf", "oob-switch", "spine"]):
        print(device.name)
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
                    print(distro)
                    uplink = interface["name"]
                    print(uplink)
                    break
                            
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
            #"placement": device.custom_fields["gondul_placement"]
            "placement": {"height":120,"x":random.randrange(50,1400,20),"y":random.randrange(50,600,20),"width":16}
        }})

    return devices

def generateDevices():
    start_time = time.time()
    print("Updating device cache")
    cache.set('devices:updated', round(time.time()))
    cache.set('devices:data', json.dumps(get_devices()))
    print("Device cache updated")
    print("--- %s seconds ---" % (time.time() - start_time))
    
    
def getSnmp():
    pass
    
def getPing():
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