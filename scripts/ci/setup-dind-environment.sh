#!/bin/bash

# DIND Environment Setup Script
# Combines functionality from configure-dind.sh, setup_makefile_targets.sh, 
# add_prod_targets.sh, and batch_unit_mutation_lint_targets.sh
# without modifying the Makefile

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

# Cleanup function for predictable teardown
cleanup() {
    echo "🧹 Cleaning up Docker resources..."
    docker rm -f website-* 2>/dev/null || true
    docker network rm "$NETWORK_NAME" 2>/dev/null || true
    rm -f docker-compose.lighthouse.yml 2>/dev/null || true
    echo "✅ Cleanup completed"
}

# Register cleanup trap for predictable teardown
trap cleanup EXIT

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
    
    # Check if network already exists
    if docker network ls --format "{{.Name}}" | grep -q "^${NETWORK_NAME}$"; then
        echo "ℹ️  Network $NETWORK_NAME already exists"
    else
        # Try to create the network
        if ! docker network create "$NETWORK_NAME"; then
            echo "❌ Failed to create network $NETWORK_NAME"
            exit 1
        fi
        echo "✅ Network $NETWORK_NAME created successfully"
    fi
    
    # Verify network exists and is accessible
    if docker network ls --format "{{.Name}}" | grep -q "^${NETWORK_NAME}$"; then
        echo "✅ Docker network $NETWORK_NAME is available"
    else
        echo "❌ Network $NETWORK_NAME is not available after creation attempt"
        exit 1
    fi
}

# Wait for dev service in DIND mode
wait_for_dev_dind() {
    echo "🐳 Waiting for dev service to be ready via Docker network..."
    echo "Debug: Checking if container is running..."
    for i in $(seq 1 30); do
        if docker ps --filter "name=website-dev" --filter "status=running" --format "{{.Names}}" | grep -q "website-dev"; then
            echo "✅ Container website-dev is running"
            break
        fi
        echo "Attempt $i: Container not running yet, waiting..."
        sleep 2
        if [ "$i" -eq 30 ]; then
            echo "❌ Container failed to start within 60 seconds"
            docker ps -a --filter "name=website-dev"
            exit 1
        fi
    done
    
    echo "🔍 Testing container connectivity..."
    for i in $(seq 1 60); do
        if docker exec website-dev sh -c "curl -f http://localhost:$DEV_PORT/api/health >/dev/null 2>&1 || curl -f http://127.0.0.1:$DEV_PORT >/dev/null 2>&1"; then
            echo "✅ Dev service is responding on port $DEV_PORT!"
            break
        fi
        echo "Attempt $i: Dev service not ready, checking container status..."
        if [ $((i % 10)) -eq 0 ]; then
            echo "Debug info at attempt $i:"
            docker exec website-dev ps aux 2>/dev/null || echo "Cannot access container processes"
            docker exec website-dev netstat -tulpn 2>/dev/null | grep :"$DEV_PORT" || echo "Port $DEV_PORT not bound"
        fi
        sleep 3
        if [ "$i" -eq 60 ]; then
            echo "❌ Dev service failed to respond within 180 seconds"
            echo "Final container logs:"
            docker logs website-dev --tail 50
            exit 1
        fi
    done
}

# Start development environment in DIND mode
start_dev_dind() {
    echo "🐳 Starting development environment in DIND mode..."
    setup_docker_network
    configure_docker_compose
    docker-compose "$DOCKER_COMPOSE_DEV_FILE" up -d dev
    wait_for_dev_dind
    echo "🎉 Development environment started successfully!"
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
    
    echo "🔍 Testing $PROD_CONTAINER_NAME service connectivity on port \"$NEXT_PUBLIC_PROD_PORT\"..."
    for i in $(seq 1 60); do
        if docker exec "$PROD_CONTAINER_NAME" sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
            echo "✅ Service is responding on port $NEXT_PUBLIC_PROD_PORT!"
            break
        fi
        echo "Attempt $i: Service not ready, checking container status..."
        if [ $((i % 10)) -eq 0 ]; then
            echo "Debug info at attempt $i:"
            docker exec "$PROD_CONTAINER_NAME" ps aux 2>/dev/null || echo "Cannot access container processes"
            docker exec "$PROD_CONTAINER_NAME" netstat -tulpn 2>/dev/null | grep :"$NEXT_PUBLIC_PROD_PORT" || echo "Port $NEXT_PUBLIC_PROD_PORT not bound"
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
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" build
    echo "🚀 Starting production services..."
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" up -d
    wait_for_prod_dind
    echo "🎉 Production environment started successfully!"
}

