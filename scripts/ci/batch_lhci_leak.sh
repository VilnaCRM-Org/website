#!/bin/bash
# Batch Lighthouse and Memory Leak Tests
# Groups Lighthouse and memory leak tests that can run in parallel
set -e

# Default configuration
NETWORK_NAME=${NETWORK_NAME:-"website-network"}
WEBSITE_DOMAIN=${WEBSITE_DOMAIN:-"localhost"}
DEV_PORT=${DEV_PORT:-"3000"}
NEXT_PUBLIC_PROD_PORT=${NEXT_PUBLIC_PROD_PORT:-"3001"}
PLAYWRIGHT_TEST_PORT=${PLAYWRIGHT_TEST_PORT:-"9323"}
UI_HOST=${UI_HOST:-"0.0.0.0"}
PROD_CONTAINER_NAME=${PROD_CONTAINER_NAME:-"website-prod"}

# Docker Compose files
DOCKER_COMPOSE_DEV_FILE=${DOCKER_COMPOSE_DEV_FILE:-"-f docker-compose.yml"}
DOCKER_COMPOSE_TEST_FILE=${DOCKER_COMPOSE_TEST_FILE:-"-f docker-compose.test.yml"}
COMMON_HEALTHCHECKS_FILE=${COMMON_HEALTHCHECKS_FILE:-"-f common-healthchecks.yml"}

echo "🐳 DIND Environment Setup Script"
echo "================================"

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

# Configure Docker Compose files for DIND
configure_docker_compose() {
    echo "🔧 Configuring Docker Compose files for DIND..."
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
}

# Setup Docker network for DIND
setup_docker_network() {
    echo "📡 Setting up Docker network..."
    docker network create "$NETWORK_NAME" 2>/dev/null || echo "Network $NETWORK_NAME already exists"
    echo "✅ Docker network configured"
}

# Enhanced container connectivity testing
test_container_connectivity() {
    echo "🔍 Enhanced container connectivity testing..."
    # Get production container IP
    PROD_IP=$(docker inspect website-prod --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "")
    if [ -n "$PROD_IP" ]; then
        echo "✅ Production container IP: $PROD_IP"
    else
        echo "⚠️  Could not get production container IP"
        return 1
    fi
    # Test DNS resolution
    echo "🔍 Testing DNS resolution..."
    docker exec website-playwright nslookup website-prod >/dev/null 2>&1 || echo "⚠️  DNS lookup failed for website-prod"
    docker exec website-playwright nslookup apollo >/dev/null 2>&1 || echo "⚠️  DNS lookup failed for apollo"
    # Test ping connectivity
    echo "🔍 Testing ping connectivity..."
    docker exec website-playwright ping -c 2 website-prod >/dev/null 2>&1 || echo "⚠️  Ping failed for website-prod"
    docker exec website-playwright ping -c 2 apollo >/dev/null 2>&1 || echo "⚠️  Ping failed for apollo"
    # Test HTTP connectivity
    echo "🔍 Testing HTTP connectivity..."
    docker exec website-playwright curl -f http://website-prod:3001 >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for website-prod:3001"
    docker exec website-playwright curl -f "http://$PROD_IP:3001" >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for $PROD_IP:3001"
    docker exec website-playwright curl -f http://apollo:4000/graphql >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for apollo:4000/graphql"
    echo "✅ Container connectivity testing completed"
}

# Wait for production service
wait_for_prod_dind() {
    echo "🐳 Waiting for prod service in true DinD mode using container networking..."
    echo "Checking if $PROD_CONTAINER_NAME container is running..."
    for i in $(seq 1 30); do
        if docker ps --filter "name=$PROD_CONTAINER_NAME" --filter "status=running" --format "{{.Names}}" | grep -q "$PROD_CONTAINER_NAME"; then
            echo "✅ Container $PROD_CONTAINER_NAME is running"
            break
        fi
        echo "Attempt $i: Container not running yet, waiting..."
        sleep 2
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
        sleep 3
        if [ "$i" -eq 60 ]; then
            echo "❌ Service failed to respond within 180 seconds"
            echo "Final container logs:"
            docker logs "$PROD_CONTAINER_NAME" --tail 50
            exit 1
        fi
    done
    # Run enhanced connectivity testing
    test_container_connectivity
}

# Start production environment in DIND mode
start_prod_dind() {
    echo "🐳 Starting production environment in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building production container image..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build
    echo "🚀 Starting production services..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE up -d
    wait_for_prod_dind
    echo "🎉 Production environment started successfully!"
}

# Function to run make commands with proper Docker setup for production tests
run_make_with_prod_dind() {
    local target=$1
    local description=$2
    local website_dir=$3
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    configure_docker_compose
    
    # Start production environment for tests that need it
    echo "🚀 Starting production environment for $description"
    start_prod_dind
    
    # Run make command with CI=0 to use Docker container commands (DIND mode)
    export DIND=1
    echo "🚀 Running: $description"
    echo "[INFO] Target: $target"
    echo "[INFO] Website directory: $website_dir"
    echo "[INFO] Makefile path: $website_dir/Makefile"
    
    if cd "$website_dir" && make "$target" CI=0; then
        echo "✅ $description completed successfully"
    else
        echo "❌ $description failed"
        exit 1
    fi
}

