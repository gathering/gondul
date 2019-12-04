New approach to Gondul API
==========================

The current api is split in three/four:

- /api/read - read/only access for sensitive data
- /api/public - read/only access for public data
- /api/write - write-only (authenticated)
- /templating or similar - for templating (read/sort-of-write-but-not-quite, sensitive)

Today
-----

(/a/  = /api/, /a/w/ = /api/write/, etc)

- "all" API endponts for reading data supports?when=(date) to adjust what
  the defintion of "now" is, to enable historic review. All end-points
  return ETags calculated using the content of the data returned.

- /a/p/config - this provides information mainly used to determine if this
  is the public variant or not. There was an idea originally to extend this
  with more configuration-data, but it never materialized.

- /a/p/dhcp - returns the dhcp-specific data for each network/traffic VLAN,
  used. Returns both the most recent timestamp and a count of seen leases.

- /a/p/dhcp-summary - returns total number of dhcp leases seen recently.
  Used mainly to show total number of active clients.

- /a/p/distro-tree - returns two structures, distro-tree-phy maps distros
  and their physical ports to access switches ("distro5": { "ge-0/0/4":
  "e13-1" } ), and "distro-tree-sys" maps distros to sysnames and ports
  ("distro5": { "e13-1": "ge-0-0/4" } ). Required to be able to easily look
  up both how ports are connected and how switches are connected.

- /a/p/location - Uses the source-ip of the request to return a HTML page
  that determines which switch the request is made for. Used for "dhcp
  testing"/"dhcp-løp" to ensure switches are actually hooked up correctly
  (e.g.: Hook up to a switch, visit the page, verify that what it tells you
  matches the physical label of the switch)

- /a/p/ping - Returns latency stats for all switches

- /a/p/switches - Returns a subset of the information we have for all
  switches. Only returns public-data.

- /a/p/switch-state - Returns a subset of data from SNMP, parsed and
  filtered, including summaries for port groups like "clients" vs
  "uplinks". Has a good bit of logic for filtering what should and
  shouldn't be shown to the general public.

- /a/r/networks - lists all networks/vlans/layer2 domains we have

- /a/r/oplog - shows the oplog

- /a/r/snmp - show raw snmp-data, no filtering

- /a/r/switches-management - shows config for switches - the unfilitered
  variant of /a/p/switches 

- /a/r/template-list - lists all available templates

- /a/w/collector - simple skogul interface written to receive DHCP log
  data. Should be replaced by an actual skogul instance.

- /a/w/config - write-endpoint for updating event config, rarely used.

- /a/w/networks - add/update networks

- /a/w/oplog - add oplog entries

- /a/w/switches - add/update switches

Changes
-------

The big changes suggested is:

- Remove public interfaces from the "native" API. Consider adding public
  nms as a filtered variant on top instead.

- Do not use paths to distinguish write from read.

- Do not natively deliver "two" data sets. If rates are needed. Make that
  instead.

- Create a new "ifmetrics" concept to extract interface metrics from SNMP
  data, since it can also come from telemetry and other sources.

- Leave all "rate" calculation out of the API. Instead, add integration
  with influxdb under, e.g., /api/rates.

- Option: Support ?then=now-5m or similar, which will then be cacheable,
  and the client can then do two request (implicit ?then=now and a
  ?then=now-1m) and compare.


Actual suggestion
-----------------

I'm fairly convinced about:

- /api/switches - Read/write interface for getting, updating and adding
  switches. Read interface should be as identical to write interface as
  possible.

- /api/switches/some-switch - Similar, but for a single switch.

- /api/networks - Ditto as switches

- /api/networks/some-net - Similar, but for a single net

- /api/oplog - Ditto

- /api/snmp - GET all SNMP data available.

- /api/snmp/some-switch - Get all SNMP data for a single switch

I'm somewhat convinced about:

- /api/ifmetrics - Get all interface metrics - regardless of source. Also
  integrates the logic of "switch-state".

- /api/ifmetrics/some-switch - Get all interface metrics for a single
  switch

- /api/ifmetrics/some-switch/port - Get metrics for a specific interface
  for a specific switch.

Less sure:

- /api/templates/ - List all templates

- /api/templates/some-template - GET/POST uncompiled template. Should be
  git-backed.

- /api/t/some-template - GET the compiled template

- /api/collector/{name} - POST url for relevant collector. Uses Skogul
  JSON format (and implementation).

- /api/collector/{dhcp,snmp,telemetry,ping,generic} - Some examples, where
  "generic" will allow us to accept any data, and just stick it in some
  general-purpose format or something. I have some more ideas about that.

I also believe we should strive to implement something for time series,
very dumbed down. E.g.: hardocded a set of time series queries we support.
We should strive to support "what is the current rate of an interface". I'm
thinking:

- /api/rates/some-switch - rates for all interfaces on a switch

- /api/rates/some-switch/port - rates for a specific interface

This will also allow us to white-list by interface if we need password-less
authentication....

We could also consider implementing https://grafana.com/grafana/plugins/grafana-simple-json-datasource

Progress
--------

We should get a basic API up in GO pretty fast, focusing on a single
end-point and get it right. E.g.: Get /api/switches right from the start.
All the 1-to-1 API-to-DB-table interfaces should be pretty much identical
code-wise.

Next up is probably ping, simply because it is, well, simple. It means
re-factoring the collector to do HTTP POST, but that's a minor issue.

Then I believe tackling SNMP and interfaces is important. 
