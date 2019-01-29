FROM debian:jessie
RUN apt-get update
RUN apt-get -y install \
	python3-jinja2 \
	python3-netaddr \
	python3-flask \
	python3-requests

RUN mkdir -p /opt/gondul

CMD /opt/gondul/templating/templating.py
EXPOSE 8080
