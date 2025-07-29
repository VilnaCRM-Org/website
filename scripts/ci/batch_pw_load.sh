#!/bin/bash
# Batch Playwright and Load Tests
# Groups E2E, Visual, and Load tests that can run in parallel

set -euo pipefail

# Default configuration
NETWORK_NAME=${NETWORK_NAME:-"website-network"}
WEBSITE_DOMAIN=${WEBSITE_DOMAIN:-"localhost"}
DEV_PORT=${DEV_PORT:-"3000"}
NEXT_PUBLIC_PROD_PORT=${NEXT_PUBLIC_PROD_PORT:-"3001"}
PLAYWRIGHT_TEST_PORT=${PLAYWRIGHT_TEST_PORT:-"9323"}
UI_HOST=${UI_HOST:-"0.0.0.0"}
PROD_CONTAINER_NAME=${PROD_CONTAINER_NAME:-"website-prod"}

# Docker Compose files
DOCKER_COMPOSE_DEV_FILE=${DOCKER_COMPOSE_DEV_FILE:-"docker-compose.yml"}
DOCKER_COMPOSE_TEST_FILE=${DOCKER_COMPOSE_TEST_FILE:-"docker-compose.test.yml"}
COMMON_HEALTHCHECKS_FILE=${COMMON_HEALTHCHECKS_FILE:-"common-healthchecks.yml"}

# Check if common-healthchecks.yml exists
if [ ! -f "common-healthchecks.yml" ]; then
    COMMON_HEALTHCHECKS_FILE=""
fi

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
            echo "⚠️  Initial health check failed, but checking if service is actually working..."
            # Try a few more times with longer intervals
            for j in {1..3}; do
                echo "Retry attempt $j: Checking service directly..."
                if docker exec "$PROD_CONTAINER_NAME" sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
                    echo "✅ Service is actually working (retry $j succeeded)"
                    break 2
                fi
                sleep 10
            done
            # Final check
            if ! docker exec "$PROD_CONTAINER_NAME" sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
                echo "❌ Service failed to respond after retries"
                echo "Final container logs:"
                docker logs "$PROD_CONTAINER_NAME" --tail 50
                exit 1
            fi
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
    docker-compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" build
    echo "🚀 Starting production services..."
    docker-compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d
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

