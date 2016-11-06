FROM debian:stretch
RUN DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y graphite-carbon graphite-api gunicorn3
RUN sed -i s/127.0.0.1:8542/0.0.0.0:80/g /etc/default/graphite-api
#RUN apt-get install -y libapache2-mod-wsgi
#RUN cp /usr/share/graphite-web/apache2-graphite.conf /etc/apache2/sites-available/graphite-web.conf
#RUN sed -i 's/<\/VirtualHost>//' /etc/apache2/sites-available/graphite-web.conf
#RUN echo 'WSGIApplicationGroup %{GLOBAL}' >> /etc/apache2/sites-available/graphite-web.conf
#RUN echo '</VirtualHost>' >> /etc/apache2/sites-available/graphite-web.conf

#RUN a2ensite graphite-web
#RUN a2dissite 000-default
#RUN a2enmod wsgi
RUN sed -i 's/false/true/g' /etc/default/graphite-carbon
ADD build/test/dummy-graphite.start /dummy-graphite.start
ADD build/storage-schemas.conf /etc/carbon/
ADD build/carbon.conf /etc/carbon/
EXPOSE 80
EXPOSE 2003
CMD /dummy-graphite.start
VOLUME /var/lib/graphite
