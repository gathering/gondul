#!/usr/bin/env python3.4

import requests
from jinja2 import Template,Environment,FileSystemLoader
import json

endpoints = "read/oplog read/snmp read/switches-management public/config public/dhcp public/dhcp-summary public/ping public/switches public/switch-state".split()
objects = dict()

def getEndpoint(endpoint):
    r = requests.get("http://gondul-front:/api/%s" % endpoint, auth=('demo','demo'))
    if (r.status_code != 200):
        raise Exception("Bad status code for endpoint %s: %s" % (endpoint, r.status_code))
    return r.json()

def updateData():
    for a in endpoints:
        objects[a] = getEndpoint(a)

env = Environment(loader=FileSystemLoader(['templates/','/opt/gondul/templating/templates']))

import http.server
class MyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        print (self.path[1:])
        updateData()
        try:
            template = env.get_template(self.path[1:])
            body = template.render(objects=objects).encode('UTF-8')
            self.send_response(200)
        except:
            body = "baaad\n".encode('UTF-8')
            self.send_response(500)
        self.send_header('Cache-Control','max-age=30, s-maxage=5')
        self.send_header('Content-Length', int(len(body)))
        self.end_headers()
        self.wfile.write(body)
        self.wfile.flush()
       
def run(server_class=http.server.HTTPServer, handler_class=http.server.BaseHTTPRequestHandler):
    server_address = ('', 8080)
    httpd = server_class(server_address, handler_class)
    httpd.serve_forever() 

run(handler_class=MyHandler)