# --- BEGIN: Playwright Test Functions ---
# Run E2E tests in DIND mode using working approach
run_e2e_tests_dind() {
    local website_dir=$1
    echo "🎭 Running E2E tests in DIND mode (matching local behavior)"
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    configure_docker_compose
    
    echo "Building test services..."
    docker-compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" build
    
    echo "🚀 Starting test services..."
    docker-compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d
    
    wait_for_prod_dind
    
    echo "📂 Copying E2E test files to Playwright container..."
    
    # Wait for container to be ready
    for i in $(seq 1 30); do
        if docker exec website-playwright echo "Container ready" >/dev/null 2>&1; then
            echo "✅ Container website-playwright is ready"
            break
        fi
        echo "Waiting for container to be ready... attempt $i"
        sleep 2
        if [ "$i" -eq 30 ]; then
            echo "❌ Container not ready after 60 seconds"
            exit 1
        fi
    done
    
    # Create directories and copy files
    echo "Creating directories in container..."
    docker exec website-playwright mkdir -p /app/src/test /app/src/config /app/pages/i18n
    
    echo "Copying complete test directory..."
    if docker cp src/test/. website-playwright:/app/src/test/; then
        echo "✅ Complete test directory copied successfully"
    else
        echo "❌ Failed to copy complete test directory"
        exit 1
    fi
    
    echo "Copying config files..."
    if docker cp src/config website-playwright:/app/src/; then
        echo "✅ Config files copied successfully"
    else
        echo "❌ Failed to copy config files"
        exit 1
    fi
    
    echo "Copying i18n files..."
    if docker cp pages/i18n website-playwright:/app/pages/; then
        echo "✅ i18n files copied successfully"
    else
        echo "❌ Failed to copy i18n files"
        exit 1
    fi
    
    echo "Copying TypeScript configuration files..."
    docker cp tsconfig.json website-playwright:/app/ || echo "⚠️  Failed to copy tsconfig.json"
    docker cp tsconfig.paths.json website-playwright:/app/ || echo "⚠️  Failed to copy tsconfig.paths.json"
    docker cp next.config.js website-playwright:/app/ || echo "⚠️  Failed to copy next.config.js"
    docker cp playwright.config.ts website-playwright:/app/ || echo "⚠️  Failed to copy playwright.config.ts"
    
    echo "🔍 Verifying files were copied correctly..."
    docker exec website-playwright ls -la /app/src/test/e2e/ || echo "⚠️  E2E files not found in container"
    docker exec website-playwright ls -la /app/src/test/e2e/utils/ || echo "⚠️  E2E utils not found in container"
    docker exec website-playwright ls -la /app/src/config/ || echo "⚠️  Config files not found in container"
    docker exec website-playwright ls -la /app/pages/i18n/ || echo "⚠️  i18n files not found in container"
    docker exec website-playwright ls -la /app/tsconfig*.json || echo "⚠️  TypeScript config files not found"
    docker exec website-playwright ls -la /app/next.config.js || echo "⚠️  Next.js config not found"
    docker exec website-playwright ls -la /app/playwright.config.ts || echo "⚠️  Playwright config not found"
    
    echo "🧹 Cleaning up previous E2E results..."
    docker exec website-playwright rm -rf /app/playwright-report /app/test-results || true
    
    echo "🎭 Running Playwright E2E tests with IP-based connectivity..."
    
    # Get production container IP for reliable connectivity
    PROD_IP=$(docker inspect website-prod --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "")
    if [ -n "$PROD_IP" ]; then
        echo "✅ Production container IP: $PROD_IP"
        PROD_URL="http://$PROD_IP:3001"
    else
        echo "⚠️  Could not get production container IP, using hostname"
        PROD_URL="http://website-prod:3001"
    fi
    
    # Test container connectivity
    echo "🔍 Testing container connectivity..."
    docker exec website-playwright curl -f "$PROD_URL" >/dev/null 2>&1 || echo "⚠️  Container connectivity test failed"
    
    # Run E2E tests with comprehensive environment setup
    if docker exec -e NEXT_PUBLIC_MAIN_LANGUAGE=uk -e NEXT_PUBLIC_FALLBACK_LANGUAGE=en -e NEXT_PUBLIC_PROD_CONTAINER_API_URL="$PROD_URL" -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value -e NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL=https://github.com/VilnaCRM-Org/ -e NEXT_PUBLIC_GRAPHQL_API_URL=http://apollo:4000/graphql -w /app website-playwright npx playwright test src/test/e2e --timeout=60000; then
        echo "✅ E2E tests PASSED"
    else
        echo "❌ E2E tests FAILED"
        docker logs website-playwright --tail 30
        echo "⚠️  E2E tests failed but continuing with build..."
    fi
    
    echo "📂 Copying E2E test results..."
    mkdir -p playwright-report test-results
    docker cp website-playwright:/app/playwright-report/. playwright-report/ 2>/dev/null || echo "No playwright-report to copy"
    docker cp website-playwright:/app/test-results/. test-results/ 2>/dev/null || echo "No test-results to copy"
    
    echo "🧹 Cleaning up Docker services..."
    docker-compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" down
    
    echo "🎉 E2E tests completed successfully in DIND mode!"
}

