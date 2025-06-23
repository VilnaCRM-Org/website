#!/bin/bash

# Batch Playwright and Load Tests Script
# Contains DIND implementations for Playwright E2E/Visual tests, Memory leak tests, and Load tests

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

# ==================== BATCH FUNCTIONS ====================

# Playwright tests (E2E, Visual, etc.) - Complete implementation
run_playwright_dind() {
    local test_type=${1:-"e2e"}
    local timeout=${2:-"30000"}
    local ui_mode=${3:-"false"}
    local update_snapshots=${4:-"false"}
    local reports_dir="playwright-${test_type}-reports"
    
    echo "🐳 Running $test_type tests in true Docker-in-Docker mode"
    _setup_network
    
    # Build and start production environment
    echo "🏗️ Building production environment..."
    docker-compose -f docker-compose.test.yml -f common-healthchecks.yml build
    docker-compose -f docker-compose.test.yml -f common-healthchecks.yml up -d
    
    # Wait for production to be ready on port 3001
    _wait_for_prod_ready 3001 || return 1
    
    # Wait for Playwright container to be ready
    echo "🎭 Waiting for Playwright container to be ready..."
    for i in $(seq 1 30); do
        if docker ps --filter "name=website-playwright" --filter "status=running" --format "{{.Names}}" | grep -q "website-playwright"; then
            echo "✅ Playwright container is running"
            break
        fi
        echo "Attempt $i: Playwright container not running yet, waiting..."
        sleep 2
        if [ $i -eq 30 ]; then
            echo "❌ Playwright container failed to start within 60 seconds"
            docker ps -a --filter "name=website-playwright"
            return 1
        fi
    done
    
    echo "📂 Copying source code to Playwright container..."
    docker cp . website-playwright:/app || echo "Warning: Failed to copy source code"
    
    mkdir -p "$reports_dir"
    
    # Build test command based on options
    local test_cmd="cd /app && npx playwright test src/test/$test_type --reporter=html --timeout=$timeout"
    
    if [ "$ui_mode" = "true" ]; then
        echo "🎨 Running Playwright $test_type tests with UI mode..."
        test_cmd="$test_cmd --ui-port=9324 --ui-host=0.0.0.0"
    elif [ "$update_snapshots" = "true" ]; then
        echo "📸 Updating Playwright $test_type snapshots..."
        test_cmd="$test_cmd --update-snapshots"
    else
        echo "🧪 Running Playwright $test_type tests..."
    fi
    
    if docker exec website-playwright sh -c "$test_cmd"; then
        echo "✅ $test_type tests PASSED"
    else
        echo "❌ $test_type tests FAILED"
        echo "🔍 Debugging: Checking Playwright install and test files..."
        docker exec website-playwright sh -c "npx playwright --version && find /app -path '*/$test_type/*.spec.ts' | head -5" || true
        return 1
    fi
    
    _copy_reports "website-playwright" "/app/playwright-report/." "$reports_dir"
    echo "🎉 $test_type tests completed successfully!"
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

echo "✅ Playwright/Load batch functions loaded successfully" 