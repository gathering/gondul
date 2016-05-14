#!/bin/bash

docker exec gondul-db-test su postgres -c "pg_dump -s nms" > build/schema.sql

