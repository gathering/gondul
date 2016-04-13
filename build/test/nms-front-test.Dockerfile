FROM debian:jessie
RUN apt-get update
RUN apt-get -y install          \
    libcapture-tiny-perl        \
    libcommon-sense-perl        \
    libdata-dumper-simple-perl  \
    libdbd-pg-perl              \
    libdbi-perl                 \
    libdigest-perl              \
    libgd-perl                  \
    libgeo-ip-perl              \
    libhtml-parser-perl         \
    libhtml-template-perl       \
    libjson-perl                \
    libjson-xs-perl             \
    libnetaddr-ip-perl          \
    libnet-cidr-perl            \
    libnet-ip-perl              \
    libnet-oping-perl           \
    libnet-rawip-perl           \
    libsnmp-perl                \
    libsocket6-perl             \
    libsocket-perl              \
    libswitch-perl              \
    libtimedate-perl            \
    perl                        \
    perl-base                   \
    perl-modules                \
    libfreezethaw-perl		\
    apache2

RUN mkdir -p /opt/nms
ADD web /opt/nms/web
ADD include /opt/nms/include
ADD extras /opt/nms/extras

RUN a2dissite 000-default
RUN a2enmod cgi
RUN cp /opt/nms/extras/misc/apache2.conf /etc/apache2/sites-enabled/nms.conf
RUN mkdir -p /opt/nms/etc
RUN echo 'demo:$apr1$IKrQYF6x$0zmRciLR7Clc2tEEosyHV.' > /opt/nms/etc/htpasswd-read
RUN echo 'demo:$apr1$IKrQYF6x$0zmRciLR7Clc2tEEosyHV.' > /opt/nms/etc/htpasswd-write
ADD build/test/dummy-apache2.start /
RUN chmod 0755 /dummy-apache2.start
CMD /dummy-apache2.start
EXPOSE 80
