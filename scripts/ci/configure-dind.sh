#!/bin/bash

# Docker-in-Docker Configuration Script
# Applies modifications for true DinD environment

set -e

echo "🐳 Applying true DinD modifications for CodeBuild environment"

# Create Docker network first (critical for DIND)
echo "📡 Creating Docker network..."
docker network create website-network 2>/dev/null || echo "Network website-network already exists"

# Function to safely add container name to a service
add_container_name() {
    local file=$1
    local service=$2
    local container_name=$3
    
    if [ -f "$file" ]; then
        # Check if container_name already exists for this service
        if ! grep -A 10 "^  ${service}:" "$file" | grep -q "container_name:"; then
            # Add container_name after the service declaration
            sed -i "/^  ${service}:/a\\    container_name: ${container_name}" "$file"
            echo "✅ Added container_name: ${container_name} to ${service} in ${file}"
        else
            echo "ℹ️  Container name already exists for ${service} in ${file}"
        fi
    else
        echo "⚠️  File ${file} not found, skipping..."
    fi
}

# Function to update environment variable references from service names to container names
update_env_references() {
    local file=$1
    local old_ref=$2
    local new_ref=$3
    
    if [ -f "$file" ]; then
        if grep -q "$old_ref" "$file"; then
            sed -i "s|$old_ref|$new_ref|g" "$file"
            echo "✅ Updated references from $old_ref to $new_ref in $file"
        fi
    fi
}

# Configure docker-compose.yml (development)
add_container_name "docker-compose.yml" "dev" "website-dev"

# Configure docker-compose.test.yml (testing)
add_container_name "docker-compose.test.yml" "prod" "website-prod"
add_container_name "docker-compose.test.yml" "playwright" "website-playwright"
add_container_name "docker-compose.test.yml" "apollo" "website-apollo"
add_container_name "docker-compose.test.yml" "mockoon" "website-mockoon"
add_container_name "docker-compose.test.yml" "k6" "website-k6"

# Configure docker-compose.memory-leak.yml
add_container_name "docker-compose.memory-leak.yml" "memory-leak" "website-memory-leak"

# Update environment variable references to use container names
update_env_references "docker-compose.memory-leak.yml" "http://prod:3001" "http://website-prod:3001"

echo "🎉 DinD configuration completed successfully!"
echo ""
echo "Container names configured:"
echo "  - website-dev (development)"
echo "  - website-prod (production)"
echo "  - website-playwright (e2e/visual tests)"
echo "  - website-apollo (GraphQL server)"
echo "  - website-mockoon (API mocking)"
echo "  - website-k6 (load testing)"
echo "  - website-memory-leak (memory leak testing)"
echo "" 