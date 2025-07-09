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
    docker network create $NETWORK_NAME 2>/dev/null || echo "Network $NETWORK_NAME already exists"
    echo "✅ Docker network configured"
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
        if [ $i -eq 30 ]; then
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
            docker exec website-dev netstat -tulpn 2>/dev/null | grep :$DEV_PORT || echo "Port $DEV_PORT not bound"
        fi
        sleep 3
        if [ $i -eq 60 ]; then
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
    docker-compose $DOCKER_COMPOSE_DEV_FILE up -d dev
    wait_for_dev_dind
    echo "🎉 Development environment started successfully!"
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
        if [ $i -eq 30 ]; then
            echo "❌ Container failed to start within 60 seconds"
            docker ps -a --filter "name=$PROD_CONTAINER_NAME"
            exit 1
        fi
    done
    
    echo "🔍 Testing $PROD_CONTAINER_NAME service connectivity on port $NEXT_PUBLIC_PROD_PORT..."
    for i in $(seq 1 60); do
        if docker exec $PROD_CONTAINER_NAME sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
            echo "✅ Service is responding on port $NEXT_PUBLIC_PROD_PORT!"
            break
        fi
        echo "Attempt $i: Service not ready, checking container status..."
        if [ $((i % 10)) -eq 0 ]; then
            echo "Debug info at attempt $i:"
            docker exec $PROD_CONTAINER_NAME ps aux 2>/dev/null || echo "Cannot access container processes"
            docker exec $PROD_CONTAINER_NAME netstat -tulpn 2>/dev/null | grep :$NEXT_PUBLIC_PROD_PORT || echo "Port $NEXT_PUBLIC_PROD_PORT not bound"
        fi
        sleep 3
        if [ $i -eq 60 ]; then
            echo "❌ Service failed to respond within 180 seconds"
            echo "Final container logs:"
            docker logs $PROD_CONTAINER_NAME --tail 50
            exit 1
        fi
    done
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

