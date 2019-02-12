Installing Gondul
=================

Requirements
------------

- Debian Stable (stretch) with backports (possibly newer)
- Ansible v2.7 or newer (recommended: from backports)
- A harddrive of some size. Recommended: SSD. 200GB should be sufficient
  for almost any party.
- CPU: Depends on client-load. Most semi-modern cpu's will be more than
  enough. The biggest CPU hog during The Gathering 2017 ended up being
  gzip compression (we were delivering 1GBit/s of JSON pre-compression)
- RAM: For most loads, 8GB is plenty, but I strongly recommend at least
  16GB, and if possible, 32GB. It just gives you more leeway.


Quick-install
-------------


As root:

::

        ### Set to your regular username, obviously
        # YOURUSER=kly
        # apt-get install sudo git
        # echo ${YOURUSER} ALL=NOPASSWD: ALL >> /etc/sudoers
        # echo  deb http://http.debian.net/debian stretch-backports main non-free contrib > /etc/apt/sources.list.d/bp.list
        # apt-get update
        # apt-get install ansible/stretch-backports

As ``$YOURUSER``::

        $ git clone https://github.com/gathering/gondul.git
        $ cd gondul/ansible
        $ ansible-playbook -i inventory-localhost site.yml

Then visit http://ip-your-boxen/

Basic authentication
--------------------
We include the following from /etc/varnish/auth.vcl, to keep passwords out of default vcl:

`req.http.Authorization != "Basic AAAA"`

where AAAA is the result of
        `echo -n user:password | base64`

Example:

```
kly@jade:~$ echo -n tech:rules | base64
dGVjaDpydWxlcw==
cat /etc/varnish/auth.vcl 
req.http.Authorization != "Basic dGVjaDpydWxlcw=="
```


Securing InfluxDB
-----------------

Default InfluxDB is wide open, to limit this a little we need to configure a few users

Create the users needed:

1. Admin
        ``CREATE USER gondulAdmin WITH PASSWORD 'FancyPassword' WITH ALL PRIVILEGES;`` 
2. Write only user
        ``CREATE USER gondulWrite WITH PASSWORD 'funfunfunWrite';``
        ``GRANT WRITE ON gondul to gondulWrite;``
3. Read only user
        ``CREATE USER gondulRead WITH PASSWORD 'funfunfun';``
        ``GRANT READ ON gondul to gondulRead;``

Enable authentication by setting the ``auth-enabled`` option to true in the [http] section of the configuration file for influxDB (/etc/influxdb/influxdb.conf)

Set the influxdb write user and password in /includes/config.pm

| Add the read only user to varnish so all read requests are authenticated
| Example varnish config:

| if (req.url ~ "^/query") {
| set req.backend_hint = influx;
| set req.http.Authorization = "Basic Z29uZHVsUmVhZDpmdW5mdW5mdW4="; 
| }

Generate the base64 string using ``echo -n "gondulRead:funfunfun" | base64``

Setting up your network
--------------------------

Gondul tries to detect uplinks and clients on equipment automatically.

This is done through the ``ifAlias`` MIB, e.g.: Interface descriptions when
configuring your network equipment.

You should (but don't have to) set up your devices so that:

- All client interfaces (e.g.: End user ports) are labeled "Clients"
- Physical uplinks are labeled "LAG member"
- Aggregated uplinks (e.g.: a collection of LAG members) are labeled
  "Uplink"

Some of this is used for privacy and statistics (e.g.: Clients).

The "LAG member"/"Uplinks" labels are used to ensure that all interfaces
that are supposed to be up, are up, and that physical links that are up are
also active in the LAG (e.g.: Gondul compares the speed of all LAG members
on a device with the Uplink-ports. If there's a mismatch, you might have an
interface that is physically up but not being used).

Hidden stuff we do to your VM
-----------------------------

In addition to root-privileges that you set up manually in the first step,
the database-role also establishes sudo-privileges for the ``postgres``
user to make things simpler for everyone (well, for me, anyway, since I'm
the one making those recipes).

Each collector establishes a service on your system, found in
``/etc/systemd/system/gondul*``. This allows you to restart and monitor
gondul-services with regular systemd-commands.

Apache is installed and set to listen to port 8080.
Varnish is installed and listens to port 80
InfluxDB is installed and listens to port 8086 

SNMP mibs are downloaded to ``/opt/gondul/data/mibs``. Both for Cisco and
Juniper. If either vendor changes their FTP servers or whatever, this might
need tuning.

The only "custom" software installed is gondul, installed in /opt/gondul
(in addition to the git checkout. Yeah, I know... weeeird). All other
software used at this point is pulled from Debian stable where possible and
Debian Stable backports where a newer version is required for whatever
reason.

Bonus level
-----------

You can edit ``inventory-localhost`` and utilize multiple machines. This is
particularly useful for the DHCP log tailer.


TODO
----

The build system is being completely redone for Gondul 1.0 (as of this
writing, I invented a version scheme for Gondul 5 seconds ago. Deal with
it.)

Prior versions have used a heavy mix of Docker, but the results have been
mixed for numerous reasons.

As such, there are outstanding items in the installation that are currently
broken:

- DHCP log tailer (this is easy to fix, just need to copy ping/snmp
  basically)
- Distribution of configuration (config is being re-implemented)
- Various test-cases (They are already there, just need to be fiddled with)
- Grafana. Most likely, this will be an external "optional dependency"
