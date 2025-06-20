#!/bin/bash

# Docker-in-Docker Setup Script for Website CI
# Moved from website-infrastructure to give developers full control

set -e

echo "🐳 Setting up Docker-in-Docker environment for website CI"

# Function to setup DIND network
setup_dind_network() {
    echo "Creating Docker network for container communication..."
    docker network create website-network 2>/dev/null || echo "Network website-network already exists"
}

# Function to run containerized command with proper setup
run_dind_container() {
    local container_name=$1
    local image_name=$2
    local command=$3
    local cleanup=${4:-true}
    
    echo "🛠️ Setting up container: $container_name"
    
    # Setup network
    setup_dind_network
    
    # Clean up any existing container
    docker rm -f "$container_name" 2>/dev/null || true
    
    # Start container
    echo "🚀 Starting container: $container_name"
    docker run -d --name "$container_name" --network website-network "$image_name" tail -f /dev/null
    
    # Copy source code
    echo "📂 Copying source code to container..."
    if docker cp . "$container_name:/app/"; then
        echo "✅ Source files copied successfully"
    else
        echo "❌ Failed to copy source files"
        docker rm -f "$container_name"
        return 1
    fi
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    if docker exec "$container_name" sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        docker logs "$container_name" --tail 20
        docker rm -f "$container_name"
        return 1
    fi
    
    # Execute command
    echo "🔧 Executing: $command"
    if docker exec "$container_name" sh -c "cd /app && $command"; then
        echo "✅ Command executed successfully"
        result=0
    else
        echo "❌ Command failed"
        docker logs "$container_name" --tail 30
        result=1
    fi
    
    # Cleanup if requested
    if [ "$cleanup" = "true" ]; then
        echo "🧹 Cleaning up container: $container_name"
        docker rm -f "$container_name"
    fi
    
    return $result
}

# Function to wait for service in container
wait_for_container_service() {
    local container_name=$1
    local port=$2
    local timeout=${3:-180}
    
    echo "⏳ Waiting for service in $container_name on port $port..."
    
    for i in $(seq 1 $((timeout/3))); do
        if docker exec "$container_name" sh -c "curl -f http://localhost:$port >/dev/null 2>&1"; then
            echo "✅ Service is responding on port $port!"
            return 0
        fi
        
        echo "Attempt $i: Service not ready yet..."
        
        # Debug info every 10 attempts
        if [ $((i % 10)) -eq 0 ]; then
            echo "Debug info at attempt $i:"
            docker exec "$container_name" ps aux 2>/dev/null | grep -E "(next|node)" || echo "No Next.js processes found"
            docker exec "$container_name" netstat -tulpn 2>/dev/null | grep ":$port" || echo "Port $port not bound"
            echo "Recent container logs:"
            docker logs "$container_name" --tail 10
        fi
        
        sleep 3
    done
    
    echo "❌ Service failed to respond within $timeout seconds"
    docker logs "$container_name" --tail 50
    return 1
}

# Function to copy results from container
copy_container_results() {
    local container_name=$1
    local source_path=$2
    local dest_path=$3
    
    echo "📂 Copying results from $container_name:$source_path to $dest_path"
    mkdir -p "$dest_path"
    docker cp "$container_name:$source_path" "$dest_path/" 2>/dev/null || echo "No results to copy from $source_path"
}

# Functions are available when this script is sourced
echo "✅ DIND setup functions loaded successfully" 