# Run unit tests in DIND mode
run_unit_tests_dind() {
    echo "🐳 Running unit tests in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building container image..."
    docker-compose $DOCKER_COMPOSE_DEV_FILE build dev
    echo "🧹 Cleaning up any existing temporary containers..."
    docker rm -f website-dev-temp 2>/dev/null || true
    echo "🛠️ Starting container in background for file operations..."
    docker run -d --name website-dev-temp --network $NETWORK_NAME website-dev tail -f /dev/null
    
    echo "📂 Copying source files into container..."
    if docker cp . website-dev-temp:/app/; then
        echo "✅ Source files copied successfully"
    else
        echo "❌ Failed to copy source files"
        docker rm -f website-dev-temp
        exit 1
    fi
    
    echo "📦 Installing dependencies inside container..."
    if docker exec website-dev-temp sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        docker logs website-dev-temp --tail 20
        docker rm -f website-dev-temp
        exit 1
    fi
    
    echo "🧪 Running client-side tests..."
    if docker exec website-dev-temp sh -c "cd /app && env TEST_ENV=client ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2"; then
        echo "✅ Client-side tests PASSED"
    else
        echo "❌ Client-side tests FAILED"
        docker logs website-dev-temp --tail 30
        docker rm -f website-dev-temp
        exit 1
    fi
    
    echo "🧪 Running server-side tests..."
    if docker exec website-dev-temp sh -c "cd /app && env TEST_ENV=server ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2"; then
        echo "✅ Server-side tests PASSED"
    else
        echo "❌ Server-side tests FAILED"
        docker logs website-dev-temp --tail 30
        docker rm -f website-dev-temp
        exit 1
    fi
    
    echo "🧹 Cleaning up temporary container..."
    docker rm -f website-dev-temp
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
    docker-compose $DOCKER_COMPOSE_DEV_FILE build dev
    echo "🧹 Cleaning up any existing containers..."
    docker rm -f website-dev-mutation 2>/dev/null || true
    echo "🛠️ Starting container in background for file operations..."
    docker run -d --name website-dev-mutation --network $NETWORK_NAME website-dev tail -f /dev/null
    
    echo "📂 Copying source files into container..."
    if docker cp . website-dev-mutation:/app/; then
        echo "✅ Source files copied successfully"
    else
        echo "❌ Failed to copy source files"
        docker rm -f website-dev-mutation
        exit 1
    fi
    
    echo "📦 Installing dependencies inside container..."
    if docker exec website-dev-mutation sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        docker logs website-dev-mutation --tail 20
        docker rm -f website-dev-mutation
        exit 1
    fi
    
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
        if [ $i -eq 60 ]; then
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
    docker-compose $DOCKER_COMPOSE_DEV_FILE build dev
    echo "🧹 Cleaning up any existing containers..."
    docker rm -f website-dev-lint-next 2>/dev/null || true
    echo "🛠️ Starting container for linting..."
    docker run -d --name website-dev-lint-next --network $NETWORK_NAME website-dev tail -f /dev/null
    
    echo "📂 Copying source files into container..."
    if docker cp . website-dev-lint-next:/app/; then
        echo "✅ Source files copied successfully"
    else
        echo "❌ Failed to copy source files"
        docker rm -f website-dev-lint-next
        exit 1
    fi
    
    echo "📦 Installing dependencies inside container..."
    if docker exec website-dev-lint-next sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        docker logs website-dev-lint-next --tail 20
        docker rm -f website-dev-lint-next
        exit 1
    fi
    
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
    docker-compose $DOCKER_COMPOSE_DEV_FILE build dev
    echo "🧹 Cleaning up any existing containers..."
    docker rm -f website-dev-lint-tsc 2>/dev/null || true
    echo "🛠️ Starting container for TypeScript linting..."
    docker run -d --name website-dev-lint-tsc --network $NETWORK_NAME website-dev tail -f /dev/null
    
    echo "📂 Copying source files into container..."
    if docker cp . website-dev-lint-tsc:/app/; then
        echo "✅ Source files copied successfully"
    else
        echo "❌ Failed to copy source files"
        docker rm -f website-dev-lint-tsc
        exit 1
    fi
    
    echo "📦 Installing dependencies inside container..."
    if docker exec website-dev-lint-tsc sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        docker logs website-dev-lint-tsc --tail 20
        docker rm -f website-dev-lint-tsc
        exit 1
    fi
    
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
    docker-compose $DOCKER_COMPOSE_DEV_FILE build dev
    echo "🧹 Cleaning up any existing containers..."
    docker rm -f website-dev-lint-md 2>/dev/null || true
    echo "🛠️ Starting container for Markdown linting..."
    docker run -d --name website-dev-lint-md --network $NETWORK_NAME website-dev tail -f /dev/null
    
    echo "📂 Copying source files into container..."
    if docker cp . website-dev-lint-md:/app/; then
        echo "✅ Source files copied successfully"
    else
        echo "❌ Failed to copy source files"
        docker rm -f website-dev-lint-md
        exit 1
    fi
    
    echo "📦 Installing dependencies inside container..."
    if docker exec website-dev-lint-md sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        docker logs website-dev-lint-md --tail 20
        docker rm -f website-dev-lint-md
        exit 1
    fi
    
    echo "🔍 Running Markdown linting..."
    if docker exec website-dev-lint-md sh -c "cd /app && npx markdownlint-cli2 '**/*.md' '#node_modules' '#.next'"; then
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
    run_eslint_dind
    run_typescript_check_dind
    run_markdown_lint_dind
    echo "🎉 All lint checks completed successfully!"
}

