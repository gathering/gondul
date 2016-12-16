FROM debian:jessie
RUN apt-get update && apt-get install -y postgresql-9.4
ADD build/test/pg_hba.tail /pg_hba.tail
RUN cat /pg_hba.tail >> /etc/postgresql/9.4/main/pg_hba.conf
ADD build/test/postgresql.conf /etc/postgresql/9.4/main/postgresql.conf
RUN echo "listen_addresses = '*'" >> /etc/postgresql/9.4/main/postgresql.conf
CMD /opt/gondul/build/test/postgres.sh
VOLUME /var/lib/postgresql
EXPOSE 5432
