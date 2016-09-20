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
    perl-modules 
RUN mkdir -p /opt/gondul
CMD /opt/gondul/collectors/ping.pl
EXPOSE 1111