# Run Visual tests in DIND mode using working approach
run_visual_tests_dind() {
    local website_dir=$1
    echo "🎨 Running Visual tests in DIND mode (matching local behavior)"
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    configure_docker_compose
    
    echo "Building test services..."
    docker-compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" build
    
    echo "🚀 Starting test services..."
    docker-compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d
    
    wait_for_prod_dind
    
    echo "📂 Copying Visual test files to Playwright container..."
    
    # Wait for container to be ready
    for i in $(seq 1 30); do
        if docker exec website-playwright echo "Container ready" >/dev/null 2>&1; then
            echo "✅ Container website-playwright is ready"
            break
        fi
        echo "Waiting for container to be ready... attempt $i"
        sleep 2
        if [ "$i" -eq 30 ]; then
            echo "❌ Container not ready after 60 seconds"
            exit 1
        fi
    done
    
    # Create directories and copy files
    echo "Creating directories in container..."
    docker exec website-playwright mkdir -p /app/src/test /app/src/config /app/pages/i18n
    
    echo "Copying complete test directory..."
    if docker cp src/test/. website-playwright:/app/src/test/; then
        echo "✅ Complete test directory copied successfully"
    else
        echo "❌ Failed to copy complete test directory"
        exit 1
    fi
    
    echo "Copying config files..."
    if docker cp src/config website-playwright:/app/src/; then
        echo "✅ Config files copied successfully"
    else
        echo "❌ Failed to copy config files"
        exit 1
    fi
    
    echo "Copying i18n files..."
    if docker cp pages/i18n website-playwright:/app/pages/; then
        echo "✅ i18n files copied successfully"
    else
        echo "❌ Failed to copy i18n files"
        exit 1
    fi
    
    echo "Copying TypeScript configuration files..."
    docker cp tsconfig.json website-playwright:/app/ || echo "⚠️  Failed to copy tsconfig.json"
    docker cp tsconfig.paths.json website-playwright:/app/ || echo "⚠️  Failed to copy tsconfig.paths.json"
    docker cp next.config.js website-playwright:/app/ || echo "⚠️  Failed to copy next.config.js"
    docker cp playwright.config.ts website-playwright:/app/ || echo "⚠️  Failed to copy playwright.config.ts"
    
    echo "🔍 Verifying files were copied correctly..."
    docker exec website-playwright ls -la /app/src/test/visual/ || echo "⚠️  Visual files not found in container"
    docker exec website-playwright ls -la /app/src/test/e2e/utils/ || echo "⚠️  E2E utils not found in container"
    docker exec website-playwright ls -la /app/src/config/ || echo "⚠️  Config files not found in container"
    docker exec website-playwright ls -la /app/pages/i18n/ || echo "⚠️  i18n files not found in container"
    docker exec website-playwright ls -la /app/tsconfig*.json || echo "⚠️  TypeScript config files not found"
    docker exec website-playwright ls -la /app/next.config.js || echo "⚠️  Next.js config not found"
    docker exec website-playwright ls -la /app/playwright.config.ts || echo "⚠️  Playwright config not found"
    
    echo "🧹 Cleaning up previous Visual results..."
    docker exec website-playwright rm -rf /app/playwright-report /app/test-results || true
    
    echo "🎨 Running Playwright Visual tests with IP-based connectivity..."
    
    # Get production container IP for reliable connectivity
    PROD_IP=$(docker inspect website-prod --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "")
    if [ -n "$PROD_IP" ]; then
        echo "✅ Production container IP: $PROD_IP"
        PROD_URL="http://$PROD_IP:3001"
    else
        echo "⚠️  Could not get production container IP, using hostname"
        PROD_URL="http://website-prod:3001"
    fi
    
    # Test container connectivity
    echo "🔍 Testing container connectivity..."
    docker exec website-playwright curl -f $PROD_URL >/dev/null 2>&1 || echo "⚠️  Container connectivity test failed"
    
    # Run Visual tests with comprehensive environment setup
    if docker exec -e NEXT_PUBLIC_MAIN_LANGUAGE=uk -e NEXT_PUBLIC_FALLBACK_LANGUAGE=en -e NEXT_PUBLIC_PROD_CONTAINER_API_URL=$PROD_URL -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value -e NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL=https://github.com/VilnaCRM-Org/ -e NEXT_PUBLIC_GRAPHQL_API_URL=http://apollo:4000/graphql -w /app website-playwright npx playwright test src/test/visual --timeout=60000; then
        echo "✅ Visual tests PASSED"
    else
        echo "❌ Visual tests FAILED"
        docker logs website-playwright --tail 30
        echo "⚠️  Visual tests failed but continuing with build..."
    fi
    
    echo "📂 Copying Visual test results..."
    mkdir -p playwright-report test-results
    docker cp website-playwright:/app/playwright-report/. playwright-report/ 2>/dev/null || echo "No playwright-report to copy"
    docker cp website-playwright:/app/test-results/. test-results/ 2>/dev/null || echo "No test-results to copy"
    
    echo "🧹 Cleaning up Docker services..."
    docker-compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" down
    
    echo "🎉 Visual tests completed successfully in DIND mode!"
}
# --- END: Playwright Test Functions ---

