#!/bin/bash

docker exec gondul-varnish-test varnishadm ban 'req.url ~ .*'
