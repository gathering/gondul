#!/usr/bin/python3

import argparse
import traceback
import sys

import netaddr
import requests

from flask import Flask, request
from jinja2 import Environment, FileSystemLoader, TemplateNotFound, TemplateError

endpoints = "read/networks read/oplog read/snmp read/switches-management public/distro-tree public/config public/dhcp public/dhcp-summary public/ping public/switches public/switch-state".split()

objects = {}


def getEndpoint(endpoint):
    uri = "{}/api/{}".format(args.server, endpoint)
    try:
        r = requests.get(uri, timeout=args.timeout)
    except (requests.exceptions.ConnectTimeout, requests.exceptions.ConnectionError):
        raise Exception("Couldn't connect to server {}".format(uri))
    r.raise_for_status()
    return r.json()


def updateData():
    for a in endpoints:
        objects[a] = getEndpoint(a)


env = Environment(loader=FileSystemLoader([]), trim_blocks=True)

env.filters["netmask"] = lambda ip: netaddr.IPNetwork(ip).netmask
env.filters["cidr"] = lambda ip: netaddr.IPNetwork(ip).prefixlen
env.filters["networkId"] = lambda ip: netaddr.IPNetwork(ip).ip
env.filters["getFirstDhcpIp"] = lambda ip: netaddr.IPNetwork(ip)[2]
env.filters["getLastDhcpIp"] = lambda ip: netaddr.IPNetwork(ip)[-2]
env.filters["getIp"] = lambda ip,num: netaddr.IPNetwork(ip)[num]
env.filters["agentDistro"] = lambda src: src.split(":")[0]
env.filters["agentPort"] = lambda src: src.split(":")[1]
env.filters["getFirstFapIP"] = lambda ip: netaddr.IPNetwork(ip)[netaddr.IPNetwork(ip).size / 2]

app = Flask(__name__)


@app.after_request
def add_header(response):
    if response.status_code == 200:
        response.cache_control.max_age = 5
        response.cache_control.s_maxage = 1
    return response


@app.route("/<path>", methods=["GET"])
def root_get(path):
    try:
        updateData()
        template = env.get_template(path)
        body = template.render(objects=objects, options=request.args)
    except TemplateNotFound:
        return 'Template "{}" not found\n'.format(path), 404
    except TemplateError as err:
        return 'Templating of "{}" failed to render. Most likely due to an error in the template. Error transcript:\n\n{}\n----\n\n{}\n'.format(path, err, traceback.format_exc()), 400
    except requests.exceptions.HTTPError as err:
        return 'HTTP error from gondul: {}'.format(err), 500
    except Exception as err:
        return 'Connection issues: {}'.format(err), 500
    return body, 200


@app.route("/<path>", methods=["POST"])
def root_post(path):
    updateData()
    try:
        content = request.stream.read(int(request.headers["Content-Length"]))
        template = env.from_string(content.decode("utf-8"))
        body = template.render(objects=objects, options=request.args)
    except Exception as err:
        return 'Templating of "{}" failed to render. Most likely due to an error in the template. Error transcript:\n\n{}\n----\n\n{}\n'.format(path, err, traceback.format_exc()), 400
    return body, 200


parser = argparse.ArgumentParser(description="Process templates for gondul.", add_help=False)
parser.add_argument("-t", "--templates", type=str, nargs="+", help="location of templates")
parser.add_argument("-h", "--host", type=str, default="127.0.0.1", help="host address")
parser.add_argument("-p", "--port", type=int, default=8080, help="host port")
parser.add_argument("-d", "--debug", action="store_true", help="enable debug mode")
parser.add_argument("-s", "--server", type=str, default="http://localhost:80", help="gondul server address")
parser.add_argument("-x", "--timeout", type=int, default=2, help="gondul server timeout")

args = parser.parse_args()
env.loader.searchpath = args.templates

if not sys.argv[1:]:
    parser.print_help()
    sys.exit(1)

app.run(host=args.host, port=args.port, debug=args.debug)
