# vim: ts=8:expandtab:sw=4:softtabstop=4

# VCL for Gondul - also requires auth.vcl (see further down)
# Also uses hitch and acmetool for ssl
vcl 4.0;

import std;

# API - apache
backend default {
    .host = "::1";
    .port = "8080";
}

# Templating engine
backend templating {
    .host = "::1";
    .port = "8081";
}

# Definitely not influx
backend influx {
    .host = "::1";
    .port = "8086";
}

# For certbot
# WTF... isn't this apache? Apparently acmetool listens on port 402
backend acmetool {
   .host = "::1";
   .port = "402";
}

# White-list localhost - PLEASE make sure this is actually smart
acl white {
    "::1";
    "127.0.0.0"/8;
    #"172.16.0.0"/12;
    #"192.168.0.0"/16;
    #"10.0.0.0"/8;
}

# vcl_recv is "prep-processing of requests
sub vcl_recv {
    # Handle certbot by passing /.well-known to acmetool
    if (req.url ~ "^/.well-known/acme-challenge/") {
       set req.backend_hint = acmetool;
       return(pass);
    }

    # Redirect to https - note that this does NOT happen for 
    # "whitelisted" stuff - e.g., templating engine.
    #disabled as we haven't fixd hitch for ssl termination
    #if (std.port(local.ip) == 80 && client.ip !~ white) {
    #    set req.http.x-redir = "https://" + req.http.host + req.url;
    #    return(synth(301));
    #}

    # Basic authentication ....
    # We include the following from /etc/varnish/auth.vcl, to keep passwords
    # out of default vcl:
    # req.http.Authorization != "Basic AAAA"
    #
    # where AAAA is the result of:
    # echo -n user:password | base64.
    # Example:
    # kly@jade:~$ echo -n tech:rules | base64 
    # dGVjaDpydWxlcw==
    # # cat /etc/varnish/auth.vcl 
    # req.http.Authorization != "Basic dGVjaDpydWxlcw=="
    if (client.ip !~ white && 
            include "/etc/varnish/auth.vcl";) {
        return(synth(401));
    } else {
        unset req.http.Authorization;
        set req.http.X-Webauth-User = "admin";
    }

    if (req.url ~ "^/api/templates") {
        set req.url = regsub(req.url,"^/api/templates","");
        set req.backend_hint = templating;
    }
    
    if (req.url ~ "^/query") {
        set req.backend_hint = influx;
    }

    # More human-typable URL
    if (req.url ~ "^/where" || req.url ~ "^/location") {
        set req.url = "/api/public/location";
    }
    
    # Fairly standard filtering. Default VCL will do "pipe", which is
    # pointless for us.
    if (req.method != "GET" &&
        req.method != "HEAD" &&
        req.method != "PUT" &&
        req.method != "POST" &&
        req.method != "TRACE" &&
        req.method != "OPTIONS" &&
        req.method != "DELETE") {
        # Vi hater alt som er gøy.
        return (synth(418,"LOLOLOL"));
    }

    # We can only cache GET/HEAD requests.
    if (req.method != "GET" && req.method != "HEAD") {
        return (pass);
    }

    # exclude listing of template files
    if (req.url ~ "/api/read/template-list" ) {
        return (pass);
    }

    # We don't use cookies - so get rid of them so we don't mess up the cache
    # by accident.
    unset req.http.Cookie;

    # Force hash, since we want to cache with Authorization headers
    return (hash);
}

# vcl_hash runs right after vcl_recv, and determines what
# is "unique", e.g., what's part of the hash key. We simply
# add the Authorization header, allowing caching of authenticated
# content.
# NOTE: We do NOT run "return" so it will fall back to the default
# vcl builtin, which will add ip/host and URL as you'd expect.
sub vcl_hash {
    hash_data(req.http.authorization);
}

# vcl_synth is run for "synthetic messages": responses generated internally
# from Varnish, typically error messages or "return (synth...)"
sub vcl_synth {
    if (resp.status == 401) {
        set resp.http.WWW-Authenticate = {"Basic realm="WHAT .... is your favorite color?""};
    }

    # Second part of redirect-logic
    if (resp.status == 301) {
        set resp.http.Location = req.http.x-redir;
        return (deliver);
    }
}

# vcl_backend_response is run when we have a reply from a backend,
# allowing us to massage the backend response. We wish to do as little
# as possible here to keep things transparent.
sub vcl_backend_response {
    # Expose the URL used for debug purposes and future
    # cache invalidation.
    set beresp.http.x-url = bereq.url;

    # If the backend response supplies the "x-ban" HTTP response
    # header, then invalidate based on it. This is used for for
    # invalidating e.g. switch-management if a switch is added, or the oplog.
    if (beresp.http.x-ban) {
        ban("obj.http.x-url ~ " + beresp.http.x-ban);
    }
    
    # Force gzip on text-based content so we don't have to
    # rely on Apache. 
    if (beresp.http.content-type ~ "text") {
        set beresp.do_gzip = true;
    }

    # Do some hand-crafting for influx. Should probably be
    # improved... e.g.: with checking error codes.
    if (bereq.url ~ "/query") {
        set beresp.http.Cache-Control = "max-age=5";
        unset beresp.http.Pragma;
        set beresp.uncacheable = false;
        set beresp.grace = 10s;
        set beresp.ttl = 5s;
    }
    
    # Wait, nvm, we catch non-200 here and make them actually cacheable for 5
    # seconds - we don't want to nuke a backend just because it has ...issues. 
    if (beresp.status != 200) {
        set beresp.uncacheable = false;
        set beresp.ttl = 5s;
    }
    # So for html/css/js there really is no sensible blackend to set
    # smart TTL, so we hard-code it to 10s. 10s can be a bit annoying
    # for development, but works.
    if (bereq.url ~ "\.(html|css|js)" || bereq.url ~ "^/[^/.]*") {
        set beresp.ttl = 10s;
    }
}
