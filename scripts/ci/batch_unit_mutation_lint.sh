#!/bin/bash
# Batch Unit, Mutation, and Lint Tests
# Groups unit, mutation, and lint tests that can run in parallel

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
        if [ "$((i % 10))" -eq 0 ]; then
            echo "Debug info at attempt $i:"
            docker exec website-dev ps aux 2>/dev/null || echo "Cannot access container processes"
            docker exec website-dev netstat -tulpn 2>/dev/null | grep :$DEV_PORT || echo "Port $DEV_PORT not bound"
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
        if docker exec $PROD_CONTAINER_NAME sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
            echo "✅ Service is responding on port $NEXT_PUBLIC_PROD_PORT!"
            break
        fi
        echo "Attempt $i: Service not ready, checking container status..."
        if [ "$((i % 10))" -eq 0 ]; then
            echo "Debug info at attempt $i:"
            docker exec $PROD_CONTAINER_NAME ps aux 2>/dev/null || echo "Cannot access container processes"
            docker exec $PROD_CONTAINER_NAME netstat -tulpn 2>/dev/null | grep :$NEXT_PUBLIC_PROD_PORT || echo "Port $NEXT_PUBLIC_PROD_PORT not bound"
        fi
        sleep 3
        if [ "$i" -eq 60 ]; then
            echo "❌ Service failed to respond within 180 seconds"
            echo "Final container logs:"
            docker logs $PROD_CONTAINER_NAME --tail 50
            exit 1
        fi
    done

    # Run enhanced connectivity testing
    test_container_connectivity
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

# --- BEGIN: Unit and Mutation Test Functions ---
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
        if [ "$((i % 10))" -eq 0 ]; then
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
# --- END: Unit and Mutation Test Functions ---

# --- BEGIN: Lint Functions ---
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
# --- END: Lint Functions ---

# Show usage information
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  run-batch              Run all tests in batch (unit, mutation, lint)"
    echo "  setup-network          Setup Docker network for DIND"
    echo "  configure-compose      Configure Docker Compose files for DIND"
    echo "  start-dev              Start development environment in DIND mode"
    echo "  start-prod             Start production environment in DIND mode"
    echo "  test-unit              Run unit tests in DIND mode"
    echo "  test-mutation          Run mutation tests in DIND mode"
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
    echo "  COMMON_HEALTHCHECKS_FILE    Common healthchecks file (default: -f common-healthchecks.yml if exists, otherwise empty)"
}

# Main command dispatcher
case "${1:-help}" in
    run-batch)
        run_batch_tests
        ;;
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