# Run E2E tests in DIND mode
run_e2e_tests_dind() {
    echo "🎭 Running E2E tests in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    
    echo "🧹 Cleaning up any existing containers..."
    docker rm -f website-prod website-playwright-temp 2>/dev/null || true
    
    echo "🏗️ Building production environment for E2E testing..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build
    echo "🚀 Starting production services..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE up -d
    wait_for_prod_dind
    
    echo "🧪 Building Playwright test container..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build playwright
    
    echo "🛠️ Starting Playwright test container..."
    docker run -d --name website-playwright-temp --network website-network \
        --env NEXT_PUBLIC_PROD_HOST_API_URL=http://website-prod:3001 \
        --env NEXT_PUBLIC_MAIN_LANGUAGE=uk \
        --env NEXT_PUBLIC_FALLBACK_LANGUAGE=en \
        website-playwright tail -f /dev/null
    
    echo "📂 Creating directory structure in Playwright container..."
    docker exec website-playwright-temp mkdir -p /app/src/test/e2e /app/src/test/e2e/utils /app/src/config /app/pages/i18n
    
    echo "📂 Copying source files into Playwright container..."
    if docker cp package.json website-playwright-temp:/app/ && \
       docker cp src/test/e2e/. website-playwright-temp:/app/src/test/e2e/ && \
       docker cp playwright.config.ts website-playwright-temp:/app/ 2>/dev/null; then
        echo "✅ E2E test files copied successfully"
    else
        echo "❌ Failed to copy E2E test files"
        docker rm -f website-playwright-temp
        exit 1
    fi
    
    echo "📂 Copying E2E utility files..."
    if docker cp src/test/e2e/utils/. website-playwright-temp:/app/src/test/e2e/utils/; then
        echo "✅ E2E utility files copied successfully"
    else
        echo "❌ Failed to copy E2E utility files"
        docker rm -f website-playwright-temp
        exit 1
    fi
    
    echo "📂 Copying required config files..."
    docker cp src/config/i18nConfig.js website-playwright-temp:/app/src/config/ 2>/dev/null || echo "Config file not found"
    docker cp pages/i18n/localization.json website-playwright-temp:/app/pages/i18n/ 2>/dev/null || echo "Localization file not found"
    
    echo "🎭 Running Playwright E2E tests..."
    if docker exec website-playwright-temp sh -c "cd /app && npx playwright test"; then
        echo "✅ E2E tests PASSED"
    else
        echo "❌ E2E tests FAILED"
        docker logs website-playwright-temp --tail 30
        docker rm -f website-playwright-temp
        exit 1
    fi
    
    echo "📂 Copying E2E test results..."
    mkdir -p playwright-results
    docker cp website-playwright-temp:/app/test-results/. playwright-results/ 2>/dev/null || echo "No E2E test results to copy"
    docker cp website-playwright-temp:/app/playwright-report/. playwright-report/ 2>/dev/null || echo "No Playwright report to copy"
    
    echo "🧹 Cleaning up Playwright test container..."
    docker rm -f website-playwright-temp
    
    echo "🎉 E2E tests completed successfully in true DinD mode!"
}

# Run Visual tests in DIND mode
run_visual_tests_dind() {
    echo "🎨 Running Visual tests in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    
    echo "🧹 Cleaning up any existing containers..."
    docker rm -f website-prod website-playwright-temp 2>/dev/null || true
    
    echo "🏗️ Building production environment for Visual testing..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build
    echo "🚀 Starting production services..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE up -d
    wait_for_prod_dind
    
    echo "🧪 Building Playwright test container..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build playwright
    
    echo "🛠️ Starting Playwright test container..."
    docker run -d --name website-playwright-temp --network website-network \
        --env NEXT_PUBLIC_PROD_HOST_API_URL=http://website-prod:3001 \
        --env NEXT_PUBLIC_MAIN_LANGUAGE=uk \
        --env NEXT_PUBLIC_FALLBACK_LANGUAGE=en \
        website-playwright tail -f /dev/null
    
    echo "📂 Creating directory structure in Playwright container..."
    docker exec website-playwright-temp mkdir -p /app/src/test/visual /app/src/test/e2e/utils /app/src/config /app/pages/i18n
    
    echo "📂 Copying source files into Playwright container..."
    if docker cp package.json website-playwright-temp:/app/ && \
       docker cp src/test/visual/. website-playwright-temp:/app/src/test/visual/ && \
       docker cp playwright.config.ts website-playwright-temp:/app/ 2>/dev/null; then
        echo "✅ Visual test files copied successfully"
    else
        echo "❌ Failed to copy Visual test files"
        docker rm -f website-playwright-temp
        exit 1
    fi
    
    echo "📂 Copying E2E utility files for Visual tests..."
    if docker cp src/test/e2e/utils/. website-playwright-temp:/app/src/test/e2e/utils/; then
        echo "✅ E2E utility files copied successfully for Visual tests"
    else
        echo "❌ Failed to copy E2E utility files for Visual tests"
        docker rm -f website-playwright-temp
        exit 1
    fi
    
    echo "📂 Copying required config files..."
    docker cp src/config/i18nConfig.js website-playwright-temp:/app/src/config/ 2>/dev/null || echo "Config file not found"
    docker cp pages/i18n/localization.json website-playwright-temp:/app/pages/i18n/ 2>/dev/null || echo "Localization file not found"
    
    echo "🎨 Running Playwright Visual tests..."
    if docker exec website-playwright-temp sh -c "cd /app && npx playwright test --config=playwright.config.ts"; then
        echo "✅ Visual tests PASSED"
    else
        echo "❌ Visual tests FAILED"
        docker logs website-playwright-temp --tail 30
        docker rm -f website-playwright-temp
        exit 1
    fi
    
    echo "📂 Copying Visual test results..."
    mkdir -p playwright-results
    docker cp website-playwright-temp:/app/test-results/. playwright-results/ 2>/dev/null || echo "No Visual test results to copy"
    docker cp website-playwright-temp:/app/playwright-report/. playwright-report/ 2>/dev/null || echo "No Playwright report to copy"
    
    echo "🧹 Cleaning up Playwright test container..."
    docker rm -f website-playwright-temp
    
    echo "🎉 Visual tests completed successfully in true DinD mode!"
}

