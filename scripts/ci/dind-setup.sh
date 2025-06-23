#!/bin/bash

# DIND (Docker-in-Docker) setup functions for CI/CD environments
# Refactored for maintainability with helper functions

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

# Production service helpers
_wait_for_prod_ready() {
    local port=${1:-3000}
    local timeout=${2:-60}
    
    echo "⏳ Waiting for production service to be ready..."
    for i in $(seq 1 $timeout); do
        if docker ps --filter "name=website-prod" --filter "status=running" --format "{{.Names}}" | grep -q "website-prod"; then
            if docker exec website-prod sh -c "curl -f http://localhost:$port >/dev/null 2>&1"; then
                echo "✅ Production service is ready on port $port!"
                return 0
            fi
        fi
        echo "Attempt $i: Production service not ready yet..."
        [ $((i % 15)) -eq 0 ] && docker ps --filter "name=website-prod" || echo "No prod containers found"
        sleep 3
    done
    echo "❌ Production service failed to start within $((timeout * 3)) seconds"
    return 1
}

_copy_reports() {
    local container_name=$1
    local source_path=$2
    local dest_path=$3
    
    echo "📂 Copying reports..."
    mkdir -p "$dest_path"
    docker cp "$container_name:$source_path" "$dest_path/" 2>/dev/null || echo "No reports to copy from $source_path"
}

# ==================== MAIN DIND FUNCTIONS ====================

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

# Lighthouse tests
run_lighthouse_dind() {
    local device_type=${1:-"desktop"}
    local config_file="lighthouserc.${device_type}.js"
    local reports_dir="lhci-reports-${device_type}"
    
    echo "🐳 Running Lighthouse $device_type audit in true Docker-in-Docker mode"
    _setup_network
    
    echo "Building production environment..."
    docker-compose -f docker-compose.yml -f docker-compose.healthcheck.yml -f docker-compose.test.yml build
    
    # Start with increased memory for Chrome
    printf 'services:\n  prod:\n    mem_limit: 2g\n    mem_reservation: 1g\n    shm_size: 2gb\n' > docker-compose.memory-override.yml
    docker-compose -f docker-compose.yml -f docker-compose.healthcheck.yml -f docker-compose.test.yml -f docker-compose.memory-override.yml up -d
    rm -f docker-compose.memory-override.yml
    
    _wait_for_prod_ready 3000 || return 1
    
    echo "📦 Installing Chrome and Lighthouse..."
    docker exec website-prod sh -c "apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0" || return 1
    
    docker cp "$config_file" website-prod:/app/ || return 1
    
    echo "🏃 Running Lighthouse $device_type audit..."
    if docker exec -w /app website-prod lhci autorun --config="$config_file" --collect.url=http://localhost:3000 --collect.chromePath=/usr/bin/chromium-browser --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding"; then
        echo "✅ Lighthouse $device_type audit PASSED"
    else
        echo "❌ Lighthouse $device_type audit FAILED"
        docker logs website-prod --tail 30
        return 1
    fi
    
    _copy_reports "website-prod" "/app/$reports_dir/." "$reports_dir"
    echo "🎉 Lighthouse $device_type audit completed successfully!"
}

# Playwright tests
run_playwright_dind() {
    local test_type=${1:-"e2e"}
    local timeout=${2:-"30000"}
    local reports_dir="playwright-${test_type}-reports"
    
    echo "🐳 Running $test_type tests in true Docker-in-Docker mode"
    
    # Wait for Playwright container to be ready
    for i in $(seq 1 30); do
        if docker ps --filter "name=website-playwright" --filter "status=running" --format "{{.Names}}" | grep -q "website-playwright"; then
            break
        fi
        echo "Attempt $i: Waiting for Playwright container..."
        sleep 2
        if [ $i -eq 30 ]; then
            echo "❌ Playwright container not available"
            return 1
        fi
    done
    
    mkdir -p "$reports_dir"
    docker cp . website-playwright:/app || echo "Warning: Failed to copy source code"
    
    if docker exec website-playwright sh -c "cd /app && npx playwright test src/test/$test_type --reporter=html --timeout=$timeout"; then
        echo "✅ $test_type tests PASSED"
    else
        echo "❌ $test_type tests FAILED"
        return 1
    fi
    
    _copy_reports "website-playwright" "/app/playwright-report/." "$reports_dir"
    echo "🎉 $test_type tests completed successfully!"
}

