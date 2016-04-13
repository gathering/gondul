FROM debian:jessie
RUN apt-get update && apt-get install -y git-core
RUN git clone https://github.com/tech-server/tgnms

