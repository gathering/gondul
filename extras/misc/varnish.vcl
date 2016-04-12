# vim: ts=8:expandtab:sw=4:softtabstop=4

vcl 4.0;

backend default {
    .host = "127.0.0.1";
    .port = "8080";
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
    if (beresp.status != 200) {
        set beresp.uncacheable = false;
        set beresp.ttl = 5s;
    }
}
