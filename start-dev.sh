#!/bin/bash
#Script to start the development server with hot reload and watch for changes in the api and frontend directories
#Requirements:
# snmp_exporter running
# netbox running
set -e

CONTAINER_RUNTIME="docker" #Change to "podman" if you want to use podman instead of docker

#Load env variables from .env file
if [ ! -f .env ]; then
    echo "Error: .env file not found. Please create a .env file with the required environment variables."
    exit 1
else
    echo "Found .env file! Loading environment variables..."
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        line=${line%$'\r'}
        [[ -z "$line" || "$line" == \#* ]] && continue
        export "$line"
    done < .env
    set +a
fi

cleanup() {
    echo "Stopping development services..."
    kill "$API_PID" "$DEV_SERVER_PID" "$API_WORKER_PID" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM


#Check if netbox is running
if ! curl -Is http://localhost:8000/api/status/ > /dev/null 2>&1; then
    echo "Error: Netbox is not running or not accessible at http://localhost:8000. Please start Netbox and try again."
    exit 1
else
    echo "Netbox is running and accessible at http://localhost:8000!"
fi

#Check if snmp_exporter is running
if ! curl -Is http://localhost:9116/metrics > /dev/null 2>&1; then
    ./api/hacking/snmp_exporter --config.file=/mnt/c/vsc/git/gondul/api/hacking/snmp.yml &
    echo "Starting snmp_exporter in the background..."
    #Wait for snmp_exporter to start
    while ! curl -Is http://localhost:9116/metrics > /dev/null 2>&1; do
        echo "Waiting for snmp_exporter to start..."
        retries=$((retries+1))
        if [ $retries -gt 10 ]; then
            echo "Error: snmp_exporter failed to start after 10 attempts. You can download it from https://github.com/prometheus/snmp_exporter/releases/tag/v0.30.1 and place it in the api/hacking/ directory."
            exit 1
        fi
        sleep 1
    done
else
    echo "snmp_exporter is running and accessible at http://localhost:9116 !"
fi

#Start podman or docker compose with hot reload
echo "Starting containers with $CONTAINER_RUNTIME compose..."
$CONTAINER_RUNTIME compose -f api/hacking/docker-compose.yml up -d

#Wait for podman or docker compose to finish starting the containers
echo "Waiting for containers to start..."
if [ "$CONTAINER_RUNTIME" = "podman" ]; then
    while ! podman compose -f api/hacking/docker-compose.yml ps | grep "Up" > /dev/null 2>&1; do
        echo "Waiting for containers to start..."
        sleep 1
    done
elif [ "$CONTAINER_RUNTIME" = "docker" ]; then
    while ! docker compose -f api/hacking/docker-compose.yml ps | grep "Up" > /dev/null 2>&1; do
        echo "Waiting for containers to start..."
        sleep 1
    done
fi
echo "Containers started successfully!"

#Source venv
source venv/bin/activate

#Run DB migration script if nesecary
echo "Checking if database migration is needed..."
cd api
uv run alembic upgrade 4e556e723de0 #Check for latest version inside api/app/alembic/versions if you have DB issues.
cd ..

#Start API
echo "Starting Gondul API"
cd api
uv run --env-file ../.env fastapi dev app/main.py --port 8080 &
API_PID=$!
echo "API PID: $API_PID"
cd ..

#Start dev-server
echo "Starting dev-server"
cd web/dev-server
uv run fastapi run main.py --port 8081 &
DEV_SERVER_PID=$!
echo "Dev-server PID: $DEV_SERVER_PID"
cd ../..

#Start API worker
echo "Starting API worker"
cd api-worker
uv run --env-file ../.env main.py &
API_WORKER_PID=$!
echo "API worker PID: $API_WORKER_PID"
cd ..

sleep 2

if ! kill -0 "$API_PID" >/dev/null 2>&1; then
    echo "Error: Gondul API exited immediately. Check output above for details."
    exit 1
fi

if ! kill -0 "$DEV_SERVER_PID" >/dev/null 2>&1; then
    echo "Error: dev-server exited immediately. Check output above for details."
    exit 1
fi

if ! kill -0 "$API_WORKER_PID" >/dev/null 2>&1; then
    echo "Error: API worker exited immediately. Check output above for details."
    exit 1
fi

echo "All services started. Press Ctrl+C to stop."
wait "$API_PID" "$DEV_SERVER_PID" "$API_WORKER_PID"