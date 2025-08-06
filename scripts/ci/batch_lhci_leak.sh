#!/bin/bash

set -euo pipefail

NETWORK_NAME=${NETWORK_NAME:-"website-network"}
WEBSITE_DOMAIN=${WEBSITE_DOMAIN:-"localhost"}
NEXT_PUBLIC_PROD_PORT=${NEXT_PUBLIC_PROD_PORT:-"3001"}
PROD_CONTAINER_NAME=${PROD_CONTAINER_NAME:-"website-prod"}
PLAYWRIGHT_CONTAINER_NAME=${PLAYWRIGHT_CONTAINER_NAME:-"website-playwright"}

DOCKER_COMPOSE_DEV_FILE=${DOCKER_COMPOSE_DEV_FILE:-"docker-compose.yml"}
DOCKER_COMPOSE_TEST_FILE=${DOCKER_COMPOSE_TEST_FILE:-"docker-compose.test.yml"}
COMMON_HEALTHCHECKS_FILE=${COMMON_HEALTHCHECKS_FILE:-"common-healthchecks.yml"}

if [ ! -f "common-healthchecks.yml" ]; then
    COMMON_HEALTHCHECKS_FILE=""
fi

echo "🐳 DIND Environment Setup Script"
echo "================================"



setup_docker_network() {
    echo "📡 Setting up Docker network..."
    docker network create "$NETWORK_NAME" 2>/dev/null || echo "Network $NETWORK_NAME already exists"
    echo "✅ Docker network configured"
}

test_container_connectivity() {
    echo "🔍 Enhanced container connectivity testing..."
    PROD_IP=$(docker inspect "$PROD_CONTAINER_NAME" --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "")
    if [ -n "$PROD_IP" ]; then
        echo "✅ Production container IP: $PROD_IP"
    else
        echo "⚠️  Could not get production container IP"
        return 1
    fi
    
    echo "🔍 Testing DNS resolution..."
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" nslookup $PROD_CONTAINER_NAME >/dev/null 2>&1 || echo "⚠️  DNS lookup failed for $PROD_CONTAINER_NAME"
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" nslookup apollo >/dev/null 2>&1 || echo "⚠️  DNS lookup failed for apollo"
    
    echo "🔍 Testing ping connectivity..."
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" ping -c 2 $PROD_CONTAINER_NAME >/dev/null 2>&1 || echo "⚠️  Ping failed for $PROD_CONTAINER_NAME"
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" ping -c 2 apollo >/dev/null 2>&1 || echo "⚠️  Ping failed for apollo"
    
    echo "🔍 Testing HTTP connectivity..."
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" curl -f http://$PROD_CONTAINER_NAME:3001 >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for $PROD_CONTAINER_NAME:3001"
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" curl -f "http://$PROD_IP:3001" >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for $PROD_IP:3001"
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" curl -f http://apollo:4000/graphql >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for apollo:4000/graphql"
    
    echo "✅ Container connectivity testing completed"
}

start_prod_dind() {
    echo "🐳 Starting production environment in true Docker-in-Docker mode"
    setup_docker_network
    echo "Building production container image..."
    make build-prod
    echo "🚀 Starting production services..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d
    echo "🎉 Production environment started successfully!"
}

run_memory_leak_tests_dind() {
    local website_dir=$1
    echo "🧠 Running Memory Leak tests using Makefile approach"
    
    setup_docker_network
    echo "Building production container image..."
    make build-prod
    echo "🚀 Starting production services..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d
    
    echo "🧹 Cleaning up any existing Memory Leak containers..."
    docker stop memory-leak-test 2>/dev/null || true
    docker rm memory-leak-test 2>/dev/null || true
    
    echo "Building memory leak container image..."
    docker compose -f docker-compose.memory-leak.yml build
    
    echo "🧠 Running Memory Leak container..."
    docker compose -f docker-compose.memory-leak.yml run -d --name memory-leak-test memory-leak sleep infinity
    
    echo "📂 Copying source files into memory leak container..."
    docker exec memory-leak-test mkdir -p /app/src/test /app/src/config /app/pages/i18n
    docker cp src/test/memory-leak memory-leak-test:/app/src/test/memory-leak
    echo "✅ Memory leak test files copied successfully"
    
    echo "📂 Copying required config files..."
    docker cp src/config memory-leak-test:/app/src/config  
    docker cp pages/i18n memory-leak-test:/app/pages/i18n
    
    echo "🧹 Cleaning up previous memory leak results..."
    docker exec memory-leak-test rm -rf /app/src/test/memory-leak/results || true
    
    echo "🧠 Running Memlab memory leak tests..."
    if docker exec -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value -w /app memory-leak-test node src/test/memory-leak/runMemlabTests.js; then
        echo "✅ Memory leak tests PASSED"
    else
        echo "❌ Memory leak tests FAILED"
        docker logs memory-leak-test --tail 30
        docker stop memory-leak-test || true
        docker rm memory-leak-test || true
        exit 1
    fi
    
    echo "📂 Copying memory leak test results..."
    mkdir -p memory-leak-logs
    docker cp memory-leak-test:/app/src/test/memory-leak/results/. memory-leak-logs/ 2>/dev/null || echo "No memory leak results to copy"
    docker logs memory-leak-test > memory-leak-logs/test-execution.log 2>&1 || true
    
    echo "🧹 Cleaning up memory leak container..."
    docker stop memory-leak-test || true
    docker rm memory-leak-test || true
    
    echo "🎉 Memory leak tests completed successfully in true DinD mode!"
}

