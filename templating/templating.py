#!/usr/bin/env python3

import requests,traceback
from jinja2 import Template,Environment,FileSystemLoader
import json
import http.server

endpoints = "read/oplog read/snmp read/switches-management public/config public/dhcp public/dhcp-summary public/ping public/switches public/switch-state".split()
objects = dict()

def getEndpoint(endpoint):
    r = requests.get("http://gondul-front/api/%s" % endpoint)
    if (r.status_code != 200):
        raise Exception("Bad status code for endpoint %s: %s" % (endpoint, r.status_code))
    return r.json()

def updateData():
    for a in endpoints:
        objects[a] = getEndpoint(a)

env = Environment(loader=FileSystemLoader(['templates/','/opt/gondul/web/templates']),lstrip_blocks=True, trim_blocks=True)

class MyHandler(http.server.BaseHTTPRequestHandler):

    body = ""
    options = dict()

    def parse_options(self):
        url = self.path[1:]
        self.url = url
        if url.find("?") != -1:
            (self.url, tmpoptions) = url.split("?")
            tmptuples = tmpoptions.split("&")
            for a in tmptuples:
                (x,y) = a.split("=")
                self.options[x] = y

    def finalize_reply(self):
        self.send_header('Content-Length', int(len(self.body)))
        self.end_headers()
        self.wfile.write(self.body)
        self.wfile.flush()

    def do_GET(self):
        updateData()
        self.parse_options()
        try:
            template = env.get_template(self.url)
            self.body = template.render(objects=objects, options=self.options).encode('UTF-8')
            self.send_response(200)
            self.send_header('Cache-Control','max-age=30, s-maxage=5')
        except Exception as err:
            self.body = ("Templating of %s failed to render. Most likely due to an error in the template. Error transcript:\n\n%s\n----\n\n%s\n" % (self.url, err, traceback.format_exc())).encode('UTF-8')
            self.send_response(500)
            self.send_header('Cache-Control','max-age=1, s-maxage=1')
        self.finalize_reply()

    def do_POST(self):
        updateData()
        self.parse_options()
        try:
            length = self.headers.get('content-length')
            if not length:
                length = 0
            content = self.rfile.read(int(length)).decode('UTF-8')
            template = Template(content)
            self.body = template.render(options=self.options).encode('UTF-8')
            self.send_response(200)
            self.send_header('Cache-Control','max-age=30, s-maxage=5')
        except Exception as err:
            self.body = ("Templating of %s failed to render. Most likely due to an error in the template. Error transcript:\n\n%s\n----\n\n%s\n" % (self.url, err, traceback.format_exc())).encode('UTF-8')
            self.send_response(500)
            self.send_header('Cache-Control','max-age=1, s-maxage=1')
        self.finalize_reply()

def run(server_class=http.server.HTTPServer, handler_class=http.server.BaseHTTPRequestHandler):
    server_address = ('', 8080)
    httpd = server_class(server_address, handler_class)
    httpd.serve_forever() 

run(handler_class=MyHandler)
