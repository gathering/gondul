# vim: ts=8:expandtab:sw=4:softtabstop=4

vcl 4.0;

backend default {
    .host = "gondul-front";
    .port = "80";
}

backend graphite {
    .host = "gondul-graphite";
    .port = "80";
}

backend templating {
    .host = "gondul-templating";
    .port = "8080";
}

backend grafana {
    .host = "gondul-grafana";
    .port = "3000";
}

sub vcl_recv {
    if (req.url ~ "^/where" || req.url ~ "^/location") {
	set req.url = "/api/public/location";
    }
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

    if (req.url ~ "^/render") {
        set req.backend_hint = graphite;
    }
    if (req.url ~ "^/grafana") {
	set req.url = regsub(req.url, "^/grafana","");
	set req.backend_hint = grafana;
	return (pass);
    }
    if (req.url ~ "^/api/templates") {
        set req.url = regsub(req.url, "/api/templates", "");
        set req.backend_hint = templating;
    }

    if (req.method != "GET" && req.method != "HEAD") {
        /* We only deal with GET and HEAD by default */
        return (pass);
    }

    # Brukes ikke. Cookies er for nubs.
    unset req.http.Cookie;

    # Tvinges gjennom for å cache med authorization-skrot.
    return (hash);
}


# Rosa magi
sub vcl_hash {
    # Wheee. Legg til authorization-headeren i hashen.
    hash_data(req.http.authorization);
}

# Mauve magi. Hva nå enn det er.
# Dette er WIP - Skal flyttes til backend
sub vcl_backend_response {
    set beresp.http.x-url = bereq.url;
    if (beresp.http.x-ban) {
        ban("obj.http.x-url ~ " + beresp.http.x-ban);
    }
    if (bereq.url ~ "/render") {
        # Graphite claims "no-cache", which is dumb.
        # Let's blindly cache for 5+10s. Which is 10000 times better.
        set beresp.http.Cache-Control = "max-age=5";
        unset beresp.http.Pragma;
        set beresp.uncacheable = false;
        set beresp.grace = 10s;
        set beresp.ttl = 5s;
    }
    if (beresp.status != 200) {
        set beresp.uncacheable = false;
        set beresp.ttl = 5s;
    }
    if (bereq.url ~ "\.(html|css|js)") {
        # Mainly for ease of development
        set beresp.ttl = 10s;
    }
}
