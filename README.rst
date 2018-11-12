Gondul - The network monitoring/management system
=================================================

This is the system used to monitor the network during The Gathering (a
computer party with between 5000 and 10000 active clients - see
http://gathering.org). It is now provided as a stand-alone application with
the goal of being usable to any number of computer parties and events of
similar nature. First up of non-TG users was Digitality X 2016
(http://digitalityx.no), taking place in June / July 2016.

Unlike other NMS's, Gondul is not designed to run perpetually, but for a
limited time and needs to be effective with minimal infrastructure in place
as it is used during initial installation of the network.

You should be able to install this on your own for other similar events of
various scales. The system requirements are minimal, but some advise:

- You can run it on a single VM or split it based on roles. Either works.
- The database is used extensively, but careful attention has been paid to
  scaling it sensibly.
- Do not (unless you like high CPU loads) ignore the caching layer
  (Varnish). We use it extensively and are able to invalidate cache
  properly if needed so it is not a hindrance.

Some facts from The Gathering 2016:

- Non-profit.
- 5000+ participants, 400 volunteers/crew, plus numerous visitors.
- Lasted 5 days during the easter of 2016. Tech crew arrived on-site 5 days
  before.
- Total of 10500+ unique network devices seen (unique mac addresses).
- Active network devices at 2016-03-22T12:00:00: 206
- Active network devices at 2016-03-23T08:00:00: 346
- Active network devices at 2016-03-23T20:00:00: 6467
- 180+ switches and routers. Pinged several times per second. Polled for
  SNMP every minute. Every reply (or lack thereof) is kept.
- Collected roughly 300 million database rows, or 30GB of data in postgresql.
- Public NMS and API provided to all participants and the world at large.
- The NMS saw between 200 and 500 requests per second during normal
  operation. Many were 304 "Not Modified".
- 99.99% cache hit rate (Varnish cache size: default 256MB).
- ~300 rows inserted per second. Most of these are COPY() of ping replies
  (thus performs well).
- Biggest CPU hog was the SNMP polling, but not an issue.
- Numerous features developed during the event with no database changes,
  mainly in the frontend, but also tweaking the API.

Name
----

The name comes from the Norse Valkyrie Gondul, also known as the wand
bearer.

Features
--------

Some of Gondul's features are:

- Collects SNMP and ping-data frequently.
- Per-device configurable SNMP polling-interval
- IPv4 and IPv6 support
- Provides per-port statistics.
- Client-counter (based on active DHCP leases)
- Intelligent, easy-to-use and real-time device search based on name,
  description (e.g.: sysDescr, so also software versions/models), serial
  numbers, distribution switches, IP addresses, etc.
- Low-effort operations log with optional device-association, using the
  same search pattern.
- Intelligent health-map that will alert you of any error without
  overloading you with information.

  - All "map handlers" evaluate a device and return a health score from 0
    to 1000 to signify what their opinion of the device's health is.
    Whatever map handler provides the worst score will be shown.
  - Map handlers are trivial to write and exist in pure javascript.
  - Some map handlers include:

    - Latency (v4/v6)
    - Temperature (Cisco and Juniper)
    - SNMP sysname versus database sysname-mismatch
    - DHCP age (where a client subnet is set)
    - Lack of management info (e.g.: missing IPv6 management info)
    - Recent reboots
    - (more)

- Replay capabilities: Easy to review the state of the network as it was at
  any given time Gondul was running. And "fast forward" to real time.
- Modular JavaScript front-end that is reasonably easy to adapt
- Templating (using jinja2 and all data available to Gondul, from
  management information to latency)
- Graphing and dashboards through Graphite
- Huge-ass README that is still not complete.

Current state
-------------

Gondul is used at The Gathering and Digitality X among other places. It was
spun off as a separate project from the big "Tech:Server misc tools" git
repository in 2015. It was also used extensively at The Gathering 2017.

There is no "release" process for the time being since all development is
directly linked to upcoming events and development continues throughout
events.

The current state of deployment is that it is in the middle of a re-design.
As such, the current documentation is slightly out-of-date.

Installation
------------

See ``INSTALLING.rst``.

Architecture
------------

Gondul is split in multiple roles, at the very core is the database server
(postgresql).

The data is provided by three individual data collectors. They are found in
``collectors/``. Two of these can run on any host with database access. The
third, the dhcptailer, need to run on your dhcp server, or some server with
access to the DHCP log. It is picky about log formating (patches welcome).

All three of these collectors provide systemd service-files which should
keep them running even if they fall over. Which they might do if you fiddle
with the database.

In addition to the collectors, there is the API. The API provides three
different sets of endpoints. Two of these are considered moderately
sensitive (e.g.: provides management information and port-specific
statistics), while the third is considered public. The two private API end
points are split into a read-only and write-only name space.

Last is the frontend. This is written entirely in HTML and JavaScript and
interacts with the API. It comes in two minimally different versions: one
public and one "private". The only actual difference should be what they
_try_ to access.

The basic philosophy of Gondul is to have a generic and solid API, a data
base model that is somewhat agnostic to what we collect (so we can add more
interesting SNMP communities on the fly) and a front end that does a lot of
magic.

Recently, graphite/grafana was added, but as it failed to deliver during
The Gathering 2017, the integration is being re-worked slightly. It is
currently non-functional.

APIs
----

See `doc/API.rst`__. 

__ https://github.com/tech-server/gondul/blob/master/doc/API.rst

On the topic of the front-end....
---------------------------------

The front end uses bootstrap and jquery, but not really all that
extensively.

The basic idea is to push a ton of information to the front-end and exploit
modern concepts such as "8MB of data is essentially nothing" and "your
browser actually does client-side caching sensibly" and "it's easier to
develop js than adapt a backend when the need arises". If you look in a
developer console, you will see frequent requests, but if you look closer,
they should almost all be client side cache hits. And those which aren't
can either be 304 Not Modified's or server-side cache hits. Caching is
absolutely crucial to the entire process.

We need more user-documentation though.

Also, the front-end can be somewhat bandwidth intensive. Use gzip. Patches
for variable polling frequency on mobile devices are welcome.

Security
--------

Security is ensured in multiple ways. First of all, database passwords
should obviously be kept secret. It is never visible in the frontend.

Secondly, APIs are clearly separated. Some data is actually duplicated
because it has to be available both in a public API in an aggregated form,
and in detailed form in the private API.

Gondul it self does not implement any actual authentication mechanisms for
the API. That is left up to the web server. An example Apache configuration
file is provided and the default ansible recipies use them.
