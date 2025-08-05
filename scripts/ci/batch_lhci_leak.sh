#!/bin/bash

set -euo pipefail

NETWORK_NAME=${NETWORK_NAME:-"website-network"}
NEXT_PUBLIC_PROD_PORT=${NEXT_PUBLIC_PROD_PORT:-"3001"}
PROD_CONTAINER_NAME=${PROD_CONTAINER_NAME:-"website-prod"}

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
    PROD_IP=$(docker inspect website-prod --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "")
    if [ -n "$PROD_IP" ]; then
        echo "✅ Production container IP: $PROD_IP"
    else
        echo "⚠️  Could not get production container IP"
        return 1
    fi
    
    echo "🔍 Testing DNS resolution..."
    docker exec website-playwright nslookup website-prod >/dev/null 2>&1 || echo "⚠️  DNS lookup failed for website-prod"
    docker exec website-playwright nslookup apollo >/dev/null 2>&1 || echo "⚠️  DNS lookup failed for apollo"
    
    echo "🔍 Testing ping connectivity..."
    docker exec website-playwright ping -c 2 website-prod >/dev/null 2>&1 || echo "⚠️  Ping failed for website-prod"
    docker exec website-playwright ping -c 2 apollo >/dev/null 2>&1 || echo "⚠️  Ping failed for apollo"
    
    echo "🔍 Testing HTTP connectivity..."
    docker exec website-playwright curl -f http://website-prod:3001 >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for website-prod:3001"
    docker exec website-playwright curl -f "http://$PROD_IP:3001" >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for $PROD_IP:3001"
    docker exec website-playwright curl -f http://apollo:4000/graphql >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for apollo:4000/graphql"
    
    echo "✅ Container connectivity testing completed"
}

wait_for_prod_dind() {
    echo "🐳 Waiting for prod service in true DinD mode using container networking..."
    echo "Checking if $PROD_CONTAINER_NAME container is running..."
    for i in $(seq 1 30); do
        if docker ps --filter "name=$PROD_CONTAINER_NAME" --filter "status=running" --format "{{.Names}}" | grep -q "$PROD_CONTAINER_NAME"; then
            echo "✅ Container $PROD_CONTAINER_NAME is running"
            break
        fi
        echo "Attempt $i: Container not running yet, waiting..."
        if [ "$i" -eq 30 ]; then
            echo "❌ Container failed to start within 60 seconds"
            docker ps -a --filter "name=$PROD_CONTAINER_NAME"
            exit 1
        fi
    done
    
    echo "🔍 Testing $PROD_CONTAINER_NAME service connectivity on port $NEXT_PUBLIC_PROD_PORT..."
    for i in $(seq 1 60); do
        if docker exec "$PROD_CONTAINER_NAME" sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
            echo "✅ Service is responding on port $NEXT_PUBLIC_PROD_PORT!"
            break
        fi
        echo "Attempt $i: Service not ready, checking container status..."
        if [ "$((i % 10))" -eq 0 ]; then
            echo "Debug info at attempt $i:"
            docker exec "$PROD_CONTAINER_NAME" ps aux 2>/dev/null || echo "Cannot access container processes"
            docker exec "$PROD_CONTAINER_NAME" netstat -tulpn 2>/dev/null | grep ":$NEXT_PUBLIC_PROD_PORT" || echo "Port $NEXT_PUBLIC_PROD_PORT not bound"
        fi
        if [ "$i" -eq 60 ]; then
            echo "⚠️  Initial health check failed, but checking if service is actually working..."
            for j in {1..3}; do
                echo "Retry attempt $j: Checking service directly..."
                if docker exec "$PROD_CONTAINER_NAME" sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
                    echo "✅ Service is actually working (retry $j succeeded)"
                    break 2
                fi
            done
            if ! docker exec "$PROD_CONTAINER_NAME" sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
                echo "❌ Service failed to respond after retries"
            echo "Final container logs:"
            docker logs "$PROD_CONTAINER_NAME" --tail 50
            exit 1
            fi
        fi
    done
    
    test_container_connectivity
}

start_prod_dind() {
    echo "🐳 Starting production environment in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    make create-network
    echo "Building production container image..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" build
    echo "🚀 Starting production services..."
    make start-prod
    wait_for_prod_dind
    echo "🎉 Production environment started successfully!"
}