# Run Memory Leak tests in DIND mode
run_memory_leak_tests_dind() {
    echo "🔍 Running Memory Leak tests in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    
    echo "🧹 Cleaning up any existing containers..."
    docker rm -f website-prod website-memory-leak-temp 2>/dev/null || true
    
    echo "🏗️ Building production environment for memory leak testing..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build
    echo "🚀 Starting production services in background..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE up -d
    
    echo "⏳ Waiting for production services to be ready..."
    wait_for_prod_dind
    
    echo "🧪 Building memory leak test container..."
    docker-compose -f docker-compose.memory-leak.yml build memory-leak
    
    echo "🛠️ Starting memory leak test container..."
    docker run -d --name website-memory-leak-temp --network website-network \
        --env NEXT_PUBLIC_PROD_CONTAINER_API_URL=http://website-prod:3001 \
        --env MEMLAB_DEBUG=true \
        --env MEMLAB_SKIP_WARMUP=true \
        --env DISPLAY=:99 \
        --env NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name \
        --env NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value \
        --shm-size=1gb \
        website-memory-leak tail -f /dev/null
    
    echo "📂 Copying source files into memory leak container..."
    if docker cp src/test/memory-leak/. website-memory-leak-temp:/app/src/test/memory-leak/; then
        echo "✅ Memory leak test files copied successfully"
    else
        echo "❌ Failed to copy memory leak test files"
        docker rm -f website-memory-leak-temp
        exit 1
    fi
    
    echo "📂 Copying required config files..."
    docker cp src/config/i18nConfig.js website-memory-leak-temp:/app/src/config/ 2>/dev/null || echo "Config file not found"
    docker cp pages/i18n/localization.json website-memory-leak-temp:/app/pages/i18n/ 2>/dev/null || echo "Localization file not found"
    
    echo "🧹 Cleaning up previous memory leak results..."
    docker exec website-memory-leak-temp sh -c "rm -rf /app/src/test/memory-leak/results"
    
    echo "🧠 Running Memlab memory leak tests..."
    if docker exec website-memory-leak-temp sh -c "cd /app && node src/test/memory-leak/runMemlabTests.js"; then
        echo "✅ Memory leak tests PASSED"
    else
        echo "❌ Memory leak tests FAILED"
        docker logs website-memory-leak-temp --tail 30
        docker rm -f website-memory-leak-temp
        exit 1
    fi
    
    echo "📂 Copying memory leak test results..."
    mkdir -p memory-leak-results
    docker cp website-memory-leak-temp:/app/src/test/memory-leak/results/. memory-leak-results/ 2>/dev/null || echo "No memory leak results to copy"
    
    echo "🧹 Cleaning up memory leak test container..."
    docker rm -f website-memory-leak-temp
    
    echo "🎉 Memory leak tests completed successfully in true DinD mode!"
}

