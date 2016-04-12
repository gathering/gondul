# The Gathering Network Management/Monitoring System (tgnms)

This is the system used to monitor the network during The Gathering (a
computer party with between 5000 and 10000 active clients - see
http://gathering.org).

Unlike other NMS's, it is not designed to run perpetually, but for a
limited time and needs to be effective with minimal infrastructure in place
as it is used during initial installation of the network.

You should be able to install this on your own for other similar events of
various scales. The requirements you should expect are:

- During The Gathering 2016, we collected about 30GB of data in postgresql.
- Using a good reverse proxy is crucial to the frontend. We saw between 200
  and 500 requests per second during normal operation of The Gathering
  2016. Varnish operated with a cache hit rate of 99.99%
- The number of database updates to expect will vary depending on dhcp
  requests (so depending on dhcp lease times and clients) and amount of
  equipment. Each switch and linknet with an IP is pinged slightly more
  than once per second. SNMP is polled once a minute by default. You do the
  math.
- We saw about 300 million rows of data at the end of the event in 2016.
  Database indexes are crucial, but handled by default schema. There should
  be no significant performance impact as the data set grows.
- SNMP polling can be slightly CPU intensive, but we still had no issues
  polling about 184 switches.
- Ping and dhcptailer performance is insignificant.

## Name

The name is not final.

I have no idea what it should be, but this one is rather silly :D

## Architecture

TGNMS is split in multiple roles, at the very core is the database server
(postgresql).

The data is provided by three individual data collectors. They are found in
clients/. Two of these can run on any host with database access. The third,
the dhcptailer, need to run on your dhcp server, or some server with access
to the DHCP log. It is picky about log formating (patches welcome).

All three of these clients/collectors should be run in screen/tmux and in a
'while sleep 1; do ./ping... ; done' type of loop. Yeah, we know, it sucks,
but it works remarkably well. Patches are welcome.

In addition to the collectors, there is the API. The API provides three
different sets of endpoints. Two of these are considered moderately
sensitive (e.g.: provides management information and port-specific
statistics), while the third is considered public. The two private API end
points are split into a read-only and write-only name space.

Last is the frontend. This is written entirely in HTML and JavaScript and
interacts with the API. It comes in two minimally different versions: one
public and one "private". The only actual difference should be what they
_try_ to access.

The basic philosophy of tgnms is to have a generic and solid API, a data
base model that is somewhat agnostic to what we collect (so we can add more
interesting SNMP communities on the fly) and a front end that does a lot of
magic.

## Current state

As of this writing, tgnms is being split out of the original 'tgmanage'
repository. This means sweeping changes and breakage. The actual code has
been used in "production" during The Gathering 2016, but is probably broken
right now for simple organizational reasons.

Check back in a week or eight.

## APIs

See web/api/API.rst for now.

## On the topic of the front-end....

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

# Security

Security is ensured in multiple ways. First of all, database passwords
should obviously be kept secret. It is never visible in the frontend.

Secondly, APIs are clearly separated. Some data is actually duplicated
because it has to be available both in a public API in an aggregated form,
and in detailed form in the private API.

The NMS it self does not implement any actual security mechanisms for the
API. That is left up to the web server. An example Apache configuration
file is provided.

