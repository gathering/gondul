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

RUN mkdir -p /opt/gondul

RUN a2dissite 000-default
RUN a2enmod cgi
RUN ln -s /opt/gondul/extras/misc/apache2.conf /etc/apache2/sites-enabled/nms.conf
RUN mkdir -p /opt/gondul/etc
RUN echo 'demo:$apr1$IKrQYF6x$0zmRciLR7Clc2tEEosyHV.' > /htpasswd-read
RUN echo 'demo:$apr1$IKrQYF6x$0zmRciLR7Clc2tEEosyHV.' > /htpasswd-write
ADD build/test/dummy-apache2.start /
RUN chmod 0755 /dummy-apache2.start
CMD /dummy-apache2.start
EXPOSE 80
