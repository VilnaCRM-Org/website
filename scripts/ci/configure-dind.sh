#!/bin/bash

# Docker-in-Docker Configuration Script for Website
# Adds container names and networks needed for DIND mode

set -e

echo "🐳 Applying DIND configuration for website docker-compose files"

# Function to add container name to a service if it exists
add_container_name_if_exists() {
    local file=$1
    local service=$2
    local container_name=$3
    
    if grep -q "^  $service:$" "$file"; then
        if ! grep -q "container_name: $container_name" "$file"; then
            echo "Adding container name to $service service..."
            sed -i "/^  $service:$/a \\    container_name: $container_name" "$file"
        fi
    fi
}

# Add container name and networks to dev service in docker-compose.yml (only for dev mode)
if [ -f "docker-compose.yml" ]; then
    add_container_name_if_exists "docker-compose.yml" "dev" "website-dev"
    
    if grep -q "^  dev:$" docker-compose.yml && ! sed -n "/^  dev:/,/^  [a-zA-Z]/p" docker-compose.yml | grep -q "networks:"; then
        echo "Adding networks to dev service..."
        sed -i '/^    volumes:$/i \    networks:\n      - website-network' docker-compose.yml
    fi
fi

# Add container names to services in docker-compose.test.yml (only if they exist)
if [ -f "docker-compose.test.yml" ]; then
    services="prod playwright apollo mockoon k6"
    
    for service in $services; do
        add_container_name_if_exists "docker-compose.test.yml" "$service" "website-$service"
    done
fi

echo "✅ DIND configuration completed successfully" 