# Function to run memory leak tests in DIND mode using working container setup
run_memory_leak_tests_dind() {
    local website_dir=$1
    echo "🧠 Running Memory Leak tests in true Docker-in-Docker mode"
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    configure_docker_compose
    
    echo "Building production container image..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build
    
    echo "🚀 Starting production services..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE up -d
    
    # Wait for production service without the problematic connectivity test
    echo "🐳 Waiting for prod service in true DinD mode using container networking..."
    echo "Checking if $PROD_CONTAINER_NAME container is running..."
    for i in $(seq 1 30); do
        if docker ps --filter "name=$PROD_CONTAINER_NAME" --filter "status=running" --format "{{.Names}}" | grep -q "$PROD_CONTAINER_NAME"; then
            echo "✅ Container $PROD_CONTAINER_NAME is running"
            break
        fi
        echo "Attempt $i: Container not running yet, waiting..."
        sleep 2
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
        sleep 3
        if [ "$i" -eq 60 ]; then
            echo "❌ Service failed to respond within 180 seconds"
            echo "Final container logs:"
            docker logs "$PROD_CONTAINER_NAME" --tail 50
            exit 1
        fi
    done
    
    echo "🧹 Cleaning up any existing Memory Leak containers..."
    docker stop memory-leak-test 2>/dev/null || true
    docker rm memory-leak-test 2>/dev/null || true
    
    echo "Building memory leak container image..."
    docker-compose -f docker-compose.memory-leak.yml build
    
    echo "🧠 Running Memory Leak container..."
    docker-compose -f docker-compose.memory-leak.yml run -d --name memory-leak-test memory-leak sleep infinity
    
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

# Function to run Lighthouse desktop tests in DIND mode using working container setup
run_lighthouse_desktop_dind() {
    local website_dir=$1
    echo "🔦 Running Lighthouse Desktop tests using robust container approach"
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    
    # Set DIND-specific environment variables
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
      sleep 5
      timeout=$((timeout - 5))
    done
    if [ $timeout -le 0 ]; then
      echo "❌ Production service failed to start"
      docker compose -f docker-compose.test.yml logs prod
      exit 1
    fi
    
    # Wait for the service to be actually ready
    echo "⏳ Waiting for production service to be healthy..."
    timeout=60
    while [ $timeout -gt 0 ]; do
      if docker exec website-prod-1 curl -f http://localhost:3001 >/dev/null 2>&1; then
        echo "✅ Production service is healthy"
        break
      fi
      echo "⏳ Waiting for production service to be healthy... ($timeout seconds remaining)"
      sleep 5
      timeout=$((timeout - 5))
    done
    if [ $timeout -le 0 ]; then
      echo "❌ Production service failed to become healthy"
      docker compose -f docker-compose.test.yml logs prod
      exit 1
    fi
    
    echo "📦 Installing Chrome and Lighthouse CLI in prod container..."
    docker exec website-prod-1 sh -c "apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0"
    
    echo "📂 Copying Lighthouse config files to prod container..."
    docker cp lighthouserc.desktop.js website-prod-1:/app/
    
    echo "🧪 Testing Chrome installation..."
    if docker exec website-prod-1 /usr/bin/chromium-browser --version; then
        echo "✅ Chrome is installed and working"
    else
        echo "❌ Chrome installation test failed"
        exit 1
    fi
    
    echo "🔦 Running Lighthouse desktop tests..."
    docker exec -w /app website-prod-1 lhci autorun \
      --config=lighthouserc.desktop.js \
      --collect.url=http://localhost:3001 \
      --collect.chromePath=/usr/bin/chromium-browser \
      --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-software-rasterizer --disable-setuid-sandbox --single-process --no-zygote --js-flags=--max-old-space-size=4096"
    
    echo "📂 Copying lighthouse results from prod container..."
    mkdir -p lhci-reports-desktop
    docker cp website-prod-1:/app/lhci-reports-desktop/. lhci-reports-desktop/ 2>/dev/null || echo "No lighthouse results to copy"
    
    echo "🧹 Cleaning up Docker services..."
    docker compose -f docker-compose.test.yml down
    
    echo "✅ Lighthouse desktop tests completed"
}

# Function to run Lighthouse mobile tests in DIND mode using working container setup
run_lighthouse_mobile_dind() {
    local website_dir=$1
    echo "📱 Running Lighthouse Mobile tests using robust container approach"
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    
    # Set DIND-specific environment variables
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
      sleep 5
      timeout=$((timeout - 5))
    done
    if [ $timeout -le 0 ]; then
      echo "❌ Production service failed to start"
      docker compose -f docker-compose.test.yml logs prod
      exit 1
    fi
    
    # Wait for the service to be actually ready
    echo "⏳ Waiting for production service to be healthy..."
    timeout=60
    while [ $timeout -gt 0 ]; do
      if docker exec website-prod-1 curl -f http://localhost:3001 >/dev/null 2>&1; then
        echo "✅ Production service is healthy"
        break
      fi
      echo "⏳ Waiting for production service to be healthy... ($timeout seconds remaining)"
      sleep 5
      timeout=$((timeout - 5))
    done
    if [ $timeout -le 0 ]; then
      echo "❌ Production service failed to become healthy"
      docker compose -f docker-compose.test.yml logs prod
      exit 1
    fi
    
    echo "📦 Installing Chrome and Lighthouse CLI in prod container..."
    docker exec website-prod-1 sh -c "apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0"
    
    echo "📂 Copying Lighthouse config files to prod container..."
    docker cp lighthouserc.mobile.js website-prod-1:/app/
    
    echo "🧪 Testing Chrome installation..."
    if docker exec website-prod-1 /usr/bin/chromium-browser --version; then
        echo "✅ Chrome is installed and working"
    else
        echo "❌ Chrome installation test failed"
        exit 1
    fi
    
    echo "📱 Running Lighthouse mobile tests..."
    docker exec -w /app website-prod-1 lhci autorun \
      --config=lighthouserc.mobile.js \
      --collect.url=http://localhost:3001 \
      --collect.chromePath=/usr/bin/chromium-browser \
      --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-software-rasterizer --disable-setuid-sandbox --single-process --no-zygote --js-flags=--max-old-space-size=4096"
    
    echo "📂 Copying lighthouse results from prod container..."
    mkdir -p lhci-reports-mobile
    docker cp website-prod-1:/app/lhci-reports-mobile/. lhci-reports-mobile/ 2>/dev/null || echo "No lighthouse results to copy"
    
    echo "🧹 Cleaning up Docker services..."
    docker compose -f docker-compose.test.yml down
    
    echo "✅ Lighthouse mobile tests completed"
}

# Main execution logic
main() {
    local website_dir="${1:-.}"
    
    if [ ! -d "$website_dir" ]; then
        echo "❌ Website directory not found: $website_dir"
        exit 1
    fi
    
    echo "📁 Working directory: $(pwd)"
    echo "🌐 Website directory: $website_dir"
    echo "📋 Makefile path: $website_dir/Makefile"
    
    # Check if Makefile exists
    if [ ! -f "$website_dir/Makefile" ]; then
        echo "❌ Makefile not found in $website_dir"
        exit 1
    fi
    
    # Run memory leak tests
    if run_memory_leak_tests_dind "$website_dir"; then
        echo "✅ Memory leak tests completed successfully in DIND mode!"
    else
        echo "❌ Memory leak tests failed in DIND mode"
        exit 1
    fi
    
    # Run Lighthouse desktop tests
    if run_lighthouse_desktop_dind "$website_dir"; then
        echo "✅ Lighthouse desktop tests completed successfully in DIND mode!"
    else
        echo "❌ Lighthouse desktop tests failed in DIND mode"
        exit 1
    fi
    
    # Run Lighthouse mobile tests
    if run_lighthouse_mobile_dind "$website_dir"; then
        echo "✅ Lighthouse mobile tests completed successfully in DIND mode!"
    else
        echo "❌ Lighthouse mobile tests failed in DIND mode"
        exit 1
    fi
    
    echo "🎉 All Lighthouse and memory leak tests completed successfully!"
}

# Show usage information
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
    echo "using the Makefile commands with proper Docker container setup."
    echo ""
    echo "Examples:"
    echo "  $0 test-memory-leak    # Run only memory leak tests (backward compatible)"
    echo "  $0 .                   # Run all tests in current directory"
    echo "  $0 /path/to/website    # Run all tests in specified directory"
    echo ""
    echo "Environment Variables:"
    echo "  NETWORK_NAME           Docker network name (default: website-network)"
    echo "  WEBSITE_DOMAIN         Website domain (default: localhost)"
    echo "  DEV_PORT               Development port (default: 3000)"
    echo "  NEXT_PUBLIC_PROD_PORT  Production port (default: 3001)"
    echo "  PLAYWRIGHT_TEST_PORT   Playwright test port (default: 9323)"
    echo "  UI_HOST                UI host binding (default: 0.0.0.0)"
    echo "  PROD_CONTAINER_NAME    Production container name (default: website-prod)"
}

# Command line argument handling
case "${1:-help}" in
    help|--help|-h)
        show_usage
        exit 0
        ;;
    test-memory-leak)
        echo "🧪 Running memory leak tests only..."
        main "." && run_memory_leak_tests_dind "."
        ;;
    test-lighthouse-desktop)
        echo "🔍 Running Lighthouse desktop tests only..."
        main "." && run_lighthouse_desktop_dind "."
        ;;
    test-lighthouse-mobile)
        echo "🔍 Running Lighthouse mobile tests only..."
        main "." && run_lighthouse_mobile_dind "."
        ;;
    *)
        main "$@"
        ;;
esac 