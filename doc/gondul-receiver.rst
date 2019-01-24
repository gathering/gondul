
================================
API for receiving time-base data
================================

Background
==========

Toda, Gondul has three different "collectors". The ping-collector, the
snmp-collector and the dhcp log-tailer.

They all write data directly to the postgres backend.

Over the years we've tried different methods of storing time series data for
actual graphs. To support this, we've stored some data in two sources. Most
recently, we've stored stuff in postgres and influxdb. 

In addition to actually storing this data in different locations, we some
times need to "massage" data, or change the database schema. A prime example
for SNMP is to actually establish a tree-structure for port-data by picking
up ifTable and ifXTable and building a "ports"-tree using ifIndex. An other
example is normalization of MAC addresses for example.

We also need to do something with Virtual Chassis MIBs.

While we've been able to do all this, the fact that these collectors all
write directly to the postgres database creates a strong cross-dependency
between the collectors, the database schema and the API. It has also created
a strong depenendency to time series database tools.

This has made it difficult to safely experiment with enriching input-data
without introducing critical bugs in collectors or breaking the north-bound
API.

This document outlines a way to reduce this problem.

Concept
=======

The concept is to create a generic "time-based" API for all time-oriented
data. The API will cover high-frequency producers like the ping collector,
but also low-frequency producers like the operations log, or the DHCP
tailer.

While the API will be generic, it will provide just enough data to allow the
receiver to identify the type of data and apply enrichments to it and thus
treat it diffrently. By default, the data posted will just be written to
postgres, but through enrichment add-ons, we can also chose to split a
single SNMP poll into multiple entries (e.g.: individual entries for virtual
chassis nodes), or re-arrange the data to produce interface-mapping.

The enrichment will also be able to do basically anything with the data,
including sending it to multiple other APIs - e.g. influx.

While the first version does not deal with authentication, future versions
should.

Core API
========

The core API accepts N or more metrics in a single post.

The core of the API will accept 3 fields:

- `source` - a text-string identifying the source of the data, e.g. "dhcp",
  "ping", "snmp". This should be sent either as a json text field, or as
  part of the url. E.g., allow posting to
  ``https://user:pass@gondul/api/write/gtimes/dhcp`` . The benefit of
  linking this with the URL is that it will simplify authentication in the
  future, allowing "write-only" accounts.
- `metadata` - this is a generic JSON object that contain a number of fields
  that will be indexed upon or used by enrichment. Example: ``{ "server":
  "dhcpserver1", "time": "2019-01-05T15:00:10Z" }``. 
- `data` - an array of json-objects. Each object in the array must either
  have a "time" field or the "metadata"-field must have a time field.


Examples
========

Example 1, dhcp::

   {
      src: "dhcp",
      metadata:  {
         server: "dhcpserver1"
      },
      data: [
         {
            type: "assignment",
            time: "2001-01-01T15:12:01Z",
            ip: "2001:db8::1",
            circuit: "vlan123:e3-1:ge-0/0/1",
            msg: "blatti foo"
         }, 
         {
            type: "renew",
            time: "2001-01-01T15:32:01Z",
            ip: "2001:db8::1",
            circuit: "vlan123:e3-1:ge-0/0/1",
            msg: "blatti foo something"
         } 
      ]
   }

Example 2, ping::

   {
      "src": "ping",
      "metadata":  {
         "time": "2019-05-01T15:01:12Z"
      },
      "data": [
         { "s": "e1-3", "l": 0.91211 },
         { "s": "e1-2", "l": 0.12211 },
         { "s": "e1-1", "l": 0.12311 },
         { "s": "e3-1", "l": 1.12111 },
         { "s": "e3-2", "l": null },
         { "s": "e3-3", "l": 0.91211 },
         { "s": "e3-4", "l": 0.91211 }
      ]
   }

Example 3, oplog::

   {
      "src": "oplog",
      "data": [
         {
            "system": "floor",
            "user": "kristian",
            "message": "lol",
            "time": "2019-04-19T15:00:10Z"
         }
      ]
   }

Note that "metadata" is optional.

Implementation plan
===================

The plan would be to start small. The first candidate is the dhcp log
tailer, which needs to support IPv6 and thus needs a change.

The first implementation would be a "hard-coded" perl API since that is what
we already have. There is no current  plan to migrate other producers to the
new API at this time.

The first implementation would not offer much in the way of generic storage
for other users than the dhcp collector.

Since particularly the ping collector can produce quite a lot of data, some
care might be needed to support it. This will most likely require a
different apporach than the old CGI-based perl way of doing things. 

To allow a flexible enrichment-scheme, it might be necessarry to implement a
separate service in a more modern language. There are currently three worthy
alternatives: 

Node.js has the benefit of using JavaScript which is already heavily used in
Gondul, and is fairly fault-tolerant. There are also already plans to
utilize node.js to do server-side parsing of health data. However, I'm
unsure if it offers the speed or integration we need.

Python is an other alternative, which is also already used. It is slightly
more mature than Node.js, but also doesn't really offer much else.

The third alternative is Go, which will certainly provide us with the speed
we need, but might not allow the development pace we require during an
event.

No conclusion is offered and at any rate, no plans to actually implement
such a service exist nor should one be planned until we have more experience
from the DHCP-collector implementation.

Storage
=======

Storage is deliberately left OUT of the API definition, but for
implementation-purposes we should assume postgres as the primary target with
influx as a sencodary target. Details of how this is done is intentionally
left out of this document as this should not be relevant to any user of the
API.

