# Example auth-config for varnish + gondul
# Stick this in the data/ directory and Varnish will use it.
# Unless you set X-Webauth-User, grafana will not work.
# The username/password can be generated with echo -n foo:bar | base64
 
acl white {
	"127.0.0.0"/8;
	"172.16.0.0"/12;
	"192.168.0.0"/16;
	"10.0.0.0"/8;
}

sub vcl_recv {
	if (client.ip !~ white && req.http.Authorization != "Basic Zm9vOmJhcg==") {
		return(synth(401));
	} else {
		unset req.http.Authorization;
		set req.http.X-Webauth-User = "admin";
	}
}

sub vcl_synth {
	if (resp.status == 401) {
		set resp.http.WWW-Authenticate = {"Basic realm="WHAT .... is your favorite color?""};
	}
}
