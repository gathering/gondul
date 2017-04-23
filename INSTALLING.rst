Installing Gondul
=================

Requirements
------------

- Debian Stable (jessie) with backports (possibly newer)
- Ansible v2.1 or newer (recommended: from backports)
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
        # apt-get install sudo
        # echo ${YOURUSER} ALL=NOPASSWD: ALL >> /etc/sudoers
        # echo  deb http://http.debian.net/debian jessie-backports main non-free contrib > /etc/apt/sources.list.d/bp.list
        # apt-get update
        # apt-get install ansible/jessie-backports

As ``$YOURUSER``::

        $ git clone git@github.com:tech-server/gondul
        $ cd gondul/ansible
        $ ansible-playbook -i inventory-localhost site.yml

Then visit http://ip-your-boxen/

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

HACKING
-------

Hacking on Gondul is best done by doing a regular install, then working
directly on the ``/opt/gondul`` git repo.


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
- Varnish
- Bootstrapping the database
- Distribution of configuration (config is being re-implemented)
- Various test-cases (They are already there, just need to be fiddled with)
- Graphite / Grafana. Most likely, this will be an external "optional dependency"