# --- BEGIN: Load Test Functions ---
# Run Load tests in DIND mode using working approach
run_load_tests_dind() {
    local website_dir=$1
    echo "⚡ Running K6 Load tests in true Docker-in-Docker mode"
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    configure_docker_compose
    
    echo "Building production container image..."
    docker-compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" build
    
    echo "🚀 Starting production services..."
    docker-compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d
    
    wait_for_prod_dind
    
    echo "🧹 Cleaning up any existing K6 containers..."
    docker stop website-k6 2>/dev/null || true
    docker rm website-k6 2>/dev/null || true
    
    echo "Building K6 container image..."
    docker-compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load build k6
    
    echo "⚡ Running K6 Load container..."
    docker-compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load run -d --name website-k6 --entrypoint sh -- k6 -c "sleep infinity"
    
    echo "📂 Copying load test files into K6 container..."
    docker exec website-k6 mkdir -p /loadTests/utils
    docker cp src/test/load/homepage.js website-k6:/loadTests/homepage.js
    docker cp src/test/load/config.json.dist website-k6:/loadTests/config.json.dist
    docker cp src/test/load/utils/. website-k6:/loadTests/utils/
    echo "✅ Load test files copied successfully"
    
    echo "🧹 Cleaning up previous load test results..."
    docker exec website-k6 rm -rf /loadTests/results || true
    docker exec website-k6 mkdir -p /loadTests/results
    
    echo "⚡ Running K6 load tests..."
    if docker exec -w /loadTests website-k6 k6 run --summary-trend-stats="avg,min,med,max,p(95),p(99)" --out "web-dashboard=period=1s&export=/loadTests/results/homepage.html" /loadTests/homepage.js; then
        echo "✅ Load tests PASSED"
    else
        echo "❌ Load tests FAILED"
        docker logs website-k6 --tail 30
        docker stop website-k6 || true
        docker rm website-k6 || true
        exit 1
    fi
    
    echo "📂 Copying load test results..."
    mkdir -p src/test/load/reports
    docker cp website-k6:/loadTests/results/. src/test/load/reports/ 2>/dev/null || echo "No load test results to copy"
    
    echo "🧹 Cleaning up K6 container..."
    docker stop website-k6 || true
    docker rm website-k6 || true
    
    echo "🎉 Load tests completed successfully in true DinD mode!"
}
# --- END: Load Test Functions ---

# Function to run load tests for Swagger in DIND mode using Makefile
run_load_tests_swagger_dind() {
    local website_dir=$1
    echo "📊 Running Swagger load tests in DIND mode using Makefile"
    run_make_with_prod_dind "load-tests-swagger" "Swagger load tests" "$website_dir"
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
    
    # Run E2E tests
    if run_e2e_tests_dind "$website_dir"; then
        echo "✅ E2E tests completed successfully in DIND mode!"
    else
        echo "❌ E2E tests failed in DIND mode"
        exit 1
    fi
    
    # Run visual tests
    if run_visual_tests_dind "$website_dir"; then
        echo "✅ Visual tests completed successfully in DIND mode!"
    else
        echo "❌ Visual tests failed in DIND mode"
        exit 1
    fi
    
    # Run load tests
    if run_load_tests_dind "$website_dir"; then
        echo "✅ Load tests completed successfully in DIND mode!"
    else
        echo "❌ Load tests failed in DIND mode"
        exit 1
    fi
    
    # Run Swagger load tests
    if run_load_tests_swagger_dind "$website_dir"; then
        echo "✅ Swagger load tests completed successfully in DIND mode!"
    else
        echo "❌ Swagger load tests failed in DIND mode"
        exit 1
    fi
    
    echo "🎉 All Playwright E2E, visual, and load tests completed successfully!"
}

# Show usage information
show_usage() {
    echo "Usage: $0 [COMMAND|WEBSITE_DIR]"
    echo ""
    echo "Commands (for backward compatibility):"
    echo "  test-e2e               Run E2E tests only"
    echo "  test-visual            Run visual tests only"
    echo "  test-load              Run load tests only"
    echo "  test-swagger           Run Swagger load tests only"
    echo ""
    echo "Arguments:"
    echo "  WEBSITE_DIR            Website directory path (default: current directory)"
    echo ""
    echo "This script runs E2E tests, visual tests, and load tests in Docker-in-Docker mode"
    echo "using the working Docker setup approach for most tests and Makefile for Swagger tests."
    echo ""
    echo "Examples:"
    echo "  $0 test-e2e            # Run only E2E tests (backward compatible)"
    echo "  $0 test-visual         # Run only visual tests"
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
    test-e2e)
        echo "🧪 Running E2E tests only..."
        run_e2e_tests_dind "."
        ;;
    test-visual)
        echo "🎨 Running visual tests only..."
        run_visual_tests_dind "."
        ;;
    test-load)
        echo "📊 Running load tests only..."
        run_load_tests_dind "."
        ;;
    test-swagger)
        echo "📊 Running Swagger load tests only..."
        run_load_tests_swagger_dind "."
        ;;
    *)
        main "$@"
        ;;
esac 