run_memory_leak_tests_dind() {
    local website_dir=$1
    echo "🧠 Running Memory Leak tests in true Docker-in-Docker mode"
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    
    echo "Building production container image..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" build
    
    echo "🚀 Starting production services..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d
    
    echo "🐳 Waiting for prod service in true DinD mode using container networking..."
    echo "Checking if $PROD_CONTAINER_NAME container is running..."
    for i in $(seq 1 30); do
        if docker ps --filter "name=$PROD_CONTAINER_NAME" --filter "status=running" --format "{{.Names}}" | grep -q "$PROD_CONTAINER_NAME"; then
            echo "✅ Container $PROD_CONTAINER_NAME is running"
            break
        fi
        echo "Attempt $i: Container not running yet, waiting..."
        if [ "$i" -eq 30 ]; then
            echo "❌ Container failed to start within 60 seconds"
            docker ps -a --filter "name=$PROD_CONTAINER_NAME"
            exit 1
        fi
    done
    
    echo "🔍 Testing $PROD_CONTAINER_NAME service connectivity on port $NEXT_PUBLIC_PROD_PORT..."
    for i in $(seq 1 60); do
        if docker exec "$PROD_CONTAINER_NAME" sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
            echo "✅ Service is responding on port $NEXT_PUBLIC_PROD_PORT!"
            break
        fi
        echo "Attempt $i: Service not ready, checking container status..."
        if [ "$((i % 10))" -eq 0 ]; then
            echo "Debug info at attempt $i:"
            docker exec "$PROD_CONTAINER_NAME" ps aux 2>/dev/null || echo "Cannot access container processes"
            docker exec "$PROD_CONTAINER_NAME" netstat -tulpn 2>/dev/null | grep ":$NEXT_PUBLIC_PROD_PORT" || echo "Port $NEXT_PUBLIC_PROD_PORT not bound"
        fi
        if [ "$i" -eq 60 ]; then
            echo "⚠️  Initial health check failed, but checking if service is actually working..."
            for j in {1..3}; do
                echo "Retry attempt $j: Checking service directly..."
                if docker exec "$PROD_CONTAINER_NAME" sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
                    echo "✅ Service is actually working (retry $j succeeded)"
                    break 2
                fi
            done
            if ! docker exec "$PROD_CONTAINER_NAME" sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
                echo "❌ Service failed to respond after retries"
            echo "Final container logs:"
            docker logs "$PROD_CONTAINER_NAME" --tail 50
            exit 1
            fi
        fi
    done
    
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
    echo "🔦 Running Lighthouse Desktop tests using robust container approach"
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    
    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"
    
    echo "🚀 Starting production services with DIND configuration..."
    docker compose -f docker-compose.test.yml up -d --build prod
    
    echo "⏳ Waiting for production service to be ready..."
    timeout=60
    while [ $timeout -gt 0 ]; do
      if docker compose -f docker-compose.test.yml ps prod | grep -q "Up"; then
        echo "✅ Production service is running"
        break
      fi
      echo "⏳ Waiting for production service to start... ($timeout seconds remaining)"
      timeout=$((timeout - 1))
    done
    if [ $timeout -le 0 ]; then
      echo "❌ Production service failed to start"
      docker compose -f docker-compose.test.yml logs prod
      exit 1
    fi
    
    echo "⏳ Waiting for production service to be healthy..."
    timeout=60
    while [ $timeout -gt 0 ]; do
      if docker exec website-prod curl -f http://localhost:3001 >/dev/null 2>&1; then
        echo "✅ Production service is healthy"
        break
      fi
      echo "⏳ Waiting for production service to be healthy... ($timeout seconds remaining)"
      timeout=$((timeout - 1))
    done
    if [ $timeout -le 0 ]; then
      echo "⚠️  Direct health check failed, but checking if service is actually working..."
      for i in {1..3}; do
        echo "Retry attempt $i: Checking service directly..."
        if docker exec website-prod curl -f http://localhost:3001 >/dev/null 2>&1; then
          echo "✅ Production service is actually working (retry $i succeeded)"
          break
        fi
      done
      if ! docker exec website-prod curl -f http://localhost:3001 >/dev/null 2>&1; then
        echo "❌ Production service failed to become healthy after retries"
      docker compose -f docker-compose.test.yml logs prod
      exit 1
      fi
    fi
    
    echo "📦 Installing Chrome and Lighthouse CLI in prod container..."
    docker exec website-prod sh -c "apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0"
    
    echo "📂 Copying Lighthouse config files to prod container..."
    docker cp lighthouserc.desktop.js website-prod:/app/
    
    echo "🧪 Testing Chrome installation..."
    if docker exec website-prod /usr/bin/chromium-browser --version; then
        echo "✅ Chrome is installed and working"
    else
        echo "❌ Chrome installation test failed"
        exit 1
    fi
    
    echo "🔦 Running Lighthouse desktop tests..."
    docker exec -w /app website-prod lhci autorun \
      --config=lighthouserc.desktop.js \
      --collect.url=http://localhost:3001 \
      --collect.chromePath=/usr/bin/chromium-browser \
      --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-software-rasterizer --disable-setuid-sandbox --single-process --no-zygote --js-flags=--max-old-space-size=4096"
    
    echo "📂 Copying lighthouse results from prod container..."
    mkdir -p lhci-reports-desktop
    docker cp website-prod:/app/lhci-reports-desktop/. lhci-reports-desktop/ 2>/dev/null || echo "No lighthouse results to copy"
    
    echo "🧹 Cleaning up Docker services..."
    docker compose -f docker-compose.test.yml down
    
    echo "✅ Lighthouse desktop tests completed"
}

