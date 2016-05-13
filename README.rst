Gondul - The network monitoring/management system
=================================================

This is the system used to monitor the network during The Gathering (a
computer party with between 5000 and 10000 active clients - see
http://gathering.org). It is now provided as a stand-alone application with
the goal of being usable to any number of computer parties and events of
similar nature. First up of non-TG users is Digitality X 2016
(http://digitalityx.no), scheduled for June / July 2016.

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
- Lasted 5 days during the easter of 2106. Tech crew arrived on-site 5 days
  before.
- Total of 10500+ unique network devices seen (unique mac addresses).
- Active network devices at 2016-03-22T12:00:00: 206
- Active network devices at 2016-03-23T08:00:00: 346
- Active network devices at 2016-03-23T20:00:00: 6467
- 180+ switches and routers. Pinged seceral times per second. Polled for
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

Current state
-------------

Gondul was recently split out from the original 'tgmanage' repository used
for all Tech:Server-related project at The Gathering.

The basic split from the original tgmanage repo is done and much of the
name changing is done. The repository works well for general development of
frontend code now. You should, however, expect significant changes leading
up to and including Digitality X 2016.

Installation
------------

We are re-doing the installation to production at present. Stay tuned.

For now, see the Testing-chapter.

Testing
-------

There is basic test and development infrastructure set up in
``build/`` and ``ansible/``. It uses Docker and Ansible.

To use it, first set up docker and install Ansible, then run::

        $ ansible-playbook -i ansible/inventory-localhost ansible/playbook-test.yml

This will build the relevant Docker images, start them and run a very
simple tests to see that the front works. It does some hacks to detect PWD
(...), but does not use sudo/root and makes no attempt at configuring the
host beyond interacting with docker images and containers.

It will build and run 5 containers:

- gondul-db-test - Database
- gondul-front-test -  Frontend (apache)
- gondul-varnish-test - Varnish
- gondul-ping-test - Collector with ping
- gondul-snmp-test - Collector with snmp AND an snmpd running on 127.0.0.1

The IP of the Varnish instance and apache/frontend is reported and can be
used. The credentials used are 'demo/demo'. For development of
javascript/html it is best to use the apache frontend, for API changes it
is best to test with the Varnish frontend to ensure your API endpoints
behave well behind a cache.

The repository is mounted as a docker volume under /opt/gondul on all
containers, which means you can do your editing outside of the containers.

The last part of the test ansible playbook adds a handfull of
dummy-switches with 127.0.0.1 as management IP.

The following tags are defined: start, stop, build, test. To stop the
containers, run::

        $ ansible-playbook -i ansible/inventory-localhost -t stop ansibe/playbook-test.yml


Architecture
------------

Gondul is split in multiple roles, at the very core is the database server
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

The basic philosophy of Gondul is to have a generic and solid API, a data
base model that is somewhat agnostic to what we collect (so we can add more
interesting SNMP communities on the fly) and a front end that does a lot of
magic.


APIs
----

See doc/API.rst.

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