# Run Lighthouse Desktop tests in DIND mode
run_lighthouse_desktop_dind() {
    echo "🔦 Running Lighthouse Desktop tests in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building production container image..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build
    echo "🚀 Starting production services..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE up -d
    wait_for_prod_dind
    
    echo "📦 Installing Chrome and Lighthouse CLI in container..."
    if docker exec website-prod sh -c "apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0"; then
        echo "✅ Chrome and Lighthouse CLI installed successfully"
    else
        echo "❌ Failed to install Chrome and Lighthouse CLI"
        exit 1
    fi

    echo "📂 Copying Lighthouse config files..."
    if docker cp lighthouserc.desktop.js website-prod:/app/; then
        echo "✅ Lighthouse config files copied successfully"
    else
        echo "❌ Failed to copy Lighthouse config files"
        exit 1
    fi

    echo "🧪 Testing Chrome installation..."
    if docker exec website-prod /usr/bin/chromium-browser --version; then
        echo "✅ Chrome is installed and working"
    else
        echo "❌ Chrome installation test failed"
        exit 1
    fi

    echo "🔦 Running Lighthouse Desktop audit..."
    if docker exec -w /app website-prod lhci autorun --config=lighthouserc.desktop.js --collect.url=http://localhost:3001 --collect.chromePath=/usr/bin/chromium-browser --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-features=VizDisplayCompositor --disable-background-networking --disable-default-apps --disable-sync --disable-translate --hide-scrollbars --metrics-recording-only --mute-audio --no-first-run --safebrowsing-disable-auto-update --disable-ipc-flooding-protection"; then
        echo "✅ Lighthouse Desktop tests PASSED"
    else
        echo "❌ Lighthouse Desktop tests FAILED"
        docker logs website-prod --tail 30
        exit 1
    fi

    echo "📂 Copying lighthouse results..."
    mkdir -p lhci-reports-desktop
    docker cp website-prod:/app/lhci-reports-desktop/. lhci-reports-desktop/ 2>/dev/null || echo "No lighthouse desktop results to copy"
    echo "🎉 Lighthouse Desktop tests completed successfully in true DinD mode!"
}

# Run Lighthouse Mobile tests in DIND mode
run_lighthouse_mobile_dind() {
    echo "📱 Running Lighthouse Mobile tests in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building production container image..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build
    echo "🚀 Starting production services..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE up -d
    wait_for_prod_dind
    
    echo "📦 Installing Chrome and Lighthouse CLI in container..."
    if docker exec website-prod sh -c "apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0"; then
        echo "✅ Chrome and Lighthouse CLI installed successfully"
    else
        echo "❌ Failed to install Chrome and Lighthouse CLI"
        exit 1
    fi

    echo "📂 Copying Lighthouse config files..."
    if docker cp lighthouserc.mobile.js website-prod:/app/; then
        echo "✅ Lighthouse config files copied successfully"
    else
        echo "❌ Failed to copy Lighthouse config files"
        exit 1
    fi

    echo "🧪 Testing Chrome installation..."
    if docker exec website-prod /usr/bin/chromium-browser --version; then
        echo "✅ Chrome is installed and working"
    else
        echo "❌ Chrome installation test failed"
        exit 1
    fi

    echo "📱 Running Lighthouse Mobile audit..."
    if docker exec -w /app website-prod lhci autorun --config=lighthouserc.mobile.js --collect.url=http://localhost:3001 --collect.chromePath=/usr/bin/chromium-browser --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-features=VizDisplayCompositor --disable-background-networking --disable-default-apps --disable-sync --disable-translate --hide-scrollbars --metrics-recording-only --mute-audio --no-first-run --safebrowsing-disable-auto-update --disable-ipc-flooding-protection"; then
        echo "✅ Lighthouse Mobile tests PASSED"
    else
        echo "❌ Lighthouse Mobile tests FAILED"
        docker logs website-prod --tail 30
        exit 1
    fi

    echo "📂 Copying lighthouse results..."
    mkdir -p lhci-reports-mobile
    docker cp website-prod:/app/lhci-reports-mobile/. lhci-reports-mobile/ 2>/dev/null || echo "No lighthouse mobile results to copy"
    echo "🎉 Lighthouse Mobile tests completed successfully in true DinD mode!"
}

# Run Load tests in DIND mode
run_load_tests_dind() {
    echo "⚡ Running Load tests in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building production container image..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build
    echo "🚀 Starting production services..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE up -d
    wait_for_prod_dind
    echo "⚡ Running K6 load tests..."
    if docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE --profile load run --rm k6 k6 run --summary-trend-stats='avg,min,med,max,p(95),p(99)' --out 'web-dashboard=period=1s&export=/loadTests/results/homepage.html' homepage.js; then
        echo "✅ Load tests PASSED"
    else
        echo "❌ Load tests FAILED"
        exit 1
    fi
    echo "🎉 Load tests completed successfully in true DinD mode!"
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
    echo "  test-load              Run Load tests in DIND mode"
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
    echo "  PROD_CONTAINER_NAME    Production container name (default: website-prod)"
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