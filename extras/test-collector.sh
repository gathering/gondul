#!/bin/bash

POST http://localhost:80/api/write/collector  <<_EOF_

{
   "src": "dhcp",
   "metadata":  {
      "server": "dhcpserver1"
   },
   "data": [
      {
         "type": "assignment",
         "time": "2001-01-01T15:12:01Z",
         "ip": "2001:db8::1",
         "circuit": "vlan123:e3-1:ge-0/0/1",
         "msg": "blatti foo"
      }, 
      {
         "type": "renew",
         "time": "2001-01-01T15:32:01Z",
         "ip": "2001:db8::1",
         "circuit": "vlan123:e3-1:ge-0/0/1",
         "msg": "blatti foo something"
      } 
   ]
}
_EOF_


POST http://localhost:80/api/write/collector  <<_EOF_
{
  "src": "dhcp",
  "metadata": {
    "server": "dhcp.tg.lol"
  },
  "data": [
    {
      "clientip": "127.27.36.162",
      "clientmac": "0e:74:14:1f:ce:e2",
      "clientname": "WIN-8KE6TTQA821",
      "leasetime": 120,
      "circuitid": "ge-0/0/1.0:1011",
      "time": "2019-02-13T22:21:27.195685448+01:00"
    }
  ]
}
_EOF_
