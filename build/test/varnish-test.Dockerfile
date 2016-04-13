FROM debian:jessie
RUN apt-get update && apt-get install -y git-core
RUN apt-get -y install varnish

RUN git clone https://github.com/tech-server/tgnms /opt/nms

RUN rm /etc/varnish/default.vcl
RUN cp /opt/nms/extras/misc/varnish.vcl /etc/varnish/default.vcl
CMD varnishd -a :80 -f /etc/varnish/default.vcl -F
EXPOSE 80
