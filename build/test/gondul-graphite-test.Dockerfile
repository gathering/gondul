FROM debian:jessie
RUN DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y graphite-carbon graphite-web apache2
RUN apt-get install -y libapache2-mod-wsgi
RUN cp /usr/share/graphite-web/apache2-graphite.conf /etc/apache2/sites-available/graphite-web.conf
RUN a2ensite graphite-web
RUN a2dissite 000-default
RUN a2enmod wsgi
RUN sed -i 's/false/true/g' /etc/default/graphite-carbon
ADD build/test/dummy-graphite.start /dummy-graphite.start
ADD build/storage-schemas.conf /etc/carbon/
ADD build/carbon.conf /etc/carbon/
EXPOSE 80
EXPOSE 2003
CMD /dummy-graphite.start
VOLUME /var/lib/graphite