run_lighthouse_desktop_dind() {
    local website_dir=$1
    echo "🔦 Running Lighthouse Desktop tests using Makefile approach"
    
    setup_docker_network
    echo "Building production container image..."
    make build-prod
    echo "🚀 Starting production services..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d
    
    echo "📦 Installing Chrome and Lighthouse CLI in prod container..."
    docker exec "$PROD_CONTAINER_NAME" sh -c "apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0"
    
    echo "🔧 Setting up Chrome workspace with increased memory..."
    docker exec "$PROD_CONTAINER_NAME" sh -c "mkdir -p /tmp/chrome-workspace && chmod 777 /tmp/chrome-workspace"
    
    echo "📂 Copying Lighthouse config files to prod container..."
    docker cp lighthouserc.desktop.js "$PROD_CONTAINER_NAME:/app/"
    
    echo "🧪 Testing Chrome installation..."
    if docker exec "$PROD_CONTAINER_NAME" /usr/bin/chromium-browser --version; then
        echo "✅ Chrome is installed and working"
    else
        echo "❌ Chrome installation test failed"
        exit 1
    fi
    
    echo "🧪 Testing Chrome startup with DIND flags..."
    if docker exec "$PROD_CONTAINER_NAME" timeout 10 /usr/bin/chromium-browser --no-sandbox --disable-dev-shm-usage --headless --disable-gpu --single-process --no-zygote --dump-dom about:blank >/dev/null 2>&1; then
        echo "✅ Chrome can start successfully with DIND flags"
    else
        echo "⚠️ Chrome startup test failed, but continuing (this may indicate potential issues)"
    fi
    
    echo "🔦 Running Lighthouse desktop tests..."
    docker exec -w /app "$PROD_CONTAINER_NAME" lhci autorun \
      --config=lighthouserc.desktop.js \
      --collect.url=http://localhost:3001 \
      --collect.chromePath=/usr/bin/chromium-browser \
      --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-software-rasterizer --disable-setuid-sandbox --single-process --no-zygote --disable-web-security --disable-features=TranslateUI --disable-ipc-flooding-protection --disable-crash-reporter --disable-breakpad --disable-component-extensions-with-background-pages --memory-pressure-off --max_old_space_size=4096 --js-flags=--max-old-space-size=4096 --user-data-dir=/tmp/chrome-workspace --data-path=/tmp/chrome-workspace --disk-cache-dir=/tmp/chrome-workspace/cache"
    
    echo "📂 Copying lighthouse results from prod container..."
    mkdir -p lhci-reports-desktop
    docker cp "$PROD_CONTAINER_NAME:/app/lhci-reports-desktop/." lhci-reports-desktop/ 2>/dev/null || echo "No lighthouse results to copy"
    
    echo "🧹 Cleaning up Docker services..."
    docker compose -f docker-compose.test.yml down
    
    echo "✅ Lighthouse desktop tests completed"
}

