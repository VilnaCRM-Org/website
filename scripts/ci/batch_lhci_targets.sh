#!/bin/bash

# Batch Lighthouse (LHCI) Tests Script
# Contains DIND implementations for Lighthouse desktop and mobile audits

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

# Lighthouse tests
run_lighthouse_dind() {
    local device_type=${1:-"desktop"}
    local config_file="lighthouserc.${device_type}.js"
    local reports_dir="lhci-reports-${device_type}"
    
    echo "🐳 Running Lighthouse $device_type audit in true Docker-in-Docker mode"
    _setup_network
    
    echo "Building production environment..."
    docker-compose -f docker-compose.test.yml -f common-healthchecks.yml build
    
    # Start with increased memory for Chrome
    printf 'services:\n  prod:\n    mem_limit: 2g\n    mem_reservation: 1g\n    shm_size: 2gb\n' > docker-compose.memory-override.yml
    docker-compose -f docker-compose.test.yml -f common-healthchecks.yml -f docker-compose.memory-override.yml up -d
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

# Memory leak tests
run_memory_leak_dind() {
    echo "🐳 Running memory leak tests in true Docker-in-Docker mode"
    _setup_network
    _cleanup_container "website-prod"
    _cleanup_container "website-memory-leak-temp"
    
    echo "🏗️ Building production environment..."
    docker-compose -f docker-compose.test.yml -f common-healthchecks.yml build
    docker-compose -f docker-compose.test.yml -f common-healthchecks.yml up -d
    
    _wait_for_prod_ready 3000 || return 1
    
    echo "🧪 Building memory leak test container..."
    docker-compose -f docker-compose.memory-leak.yml build memory-leak
    
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

echo "✅ Lighthouse/Memory-leak batch functions loaded successfully" 