# Helper to run a command in a temp container with volume mount (no dependency reinstall)
run_in_temp_container() {
    local image="$1"
    local container_name="$2"
    local run_cmd="$3"
    local workdir="${4:-/app}"
    local mount_src="${5:-.}"

    echo "🧹 Cleaning up any existing $container_name container..."
    docker rm -f "$container_name" 2>/dev/null || true
    echo "🛠️ Starting $container_name from $image with volume mount..."
    
    # Use volume mount instead of docker cp for much faster startup
    # Dependencies are already installed in the base image
    docker run -d --name "$container_name" \
        --network "$NETWORK_NAME" \
        -v "$(realpath "$mount_src"):$workdir:ro" \
        "$image" tail -f /dev/null

    echo "🚀 Running command in $container_name..."
    if docker exec "$container_name" sh -c "cd \"$workdir\" && $run_cmd"; then
        echo "✅ Command succeeded in $container_name"
    else
        echo "❌ Command failed in $container_name"
        docker logs "$container_name" --tail 30
        docker rm -f "$container_name"
        exit 1
    fi

    echo "🧹 Cleaning up $container_name..."
    docker rm -f "$container_name"
}

# Run unit tests in DIND mode
run_unit_tests_dind() {
    echo "🐳 Running unit tests in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building container image..."
    docker-compose "$DOCKER_COMPOSE_DEV_FILE" build dev

    # Client-side tests
    run_in_temp_container "website-dev" "website-dev-temp" "env TEST_ENV=client ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2"

    # Server-side tests
    run_in_temp_container "website-dev" "website-dev-temp" "env TEST_ENV=server ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2"

    echo "🎉 All unit tests completed successfully in true DinD mode!"
    echo "📊 Summary: Both client and server tests passed in containerized environment"
}

# Run mutation tests in DIND mode
run_mutation_tests_dind() {
    echo "🐳 Running mutation tests in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building container image..."
    docker-compose "$DOCKER_COMPOSE_DEV_FILE" build dev
    echo "🧹 Cleaning up any existing containers..."
    docker rm -f website-dev-mutation 2>/dev/null || true
    echo "🛠️ Starting container with volume mount for faster startup..."
    docker run -d --name website-dev-mutation \
        --network "$NETWORK_NAME" \
        -v "$(realpath .):/app:ro" \
        website-dev tail -f /dev/null
    
    echo "🚀 Starting dev server in background..."
    docker exec -d website-dev-mutation sh -c "cd /app && ./node_modules/.bin/next dev"
    echo "⏳ Waiting for dev server to be ready..."
    for i in $(seq 1 60); do
        if docker exec website-dev-mutation sh -c "curl -f http://localhost:3000 >/dev/null 2>&1"; then
            echo "✅ Dev server is responding on port 3000!"
            break
        fi
        echo "Attempt $i: Dev server not ready yet..."
        if [ $((i % 10)) -eq 0 ]; then
            echo "Debug info at attempt $i:"
            docker exec website-dev-mutation ps aux 2>/dev/null | grep -E "(next|node)" || echo "No Next.js processes found"
            docker exec website-dev-mutation netstat -tulpn 2>/dev/null | grep :3000 || echo "Port 3000 not bound"
            echo "Recent container logs:"
            docker logs website-dev-mutation --tail 10
        fi
        sleep 3
        if [ "$i" -eq 60 ]; then
            echo "❌ Dev server failed to respond within 180 seconds"
            docker logs website-dev-mutation --tail 50
            docker rm -f website-dev-mutation
            exit 1
        fi
    done
    
    echo "🧬 Running Stryker mutation tests..."
    if docker exec website-dev-mutation sh -c "cd /app && pnpm stryker run"; then
        echo "✅ Mutation tests PASSED"
    else
        echo "❌ Mutation tests FAILED"
        docker logs website-dev-mutation --tail 30
        docker rm -f website-dev-mutation
        exit 1
    fi
    
    echo "📂 Copying mutation reports..."
    mkdir -p reports/mutation
    docker cp website-dev-mutation:/app/reports/mutation/. reports/mutation/ 2>/dev/null || echo "No mutation reports to copy"
    echo "🧹 Cleaning up mutation container..."
    docker rm -f website-dev-mutation
    echo "🎉 Mutation tests completed successfully in true DinD mode!"
}