run_lighthouse_mobile_dind() {
    local website_dir=$1
    echo "📱 Running Lighthouse Mobile tests using Makefile approach"
    
    setup_docker_network
    echo "Building production container image..."
    make build-prod
    echo "🚀 Starting production services..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d
    
    echo "📦 Installing Chrome and Lighthouse CLI in prod container..."
    docker exec "$PROD_CONTAINER_NAME" sh -c "apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0"
    
    echo "🔧 Setting up Chrome workspace with increased memory..."
    docker exec "$PROD_CONTAINER_NAME" sh -c "mkdir -p /tmp/chrome-workspace && chmod 777 /tmp/chrome-workspace"
    
    echo "📂 Copying Lighthouse config files to prod container..."
    docker cp lighthouserc.mobile.js "$PROD_CONTAINER_NAME:/app/"
    
    echo "🧪 Testing Chrome installation..."
    if docker exec "$PROD_CONTAINER_NAME" /usr/bin/chromium-browser --version; then
        echo "✅ Chrome is installed and working"
    else
        echo "❌ Chrome installation test failed"
        exit 1
    fi
    
    echo "🧪 Testing Chrome startup with DIND flags..."
    if docker exec "$PROD_CONTAINER_NAME" timeout 10 /usr/bin/chromium-browser --no-sandbox --disable-dev-shm-usage --headless --disable-gpu --single-process --no-zygote --dump-dom about:blank >/dev/null 2>&1; then
        echo "✅ Chrome can start successfully with DIND flags"
    else
        echo "⚠️ Chrome startup test failed, but continuing (this may indicate potential issues)"
    fi
    
    echo "📱 Running Lighthouse mobile tests..."
    docker exec -w /app "$PROD_CONTAINER_NAME" lhci autorun \
      --config=lighthouserc.mobile.js \
      --collect.url=http://localhost:3001 \
      --collect.chromePath=/usr/bin/chromium-browser \
      --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-software-rasterizer --disable-setuid-sandbox --single-process --no-zygote --disable-web-security --disable-features=TranslateUI --disable-ipc-flooding-protection --disable-crash-reporter --disable-breakpad --disable-component-extensions-with-background-pages --memory-pressure-off --max_old_space_size=4096 --js-flags=--max-old-space-size=4096 --user-data-dir=/tmp/chrome-workspace --data-path=/tmp/chrome-workspace --disk-cache-dir=/tmp/chrome-workspace/cache"
    
    echo "📂 Copying lighthouse results from prod container..."
    mkdir -p lhci-reports-mobile
    docker cp "$PROD_CONTAINER_NAME:/app/lhci-reports-mobile/." lhci-reports-mobile/ 2>/dev/null || echo "No lighthouse results to copy"
    
    echo "🧹 Cleaning up Docker services..."
    docker compose -f docker-compose.test.yml down
    
    echo "✅ Lighthouse mobile tests completed"
}

main() {
    local website_dir="${1:-.}"
    
    if [ ! -d "$website_dir" ]; then
        echo "❌ Website directory not found: $website_dir"
        exit 1
    fi
    
    echo "📁 Working directory: $(pwd)"
    echo "🌐 Website directory: $website_dir"
    
    if run_memory_leak_tests_dind "$website_dir"; then
        echo "✅ Memory leak tests completed successfully in DIND mode!"
    else
        echo "❌ Memory leak tests failed in DIND mode"
        exit 1
    fi
    
    if run_lighthouse_desktop_dind "$website_dir"; then
        echo "✅ Lighthouse desktop tests completed successfully in DIND mode!"
    else
        echo "❌ Lighthouse desktop tests failed in DIND mode"
        exit 1
    fi
    
    if run_lighthouse_mobile_dind "$website_dir"; then
        echo "✅ Lighthouse mobile tests completed successfully in DIND mode!"
    else
        echo "❌ Lighthouse mobile tests failed in DIND mode"
        exit 1
    fi
    
    echo "🎉 All Lighthouse and memory leak tests completed successfully!"
}

show_usage() {
    echo "Usage: $0 [COMMAND|WEBSITE_DIR]"
    echo ""
    echo "Commands (for backward compatibility):"
    echo "  test-memory-leak       Run memory leak tests only"
    echo "  test-lighthouse-desktop Run Lighthouse desktop tests only"
    echo "  test-lighthouse-mobile Run Lighthouse mobile tests only"
    echo ""
    echo "Arguments:"
    echo "  WEBSITE_DIR            Website directory path (default: current directory)"
    echo ""
    echo "This script runs Lighthouse and memory leak tests in Docker-in-Docker mode"
    echo "using the working Docker setup approach."
    echo ""
    echo "Examples:"
    echo "  $0 test-memory-leak"
    echo "  $0 ."
    echo "  $0 /path/to/website"
    echo ""
    echo "Environment Variables:"
    echo "  NETWORK_NAME           Docker network name (default: website-network)"
    echo "  WEBSITE_DOMAIN         Website domain (default: localhost)"
    echo "  NEXT_PUBLIC_PROD_PORT  Production port (default: 3001)"
    echo "  PROD_CONTAINER_NAME    Production container name (default: $PROD_CONTAINER_NAME)"
}

case "${1:-help}" in
    help|--help|-h)
        show_usage
        exit 0
        ;;
    test-memory-leak)
        echo "🧪 Running memory leak tests only..."
        run_memory_leak_tests_dind "."
        ;;
    test-lighthouse-desktop)
        echo "🔍 Running Lighthouse desktop tests only..."
        run_lighthouse_desktop_dind "."
        ;;
    test-lighthouse-mobile)
        echo "🔍 Running Lighthouse mobile tests only..."
        run_lighthouse_mobile_dind "."
        ;;
    *)
        main "$@"
        ;;
esac 