# FAP - Fast and Agile Provisioning

Tools (DHCP daemon + HTTP daemon + DB) for managing provisioning towards a large number of factory default Juniper switches (EX2200) using ZTP (Zero Touch Protocol) over DHCP relays.

The project is built with Python (>3.4.0) and PostgreSQL (>9.3.5).

Licensed under the GNU GPL, version 2. See the included COPYING file.



## Usage
Launch the python scripts for fap from tgmanage directory.

    apt-get install apache2 php5 python3 python3-psycopg2 php5-pgsql
    a2enmod cgi
    a2enmod rewrite
    


### HTTPD
    j@lappie:~/git/tgmanage$ sudo python3 fap/httpd/server_http.py
    
Example: <a href="httpd/terminal.log">httpd/terminal.log</a>


### DHCPD
    j@lappie:~/git/tgmanage$ sudo python3 fap/dhcpd/server_dhcp.py
    
Example: <a href="dhcpd/terminal.log">dhcpd/terminal.log</a>


# TODO
* DONE: Support for IPv6 management
* Process multiple HTTP request simultaneously with python, so we can migrate everything over to python (no more PHP).
* Support for only pushing JunOS image to switch - no config (for backup switches)
* Try/catch on whole ethernet frame in DHCPD
* Timestamps on each line in log both from DHCPD and HTTPD

# Changes in regard of TG16
Migrated from a standalone DB to the NMS ("Gondul") DB. Since time was limited, a lot of ugly haxxes were put in place to get it to work. The neccessary job of cleaning it up has not been done yet. 
