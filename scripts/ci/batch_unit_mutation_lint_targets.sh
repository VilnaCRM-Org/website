#!/bin/bash

# Batch Unit, Mutation, and Lint Tests Script
# Contains DIND implementations for unit tests, mutation tests, and lint commands

set -e

# ==================== HELPER FUNCTIONS ====================

# Network and basic setup
_setup_network() {
    docker network create website-network 2>/dev/null || echo "Network website-network already exists"
}

_cleanup_container() {
    local container_name=$1
    docker rm -f "$container_name" 2>/dev/null || true
}

_build_dev_image() {
    echo "Building container image..."
    docker-compose -f docker-compose.yml build dev
}

# Standard container lifecycle
_start_dev_container() {
    local container_name=$1
    echo "🛠️ Starting container for operations..."
    docker run -d --name "$container_name" --network website-network website-dev tail -f /dev/null
}

_copy_source_and_install() {
    local container_name=$1
    
    echo "📂 Copying source files into container..."
    if ! docker cp . "$container_name:/app/"; then
        echo "❌ Failed to copy source files"
        docker rm -f "$container_name"
        return 1
    fi
    
    echo "📦 Installing dependencies inside container..."
    if ! docker exec "$container_name" sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        echo "❌ Failed to install dependencies"
        docker logs "$container_name" --tail 20
        docker rm -f "$container_name"
        return 1
    fi
    echo "✅ Source files and dependencies ready"
}

_run_command_in_container() {
    local container_name=$1
    local command=$2
    local task_name=${3:-"Task"}
    
    echo "🔧 $task_name..."
    if docker exec "$container_name" sh -c "cd /app && $command"; then
        echo "✅ $task_name PASSED"
        return 0
    else
        echo "❌ $task_name FAILED"
        docker logs "$container_name" --tail 30
        docker rm -f "$container_name"
        return 1
    fi
}

_copy_reports() {
    local container_name=$1
    local source_path=$2
    local dest_path=$3
    
    echo "📂 Copying reports..."
    mkdir -p "$dest_path"
    docker cp "$container_name:$source_path" "$dest_path/" 2>/dev/null || echo "No reports to copy from $source_path"
}

# ==================== BATCH FUNCTIONS ====================

# Simple command execution (lint, etc.)
run_simple_dind_command() {
    local container_name=$1
    local command=$2
    local task_description=${3:-"Running command"}
    
    echo "🐳 $task_description in true Docker-in-Docker mode"
    _setup_network
    _build_dev_image
    _cleanup_container "$container_name"
    _start_dev_container "$container_name"
    
    _copy_source_and_install "$container_name" || return 1
    _run_command_in_container "$container_name" "$command" "$task_description" || return 1
    
    docker rm -f "$container_name"
    echo "🎉 $task_description completed successfully!"
}

# Unit tests (client and server sequentially)
run_unit_tests_dind() {
    local container_name="website-dev-temp"
    
    echo "🐳 Running unit tests in true Docker-in-Docker mode"
    _setup_network
    _build_dev_image
    _cleanup_container "$container_name"
    _start_dev_container "$container_name"
    
    _copy_source_and_install "$container_name" || return 1
    _run_command_in_container "$container_name" "env TEST_ENV=client ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2" "Client-side tests" || return 1
    _run_command_in_container "$container_name" "env TEST_ENV=server ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2" "Server-side tests" || return 1
    
    docker rm -f "$container_name"
    echo "🎉 All unit tests completed successfully!"
}

# Mutation tests with dev server
run_mutation_tests_dind() {
    local container_name="website-dev-mutation"
    
    echo "🐳 Running mutation tests in true Docker-in-Docker mode"
    _setup_network
    _build_dev_image
    _cleanup_container "$container_name"
    _start_dev_container "$container_name"
    
    _copy_source_and_install "$container_name" || return 1
    
    echo "🚀 Starting dev server in background..."
    docker exec -d "$container_name" sh -c "cd /app && ./node_modules/.bin/next dev"
    
    # Wait for dev server with detailed debugging
    echo "⏳ Waiting for dev server to be ready..."
    for i in $(seq 1 60); do
        if docker exec "$container_name" sh -c "curl -f http://localhost:3000 >/dev/null 2>&1"; then
            echo "✅ Dev server is responding!"
            break
        fi
        echo "Attempt $i: Dev server not ready yet..."
        if [ $((i % 10)) -eq 0 ]; then
            docker exec "$container_name" ps aux 2>/dev/null | grep -E "(next|node)" || echo "No Next.js processes found"
            docker logs "$container_name" --tail 10
        fi
        sleep 3
        if [ $i -eq 60 ]; then
            echo "❌ Dev server failed to respond within 180 seconds"
            docker logs "$container_name" --tail 50
            docker rm -f "$container_name"
            return 1
        fi
    done
    
    _run_command_in_container "$container_name" "pnpm stryker run" "Stryker mutation tests" || return 1
    _copy_reports "$container_name" "/app/reports/mutation/." "reports/mutation"
    
    docker rm -f "$container_name"
    echo "🎉 Mutation tests completed successfully!"
}

echo "✅ Unit/Mutation/Lint batch functions loaded successfully" 