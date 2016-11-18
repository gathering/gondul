FROM debian:jessie
RUN apt-get update
RUN apt-get -y install varnish

CMD /opt/gondul/build/test/varnish-init.sh
EXPOSE 80