# Memory leak tests
run_memory_leak_dind() {
    echo "🐳 Running memory leak tests in true Docker-in-Docker mode"
    _setup_network
    _cleanup_container "website-prod"
    _cleanup_container "website-memory-leak-temp"
    
    echo "🏗️ Building production environment..."
    docker-compose -f docker-compose.yml -f docker-compose.healthcheck.yml -f docker-compose.test.yml build
    docker-compose -f docker-compose.yml -f docker-compose.healthcheck.yml -f docker-compose.test.yml up -d
    
    _wait_for_prod_ready 3000 || return 1
    
    echo "🧪 Building memory leak test container..."
    docker-compose -f docker-compose.test.memlab.yml build memory-leak
    
    echo "🛠️ Starting memory leak test container..."
    docker run -d --name website-memory-leak-temp --network website-network \
        --env NEXT_PUBLIC_PROD_CONTAINER_API_URL=http://website-prod:3000 \
        --env MEMLAB_DEBUG=true --env MEMLAB_SKIP_WARMUP=true --env DISPLAY=:99 \
        --shm-size=1gb website-memory-leak tail -f /dev/null
    
    # Copy test files and run tests
    docker cp src/test/memory-leak/. website-memory-leak-temp:/app/src/test/memory-leak/ || return 1
    docker cp src/config/i18nConfig.js website-memory-leak-temp:/app/src/config/ 2>/dev/null || true
    docker cp pages/i18n/localization.json website-memory-leak-temp:/app/pages/i18n/ 2>/dev/null || true
    
    docker exec website-memory-leak-temp sh -c "rm -rf /app/src/test/memory-leak/results"
    
    if docker exec website-memory-leak-temp sh -c "cd /app && node src/test/memory-leak/runMemlabTests.js"; then
        echo "✅ Memory leak tests PASSED"
    else
        echo "❌ Memory leak tests FAILED"
        docker logs website-memory-leak-temp --tail 30
        docker rm -f website-memory-leak-temp
        return 1
    fi
    
    _copy_reports "website-memory-leak-temp" "/app/src/test/memory-leak/results/." "memory-leak-results"
    docker rm -f website-memory-leak-temp
    echo "🎉 Memory leak tests completed successfully!"
}

# Load tests  
run_load_tests_dind() {
    echo "🐳 Running Load tests in true Docker-in-Docker mode"
    _setup_network
    
    # Install K6 in the CodeBuild environment (needed for container builds)
    echo "📦 Installing K6 binary..."
    apk add --no-cache curl tar || return 1
    K6_VERSION="v0.49.0"
    curl -L "https://github.com/grafana/k6/releases/download/${K6_VERSION}/k6-${K6_VERSION}-linux-amd64.tar.gz" -o k6.tar.gz || return 1
    tar -xzf k6.tar.gz || return 1
    mv "k6-${K6_VERSION}-linux-amd64/k6" /usr/local/bin/ || return 1
    rm -rf k6.tar.gz "k6-${K6_VERSION}-linux-amd64"
    k6 version || return 1
    
    echo "Building k6 container..."
    docker-compose -f docker-compose.test.yml --profile load build k6
    _cleanup_container "website-k6-temp"
    
    # Configure load test settings for DIND mode (container networking)
    mkdir -p src/test/load/results
    cp src/test/load/config.json.dist src/test/load/config.json
    sed -i 's/"host": "prod"/"host": "website-prod"/' src/test/load/config.json
    echo "✅ Configured load tests for DIND mode (targeting website-prod container)"
    
    docker run -d --name website-k6-temp --network website-network --entrypoint=/bin/sh website-k6 -c "while true; do sleep 60; done"
    docker cp src/test/load/. website-k6-temp:/loadTests/ || return 1
    
    if docker exec -w /loadTests website-k6-temp /bin/k6 run --summary-trend-stats='avg,min,med,max,p(95),p(99)' --out 'web-dashboard=period=1s&export=/loadTests/results/homepage.html' homepage.js; then
        echo "✅ Load tests PASSED"
    else
        echo "❌ Load tests FAILED"
        docker logs website-k6-temp --tail 30
        docker rm -f website-k6-temp
        return 1
    fi
    
    _copy_reports "website-k6-temp" "/loadTests/results/." "src/test/load/results"
    docker rm -f website-k6-temp
    echo "🎉 Load tests completed successfully!"
}

# Legacy function for backward compatibility
setup_dind_network() {
    echo "🔧 Setting up DIND network environment..."
    _setup_network
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Docker daemon not accessible"
        return 1
    fi
    echo "✅ DIND network setup complete"
}

echo "✅ DIND setup functions loaded successfully" 