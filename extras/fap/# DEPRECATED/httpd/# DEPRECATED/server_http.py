#!/usr/bin/python
# -*- coding: utf-8 -*-

from http.server import BaseHTTPRequestHandler, HTTPServer
from string import Template
import time
import psycopg2
import psycopg2.extras
import sys
import os

def main():
    #
    # Settings
    #
    settings = {
	    'db': {
		    'user': 'bootstrap',
		    'password': 'asdf',
		    'dbname': 'bootstrap',
		    'host': 'localhost'
	    },
	    'http': {
		    'host': '0.0.0.0',
		    'port': 80
	    }
    }
    
    #
    # Connect to DB
    #
    try:
        connect_params = ("dbname='%s' user='%s' host='%s' password='%s'" % (settings['db']['dbname'], settings['db']['user'], settings['db']['host'], settings['db']['password']))
        conn = psycopg2.connect(connect_params)
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        # cur.execute("""SELECT * from switches""")
        # rows = cur.fetchall()
        # print ("\nSwitches in DB during server_http.py startup:")
        # for row in rows:
        #     print (" --> %s, connected to %s port %s" % (row['hostname'], row['distro_name'], row['distro_phy_port']))
	
    except (psycopg2.DatabaseError, psycopg2.OperationalError) as e:
	    print ('Error: %s' % e)
	    sys.exit(1)

    except:
        print(sys.exc_info()[0])
        sys.exit(1)

    def template_get(model):
        return open('fap/httpd/' + model + '.template').read()
        
    def template_parse(template_src, hostname):
        cur.execute("SELECT * FROM switches WHERE hostname = '%s'" % hostname)
        if(cur.rowcount == 1):
            row = cur.fetchall()[0]
            d={
                'hostname': row['hostname'],
                'distro_name': row['distro_name'],
                'distro_phy_port': row['distro_phy_port'],
                'mgmt_addr': row['mgmt_addr'],
                'mgmt_cidr': row['mgmt_cidr'],
                'mgmt_gw': row['mgmt_gw'],
                'mgmt_vlan': row['mgmt_vlan'],
                'traffic_vlan': row['traffic_vlan'],
                'mgmt_v6_addr': row['mgmt_v6_addr'],
                'mgmt_v6_cidr': row['mgmt_v6_cidr'],
                'mgmt_v6_gw': row['mgmt_v6_gw']
            }
            cur.execute("UPDATE switches SET last_config_fetch = '%s' WHERE hostname = '%s'" % (str(time.time()).split('.')[0], hostname)) # updated DB with last config fetch
            conn.commit()
            return Template(template_src).safe_substitute(d)
        else:
            return False

    class httpd(BaseHTTPRequestHandler):
        def do_GET(self):
            print('[%s] [%s] Incoming HTTP GET URI:%s ' % (self.client_address[0], time.asctime(), self.path))
            
            # Client asks for the config file
            if '/tg-edge/' in self.path:
                hostname = self.path.split('/tg-edge/')[1]
                if len(hostname) > 0:
                    print('[%s] --> Hostname "%s" accepted, fetching info from DB' % (self.client_address[0], hostname))
                    template_parsed = template_parse(template_get('ex2200'), hostname)
                    if template_parsed:
                        print('[%s] --> Template successfully populated' % self.client_address[0])
                        print('[%s] --> Sending response to client' % self.client_address[0])
                        self.send_response(200)
                        self.send_header("Content-type", "text/plain")
                        self.end_headers()
                        self.wfile.write(bytes(template_parsed, "utf-8"))
                        print('[%s] --> Success - %s bytes sent to client' % (self.client_address[0], len(template_parsed)))
                    else:
                        print('[%s] --> Error - could not find hostname "%s" in DB' % (self.client_address[0], hostname))
                else:
                    print('[%s] --> Rejected due to missing hostname' % self.client_address[0])
                    
            # Client asks for a file download - most likely a JunOS file
            elif '/files/' in self.path:
                # It seems that "http.server" escapes nastiness from the URL - ("/files/../../../root_file" => "/files/root_file")
                requested_file = self.path.split('/files/')[1]
                files_dir = 'fap/httpd/files/'
                print('[%s] --> File request for "%s" in "%s"' % (self.client_address[0], requested_file, files_dir))
                if os.path.isfile(files_dir + requested_file):
                    print('[%s] --> File found' % self.client_address[0])
                    try:
                        f = open(files_dir + requested_file)
                        self.send_response(200)
                        self.send_header('Content-type', 'application/x-gzip') # correct content type for tar.gz
                        self.end_headers()
                        print('[%s]     --> File transfer started' % self.client_address[0])
                        f = open(files_dir + requested_file, 'rb')
                        self.wfile.write(f.read())
                        f.close()
                        print('[%s]     --> File transfer completed' % self.client_address[0])
                        return
                    except IOError:
                        self.send_error(404,'File Not Found: %s' % self.path)
                        print('[%s] --> ERROR 404 - File not found' % self.client_address[0])
                        pass
                    except:
                        print('[%s] --> Generic error during file reading' % self.client_address[0])
                        pass
                else:
                    print('[%s] --> File request rejected due to nonexisting file' % self.client_address[0])
            else:
                print('[%s] --> rejected due to bad URI' % self.client_address[0])
        # silence stderr from BaseHTTPRequestHandler
        # source: http://stackoverflow.com/questions/3389305/how-to-silent-quiet-httpserver-and-basichttprequesthandlers-stderr-output
        def log_message(self, format, *args):
            return
            
    httpd_instance = HTTPServer((settings['http']['host'], settings['http']['port']), httpd)
    print("\n[%s] Server Starts - %s:%s" % (time.asctime(), settings['http']['host'], settings['http']['port']))

    try:
        httpd_instance.serve_forever()
    except KeyboardInterrupt:
        pass

    httpd_instance.server_close()
    print("\n\n[%s] HTTP Server stopped\n" % time.asctime())

if __name__ == "__main__":
	main()
