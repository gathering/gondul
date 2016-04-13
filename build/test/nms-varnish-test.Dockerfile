FROM debian:jessie
RUN apt-get update
RUN apt-get -y install varnish

RUN rm /etc/varnish/default.vcl
ADD extras/misc/varnish.vcl /etc/varnish/default.vcl
CMD varnishd -a :80 -f /etc/varnish/default.vcl -F
EXPOSE 80
