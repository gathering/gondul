# Templating Engine

This engine does the templating for The Gathering.

The flask server sits behind varnish and waits for incomming GET requests with a template name and optional variables.

```varnish
backend templating {
    .host = "::1";
    .port = "8081";
}
....
if (req.url ~ "^/api/templates") {
    set req.url = regsub(req.url,"^/api/templates","");
    set req.backend_hint = templating;
}
```

## Requirements

* Python3.6
* jinja2
* requests
* flask
* netaddr

## Settings

```
python3 templating.py
usage: templating.py [-t TEMPLATES [TEMPLATES ...]] [-h HOST] [-p PORT] [-d]
                     [-s SERVER] [-x TIMEOUT]

Process templates for gondul.

optional arguments:
  -t TEMPLATES [TEMPLATES ...], --templates TEMPLATES [TEMPLATES ...]
                        location of templates
  -h HOST, --host HOST  host address
  -p PORT, --port PORT  host port
  -d, --debug           enable debug mode
  -s SERVER, --server SERVER
                        gondul server address
  -x TIMEOUT, --timeout TIMEOUT
                        gondul server timeout
```

## How to test locally

You need a directory with all the jinja2 templates. I just assume you git cloned the entire gondul repo.

An example using [test.conf](../web/templates/test.conf)

```bash
python3 templating.py --host ::1 --port 8081 --templates ../web/templates --server http://tech:rules@<gondul>:80
```

```bash
curl -s "http://[::1]:8081/test.conf?switch=e1-1" | jq .
{
  "distro_name": "core-dev",
  "placement": {
    "height": 20,
    "width": 250,
    "x": "830",
    "y": "620"
  },
  "tags": []
}
```
