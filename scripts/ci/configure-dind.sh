#!/bin/bash

# Docker-in-Docker Configuration Script for Website
# Adds container names and networks needed for DIND mode

set -e

echo "🐳 Applying DIND configuration for website docker-compose files"

# Add container name and networks to dev service in docker-compose.yml
if ! grep -q "container_name: website-dev" docker-compose.yml; then
    echo "Adding container name to dev service..."
    sed -i '/^  dev:$/a \    container_name: website-dev' docker-compose.yml
fi

if ! sed -n "/^  dev:/,/^  [a-zA-Z]/p" docker-compose.yml | grep -q "networks:"; then
    echo "Adding networks to dev service..."
    sed -i '/^    volumes:$/i \    networks:\n      - website-network' docker-compose.yml
fi

# Add container names to services in docker-compose.test.yml
services="prod playwright apollo mockoon k6"

for service in $services; do
    if ! grep -q "container_name: website-$service" docker-compose.test.yml; then
        echo "Adding container name to $service service..."
        sed -i "/^  $service:$/a \\    container_name: website-$service" docker-compose.test.yml
    fi
done

echo "✅ DIND configuration completed successfully" 