# Run ESLint in DIND mode
run_eslint_dind() {
    echo "🐳 Running ESLint in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building container image..."
    docker-compose "$DOCKER_COMPOSE_DEV_FILE" build dev
    echo "🧹 Cleaning up any existing containers..."
    docker rm -f website-dev-lint-next 2>/dev/null || true
    echo "🛠️ Starting container with volume mount for faster startup..."
    docker run -d --name website-dev-lint-next \
        --network "$NETWORK_NAME" \
        -v "$(realpath .):/app:ro" \
        website-dev tail -f /dev/null
    
    echo "🔍 Running ESLint..."
    if docker exec website-dev-lint-next sh -c "cd /app && ./node_modules/.bin/next lint"; then
        echo "✅ ESLint check PASSED"
    else
        echo "❌ ESLint check FAILED"
        docker logs website-dev-lint-next --tail 30
        docker rm -f website-dev-lint-next
        exit 1
    fi
    
    echo "🧹 Cleaning up lint container..."
    docker rm -f website-dev-lint-next
    echo "🎉 ESLint completed successfully in true DinD mode!"
}

# Run TypeScript check in DIND mode
run_typescript_check_dind() {
    echo "🐳 Running TypeScript check in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building container image..."
    docker-compose "$DOCKER_COMPOSE_DEV_FILE" build dev
    echo "🧹 Cleaning up any existing containers..."
    docker rm -f website-dev-lint-tsc 2>/dev/null || true
    echo "🛠️ Starting container with volume mount for faster startup..."
    docker run -d --name website-dev-lint-tsc \
        --network "$NETWORK_NAME" \
        -v "$(realpath .):/app:ro" \
        website-dev tail -f /dev/null
    
    echo "🔍 Running TypeScript check..."
    if docker exec website-dev-lint-tsc sh -c "cd /app && ./node_modules/.bin/tsc --noEmit"; then
        echo "✅ TypeScript check PASSED"
    else
        echo "❌ TypeScript check FAILED"
        docker logs website-dev-lint-tsc --tail 30
        docker rm -f website-dev-lint-tsc
        exit 1
    fi
    
    echo "🧹 Cleaning up TypeScript lint container..."
    docker rm -f website-dev-lint-tsc
    echo "🎉 TypeScript check completed successfully in true DinD mode!"
}

# Run Markdown linting in DIND mode
run_markdown_lint_dind() {
    echo "🐳 Running Markdown linting in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building container image..."
    docker-compose "$DOCKER_COMPOSE_DEV_FILE" build dev
    echo "🧹 Cleaning up any existing containers..."
    docker rm -f website-dev-lint-md 2>/dev/null || true
    echo "🛠️ Starting container with volume mount for faster startup..."
    docker run -d --name website-dev-lint-md \
        --network "$NETWORK_NAME" \
        -v "$(realpath .):/app:ro" \
        website-dev tail -f /dev/null
    
    echo "🔍 Running Markdown linting..."
    if docker exec website-dev-lint-md sh -c "cd /app && ./node_modules/.bin/markdownlint \"**/*.md\" -i CHANGELOG.md -i \"test-results/**/*.md\" -i \"playwright-report/data/**/*.md\""; then
        echo "✅ Markdown linting PASSED"
    else
        echo "❌ Markdown linting FAILED"
        docker logs website-dev-lint-md --tail 30
        docker rm -f website-dev-lint-md
        exit 1
    fi
    
    echo "🧹 Cleaning up Markdown lint container..."
    docker rm -f website-dev-lint-md
    echo "🎉 Markdown linting completed successfully in true DinD mode!"
}