run_lighthouse_mobile_dind() {
    local website_dir=$1
    echo "📱 Running Lighthouse Mobile tests using robust container approach"
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    
    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"
    
    echo "🚀 Starting production services with DIND configuration..."
    docker compose -f docker-compose.test.yml up -d --build prod
    
    echo "⏳ Waiting for production service to be ready..."
    timeout=60
    while [ $timeout -gt 0 ]; do
      if docker compose -f docker-compose.test.yml ps prod | grep -q "Up"; then
        echo "✅ Production service is running"
        break
      fi
      echo "⏳ Waiting for production service to start... ($timeout seconds remaining)"
      timeout=$((timeout - 1))
    done
    if [ $timeout -le 0 ]; then
      echo "❌ Production service failed to start"
      docker compose -f docker-compose.test.yml logs prod
      exit 1
    fi
    
    echo "⏳ Waiting for production service to be healthy..."
    timeout=60
    while [ $timeout -gt 0 ]; do
      if docker exec website-prod curl -f http://localhost:3001 >/dev/null 2>&1; then
        echo "✅ Production service is healthy"
        break
      fi
      echo "⏳ Waiting for production service to be healthy... ($timeout seconds remaining)"
      timeout=$((timeout - 1))
    done
    if [ $timeout -le 0 ]; then
      echo "⚠️  Direct health check failed, but checking if service is actually working..."
      for i in {1..3}; do
        echo "Retry attempt $i: Checking service directly..."
        if docker exec website-prod curl -f http://localhost:3001 >/dev/null 2>&1; then
          echo "✅ Production service is actually working (retry $i succeeded)"
          break
        fi
      done
      if ! docker exec website-prod curl -f http://localhost:3001 >/dev/null 2>&1; then
        echo "❌ Production service failed to become healthy after retries"
      docker compose -f docker-compose.test.yml logs prod
      exit 1
      fi
    fi
    
    echo "📦 Installing Chrome and Lighthouse CLI in prod container..."
    docker exec website-prod sh -c "apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0"
    
    echo "📂 Copying Lighthouse config files to prod container..."
    docker cp lighthouserc.mobile.js website-prod:/app/
    
    echo "🧪 Testing Chrome installation..."
    if docker exec website-prod /usr/bin/chromium-browser --version; then
        echo "✅ Chrome is installed and working"
    else
        echo "❌ Chrome installation test failed"
        exit 1
    fi
    
    echo "📱 Running Lighthouse mobile tests..."
    docker exec -w /app website-prod lhci autorun \
      --config=lighthouserc.mobile.js \
      --collect.url=http://localhost:3001 \
      --collect.chromePath=/usr/bin/chromium-browser \
      --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-software-rasterizer --disable-setuid-sandbox --single-process --no-zygote --js-flags=--max-old-space-size=4096"
    
    echo "📂 Copying lighthouse results from prod container..."
    mkdir -p lhci-reports-mobile
    docker cp website-prod:/app/lhci-reports-mobile/. lhci-reports-mobile/ 2>/dev/null || echo "No lighthouse results to copy"
    
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
    echo "  NEXT_PUBLIC_PROD_PORT  Production port (default: 3001)"
    echo "  PROD_CONTAINER_NAME    Production container name (default: website-prod)"
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