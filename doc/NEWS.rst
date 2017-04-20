News - big changes for <event>
==============================

This is the closest thing we have to releases.

TG 18 - Future event
====================

IN PROGRESS:

- Back to basics with deployment on "bare metal" using ansible.

TODO: 

- Graphing that doesn't break down.
- Better mobile-support
- Proper "FAP"-integration, one way or an other.
- Graphing based on polling postgres, not sending data to two different
  places.
- Better configuration infrastructure.
- Easy overview of link utilization for "special" links.
- Option to filter out ports without aliases to reduce bandwidth/storage.

TG 17 - Added during the event
==============================

- "snmpup": Compare "LAG Member" ports with "Uplinks" ports
- Numerous minor tweaks
- Add Virtual Chassis MIBs and attempt to expose them sanely.
- Added tags to override uplink-count (Not intended to be a permanent
  requirement)
- "ping" map-handler now checks if the assigned port on a distro is up if
  an access switch is otherwise down, then suggests a "rollback" if the
  distro sees the switch as alive.
- Probably loads more.

TG 17
=====

- Numerous bug-fixes and tweaks
- Fully fledged internal graphing, powered by Graphite.
- Grafana integrated for dashboards and more drill-downs on graphs.
- Templating added to replace various things, including but not limited to
  FAP's internal templating and switches.txt etc.
- Removed "Score card" (unused)


DX 16
=====

- Numerous bug-fixes and tweaks
- Gondul has been split into a project of its own.
- Oplog - operational log added. Log whatever. Easily.
- "Comments" removed. Replaced by oplog.
- Health map introduced - to replace basically everything. Combines all
  other stats.
- Uplink/trunk ports are marked based on ifAlias now instead of hard-coded
  to match port names.
- Better Cisco-support
- Basic graphs added
- Support for two separate DHCP servers.
- Much better port drill-down, thanks in part to Lasse's work
- Admin page added (might get nuked again)

TG 16
=====

- ???????????????????????????????????????????????????
