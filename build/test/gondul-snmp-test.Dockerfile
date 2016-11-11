FROM debian:jessie
RUN apt-get update
RUN apt-get -y install          \
    libdata-dumper-simple-perl  \
    libdbd-pg-perl              \
    libdbi-perl                 \
    libnet-oping-perl           \
    libsocket-perl              \
    libswitch-perl              \
    libtimedate-perl            \
    perl                        \
    libjson-xs-perl             \
    libjson-perl                \
    perl-base                   \
    snmpd			\
    libsnmp-perl		\
    perl-modules 
RUN apt-get -y install wget tar
RUN mkdir -p /opt/gondul
COPY build/test/snmpd.conf /etc/snmp/
CMD /opt/gondul/build/test/snmpfetch-misc.sh
EXPOSE 1111