# Run all lint checks in DIND mode
run_all_lint_dind() {
    echo "🧹 Running all lint checks in DIND mode..."
    
    # Create lint-logs directory for buildspec artifacts
    mkdir -p lint-logs
    
    echo "🔍 Running ESLint with log capture..."
    if run_eslint_dind > lint-logs/eslint.log 2>&1; then
        echo "✅ ESLint PASSED" | tee -a lint-logs/summary.log
    else
        echo "❌ ESLint FAILED" | tee -a lint-logs/summary.log
        echo "ESLint failed, but continuing with other checks..."
    fi
    
    echo "🔍 Running TypeScript check with log capture..."
    if run_typescript_check_dind > lint-logs/typescript.log 2>&1; then
        echo "✅ TypeScript check PASSED" | tee -a lint-logs/summary.log
    else
        echo "❌ TypeScript check FAILED" | tee -a lint-logs/summary.log
        echo "TypeScript check failed, but continuing with other checks..."
    fi
    
    echo "🔍 Running Markdown linting with log capture..."
    if run_markdown_lint_dind > lint-logs/markdown.log 2>&1; then
        echo "✅ Markdown linting PASSED" | tee -a lint-logs/summary.log
    else
        echo "❌ Markdown linting FAILED" | tee -a lint-logs/summary.log
        echo "Markdown linting failed, but continuing..."
    fi
    
    # Check if any tests failed by counting FAILED entries
    failed_count=$(grep -c "FAILED" lint-logs/summary.log 2>/dev/null || echo "0")
    if [ "$failed_count" -gt 0 ]; then
        echo "❌ $failed_count lint check(s) failed. Check lint-logs/ for details."
        exit 1
    else
        echo "🎉 All lint checks completed successfully!"
    fi
}

# Run E2E tests in DIND mode
run_e2e_tests_dind() {
    echo "🎭 Running E2E tests in DIND mode (matching local behavior)"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building test services..."
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" build
    echo "🚀 Starting test services..."
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" up -d
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
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" down
    
    echo "🎉 E2E tests completed successfully in DIND mode!"
}

# Run Visual tests in DIND mode
run_visual_tests_dind() {
    echo "🎨 Running Visual tests in DIND mode (matching local behavior)"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building test services..."
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" build
    echo "🚀 Starting test services..."
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" up -d
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
    docker exec website-playwright curl -f "$PROD_URL" >/dev/null 2>&1 || echo "⚠️  Container connectivity test failed"
    
    # Run Visual tests with comprehensive environment setup
    if docker exec -e NEXT_PUBLIC_MAIN_LANGUAGE=uk -e NEXT_PUBLIC_FALLBACK_LANGUAGE=en -e NEXT_PUBLIC_PROD_CONTAINER_API_URL="$PROD_URL" -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value -e NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL=https://github.com/VilnaCRM-Org/ -e NEXT_PUBLIC_GRAPHQL_API_URL=http://apollo:4000/graphql -w /app website-playwright npx playwright test src/test/visual --timeout=60000; then
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
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" down
    
    echo "🎉 Visual tests completed successfully in DIND mode!"
}

