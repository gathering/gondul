#!/usr/bin/env python3

import requests,traceback
from jinja2 import Template,Environment,FileSystemLoader,TemplateNotFound
import json
import netaddr
import http.server
from enum import Enum

endpoints = "read/networks read/oplog read/snmp read/switches-management public/distro-tree public/config public/dhcp public/dhcp-summary public/ping public/switches public/switch-state".split()
objects = dict()

def getEndpoint(endpoint):
    r = requests.get("http://localhost:80/api/%s" % endpoint)
    if (r.status_code != 200):
        raise Exception("Bad status code for endpoint %s: %s" % (endpoint, r.status_code))
    return r.json()

def updateData():
    for a in endpoints:
        objects[a] = getEndpoint(a)

def netmask(ip):
    return netaddr.IPNetwork(ip).netmask
def cidr(ip):
    return netaddr.IPNetwork(ip).prefixlen
def networkId(ip):
    return netaddr.IPNetwork(ip).ip
def getFirstDhcpIp(ip):
    return netaddr.IPNetwork(ip)[3]
def getLastDhcpIp(ip):
    return netaddr.IPNetwork(ip)[-1]
def getDistro(src):
    return src.split(":")[0]
def getPort(src):
    return src.split(":")[1]
def getFirstFapIp(ip):
    return netaddr.IPNetwork(ip)[netaddr.IPNetwork(ip).size/2]

env = Environment(loader=FileSystemLoader(['templates/','/opt/gondul/data/templates', '/opt/gondul/web/templates']), trim_blocks=True)

env.filters["netmask"] = netmask
env.filters["cidr"] = cidr
env.filters["networkId"] = networkId
env.filters["getFirstDhcpIp"] = getFirstDhcpIp
env.filters["getLastDhcpIp"] = getLastDhcpIp
env.filters["agentDistro"] = getDistro
env.filters["agentPort"] = getPort
env.filters["getFirstFapIP"] = getFirstFapIp

class Mode(Enum):
    Get = 1
    Post = 2

class MyHandler(http.server.BaseHTTPRequestHandler):

    options = dict()

    def parse_options(self):
        self.url = self.path[1:]
        self.options = dict()
        if self.url.find("?") != -1:
            (self.url, tmpoptions) = self.url.split("?")
            tmptuples = tmpoptions.split("&")
            for a in tmptuples:
                (x,y) = a.split("=")
                self.options[x] = y

    def generic(self, mode):
        updateData()
        self.parse_options()
        body = ""
        try:
            if mode == Mode.Get:
                template = env.get_template(self.url)
            elif mode == Mode.Post:
                length = self.headers.get('content-length')
                if not length:
                    length = 0
                content = self.rfile.read(int(length)).decode('UTF-8')
                template = env.from_string(content)
            else:
                raise Exception("Invalid mode")

            body = template.render(objects=objects, options=self.options)
            self.send_response(200)
        except TemplateNotFound as err:
           body = "Template \"%s\" not found\n" % self.url
           self.send_response(404)
        except Exception as err:
            body = ("Templating of \"%s\" failed to render. Most likely due to an error in the template. Error transcript:\n\n%s\n----\n\n%s\n" % (self.url, err, traceback.format_exc()))
            if mode == Mode.Get:
                self.send_response(400)
            else:
                self.send_response(500)
        finally:
            self.send_header('Cache-Control','max-age=5, s-maxage=1')
        body = body.encode('UTF-8')
        self.send_header('Content-Length', int(len(body)))
        self.end_headers()
        self.wfile.write(body)
        self.wfile.flush()
        
    def do_GET(self):
        self.generic(Mode.Get) 

    def do_POST(self):
        self.generic(Mode.Post) 

def run(server_class=http.server.HTTPServer, handler_class=http.server.BaseHTTPRequestHandler):
    server_address = ('localhost', 8084)
    httpd = server_class(server_address, handler_class)
    httpd.serve_forever() 

run(handler_class=MyHandler)
