FROM debian:jessie
RUN apt-get update && apt-get install -y git-core
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
RUN git clone https://github.com/tech-server/tgnms /opt/nms
CMD /opt/nms/collectors/ping.pl