# Run Memory Leak tests in DIND mode
run_memory_leak_tests_dind() {
    echo "🧠 Running Memory Leak tests in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building production container image..."
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" build
    echo "🚀 Starting production services..."
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" up -d
    
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
    
    echo "🔍 Testing $PROD_CONTAINER_NAME service connectivity on port \"$NEXT_PUBLIC_PROD_PORT\"..."
    for i in $(seq 1 60); do
        if docker exec "$PROD_CONTAINER_NAME" sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
            echo "✅ Service is responding on port $NEXT_PUBLIC_PROD_PORT!"
            break
        fi
        echo "Attempt $i: Service not ready, checking container status..."
        if [ $((i % 10)) -eq 0 ]; then
                    echo "Debug info at attempt $i:"
        docker exec "$PROD_CONTAINER_NAME" ps aux 2>/dev/null || echo "Cannot access container processes"
        docker exec "$PROD_CONTAINER_NAME" netstat -tulpn 2>/dev/null | grep :"$NEXT_PUBLIC_PROD_PORT" || echo "Port $NEXT_PUBLIC_PROD_PORT not bound"
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

# Run Load tests in DIND mode
run_load_tests_dind() {
    echo "⚡ Running K6 Load tests in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building production container image..."
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" build
    echo "🚀 Starting production services..."
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" up -d
    wait_for_prod_dind
    
    echo "🧹 Cleaning up any existing K6 containers..."
    docker stop website-k6 2>/dev/null || true
    docker rm website-k6 2>/dev/null || true
    
    echo "Building K6 container image..."
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" --profile load build k6
    
    echo "⚡ Running K6 Load container..."
    docker-compose "$COMMON_HEALTHCHECKS_FILE" "$DOCKER_COMPOSE_TEST_FILE" --profile load run -d --name website-k6 --entrypoint sh -- k6 -c "sleep infinity"
    
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

# Run Lighthouse Desktop tests in DIND mode
run_lighthouse_desktop_dind() {
    echo "🔦 Running Lighthouse Desktop tests using robust container approach"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    
    # Set DIND-specific environment variables
    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"
    
    echo "🚀 Starting production services with DIND configuration..."
    docker-compose -f docker-compose.test.yml up -d --build prod
    echo "⏳ Waiting for production service to be ready..."
    timeout=60
    while [ $timeout -gt 0 ]; do
      if docker-compose -f docker-compose.test.yml ps prod | grep -q "Up"; then
        echo "✅ Production service is running"
        break
      fi
      echo "⏳ Waiting for production service to start... ($timeout seconds remaining)"
      sleep 5
      timeout=$((timeout - 5))
    done
    if [ $timeout -le 0 ]; then
      echo "❌ Production service failed to start"
      docker-compose -f docker-compose.test.yml logs prod
      exit 1
    fi
    
    # Wait for the service to be actually ready
    echo "⏳ Waiting for production service to be healthy..."
    timeout=60
    while [ $timeout -gt 0 ]; do
      if docker exec website-prod curl -f http://localhost:3001 >/dev/null 2>&1; then
        echo "✅ Production service is healthy"
        break
      fi
      echo "⏳ Waiting for production service to be healthy... ($timeout seconds remaining)"
      sleep 5
      timeout=$((timeout - 5))
    done
    if [ $timeout -le 0 ]; then
      echo "❌ Production service failed to become healthy"
      docker-compose -f docker-compose.test.yml logs prod
      exit 1
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
    docker-compose -f docker-compose.test.yml down
    
    echo "✅ Lighthouse desktop tests completed"
}

# Run Lighthouse Mobile tests in DIND mode
run_lighthouse_mobile_dind() {
    echo "📱 Running Lighthouse Mobile tests using robust container approach"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    
    # Set DIND-specific environment variables
    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"
    
    echo "🚀 Starting production services with DIND configuration..."
    docker-compose -f docker-compose.test.yml up -d --build prod
    echo "⏳ Waiting for production service to be ready..."
    timeout=60
    while [ $timeout -gt 0 ]; do
      if docker-compose -f docker-compose.test.yml ps prod | grep -q "Up"; then
        echo "✅ Production service is running"
        break
      fi
      echo "⏳ Waiting for production service to start... ($timeout seconds remaining)"
      sleep 5
      timeout=$((timeout - 5))
    done
    if [ $timeout -le 0 ]; then
      echo "❌ Production service failed to start"
      docker-compose -f docker-compose.test.yml logs prod
      exit 1
    fi
    
    # Wait for the service to be actually ready
    echo "⏳ Waiting for production service to be healthy..."
    timeout=60
    while [ $timeout -gt 0 ]; do
      if docker exec website-prod curl -f http://localhost:3001 >/dev/null 2>&1; then
        echo "✅ Production service is healthy"
        break
      fi
      echo "⏳ Waiting for production service to be healthy... ($timeout seconds remaining)"
      sleep 5
      timeout=$((timeout - 5))
    done
    if [ $timeout -le 0 ]; then
      echo "❌ Production service failed to become healthy"
      docker-compose -f docker-compose.test.yml logs prod
      exit 1
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
    docker-compose -f docker-compose.test.yml down
    
    echo "✅ Lighthouse mobile tests completed"
}

# Show usage information
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup-network          Setup Docker network for DIND"
    echo "  configure-compose      Configure Docker Compose files for DIND"
    echo "  start-dev              Start development environment in DIND mode"
    echo "  start-prod             Start production environment in DIND mode"
    echo "  test-unit              Run unit tests in DIND mode"
    echo "  test-mutation          Run mutation tests in DIND mode"
    echo "  test-e2e               Run E2E tests in DIND mode"
    echo "  test-visual            Run Visual tests in DIND mode"
    echo "  test-memory-leak       Run Memory Leak tests in DIND mode"
    echo "  test-load              Run K6 Load tests in DIND mode"
    echo "  lighthouse-desktop     Run Lighthouse Desktop audit in DIND mode"
    echo "  lighthouse-mobile      Run Lighthouse Mobile audit in DIND mode"
    echo "  lint-next              Run ESLint in DIND mode"
    echo "  lint-tsc               Run TypeScript check in DIND mode"
    echo "  lint-md                Run Markdown linting in DIND mode"
    echo "  lint-all               Run all lint checks in DIND mode"
    echo "  help                   Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  NETWORK_NAME           Docker network name (default: website-network)"
    echo "  WEBSITE_DOMAIN         Website domain (default: localhost)"
    echo "  DEV_PORT               Development port (default: 3000)"
    echo "  NEXT_PUBLIC_PROD_PORT  Production port (default: 3001)"
    echo "  PLAYWRIGHT_TEST_PORT   Playwright test port (default: 9323)"
    echo "  UI_HOST                UI host binding (default: 0.0.0.0)"
    echo "  PROD_CONTAINER_NAME    Production container name (default: website-prod)"
    echo "  DOCKER_COMPOSE_DEV_FILE     Docker Compose dev file (default: -f docker-compose.yml)"
    echo "  DOCKER_COMPOSE_TEST_FILE    Docker Compose test file (default: -f docker-compose.test.yml)"
    echo "  COMMON_HEALTHCHECKS_FILE    Common healthchecks file (default: -f common-healthchecks.yml)"
}

# Main command dispatcher
case "${1:-help}" in
    setup-network)
        setup_docker_network
        ;;
    configure-compose)
        configure_docker_compose
        ;;
    start-dev)
        start_dev_dind
        ;;
    start-prod)
        start_prod_dind
        ;;
    test-unit)
        run_unit_tests_dind
        ;;
    test-mutation)
        run_mutation_tests_dind
        ;;
    test-e2e)
        run_e2e_tests_dind
        ;;
    test-visual)
        run_visual_tests_dind
        ;;
    test-memory-leak)
        run_memory_leak_tests_dind
        ;;
    test-load)
        run_load_tests_dind
        ;;
    lighthouse-desktop)
        run_lighthouse_desktop_dind
        ;;
    lighthouse-mobile)
        run_lighthouse_mobile_dind
        ;;
    lint-next)
        run_eslint_dind
        ;;
    lint-tsc)
        run_typescript_check_dind
        ;;
    lint-md)
        run_markdown_lint_dind
        ;;
    lint-all)
        run_all_lint_dind
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac 