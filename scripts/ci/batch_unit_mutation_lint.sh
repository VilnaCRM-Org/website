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
            docker exec website-dev netstat -tulpn 2>/dev/null | grep ":$DEV_PORT" || echo "Port $DEV_PORT not bound"
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

# Function to run make commands with proper Docker setup using temporary containers
run_make_with_dind() {
    local target=$1
    local description=$2
    local website_dir=$3
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    configure_docker_compose
    
    echo "Building container image..."
    docker-compose $DOCKER_COMPOSE_DEV_FILE build dev
    
    # Create unique container name based on target
    local container_name="website-dev-${target//[^a-zA-Z0-9]/}"
    echo "🧹 Cleaning up any existing temporary containers..."
    docker rm -f "$container_name" 2>/dev/null || true
    
    echo "🛠️ Starting container in background for file operations..."
    docker run -d --name "$container_name" --network "$NETWORK_NAME" website-dev tail -f /dev/null
    
    echo "📂 Copying source files into container..."
    if docker cp . "$container_name:/app/"; then
        echo "✅ Source files copied successfully"
    else
        echo "❌ Failed to copy source files"
        docker rm -f "$container_name"
        exit 1
    fi
    
    echo "📦 Installing dependencies inside container..."
    if docker exec "$container_name" sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        docker logs "$container_name" --tail 20
        docker rm -f "$container_name"
        exit 1
    fi
    
    # Run make command with CI=0 to use Docker container commands (DIND mode)
    export DIND=1
    echo "🚀 Running: $description"
    echo "[INFO] Target: $target"
    echo "[INFO] Website directory: $website_dir"
    echo "[INFO] Makefile path: $website_dir/Makefile"
    
    # For unit tests, run Jest commands directly instead of using make start
    if [ "$target" = "test-unit-all" ]; then
        echo "🧪 Running client-side tests..."
        if docker exec "$container_name" sh -c "cd /app && env TEST_ENV=client ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2"; then
            echo "✅ Client-side tests PASSED"
        else
            echo "❌ Client-side tests FAILED"
            docker logs "$container_name" --tail 30
            docker rm -f "$container_name"
            exit 1
        fi
        
        echo "🧪 Running server-side tests..."
        if docker exec "$container_name" sh -c "cd /app && env TEST_ENV=server ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2 ./src/test/apollo-server"; then
            echo "✅ Server-side tests PASSED"
        else
            echo "❌ Server-side tests FAILED"
            docker logs "$container_name" --tail 30
            docker rm -f "$container_name"
            exit 1
        fi
        
        echo "✅ $description completed successfully"
    elif [ "$target" = "test-mutation" ]; then
        # For mutation tests, run Stryker directly
        echo "🧬 Running Stryker mutation tests..."
        if docker exec "$container_name" sh -c "cd /app && pnpm stryker run"; then
            echo "✅ Mutation tests PASSED"
        else
            echo "❌ Mutation tests FAILED"
            docker logs "$container_name" --tail 30
            docker rm -f "$container_name"
            exit 1
        fi
        
        echo "✅ $description completed successfully"
    else
        # For other targets, use make command
        if docker exec "$container_name" sh -c "cd /app && make $target CI=0"; then
            echo "✅ $description completed successfully"
        else
            echo "❌ $description failed"
            docker logs "$container_name" --tail 30
            docker rm -f "$container_name"
            exit 1
        fi
    fi
    
    echo "🧹 Cleaning up temporary container..."
    docker rm -f "$container_name"
}

# Function to run unit tests in DIND mode using Makefile
run_unit_tests_dind() {
    local website_dir=$1
    echo "🧪 Running unit tests in DIND mode using Makefile"
    run_make_with_dind "test-unit-all" "Unit tests (client + server)" "$website_dir"
}

# Function to run mutation tests in DIND mode using Makefile
run_mutation_tests_dind() {
    local website_dir=$1
    echo "🧬 Running mutation tests in DIND mode using Makefile"
    run_make_with_dind "test-mutation" "Mutation tests" "$website_dir"
}

# Function to run linting tests in DIND mode using Makefile
run_lint_tests_dind() {
    local website_dir=$1
    echo "🔍 Running linting tests in DIND mode using Makefile"
    run_make_with_dind "lint" "All linting tests (ESLint, TypeScript, Markdown)" "$website_dir"
}

# Function to run individual lint tests in DIND mode using Makefile
run_eslint_dind() {
    local website_dir=$1
    echo "🔍 Running ESLint in DIND mode using Makefile"
    run_make_with_dind "lint-next" "ESLint check" "$website_dir"
}

run_typescript_check_dind() {
    local website_dir=$1
    echo "🔍 Running TypeScript check in DIND mode using Makefile"
    run_make_with_dind "lint-tsc" "TypeScript check" "$website_dir"
}

run_markdown_lint_dind() {
    local website_dir=$1
    echo "🔍 Running Markdown linting in DIND mode using Makefile"
    run_make_with_dind "lint-md" "Markdown linting" "$website_dir"
}

# Function to run all lint checks in DIND mode with individual error handling
run_all_lint_dind() {
    local website_dir=$1
    echo "🧹 Running all lint checks in DIND mode..."
    # Create lint-logs directory for buildspec artifacts
    mkdir -p lint-logs
    
    echo "🔍 Running ESLint with log capture..."
    if run_eslint_dind "$website_dir" > lint-logs/eslint.log 2>&1; then
        echo "✅ ESLint PASSED" | tee -a lint-logs/summary.log
    else
        echo "❌ ESLint FAILED" | tee -a lint-logs/summary.log
        echo "ESLint failed, but continuing with other checks..."
    fi
    
    echo "🔍 Running TypeScript check with log capture..."
    if run_typescript_check_dind "$website_dir" > lint-logs/typescript.log 2>&1; then
        echo "✅ TypeScript check PASSED" | tee -a lint-logs/summary.log
    else
        echo "❌ TypeScript check FAILED" | tee -a lint-logs/summary.log
        echo "TypeScript check failed, but continuing with other checks..."
    fi
    
    echo "🔍 Running Markdown linting with log capture..."
    if run_markdown_lint_dind "$website_dir" > lint-logs/markdown.log 2>&1; then
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
    
    # Run unit tests
    if run_unit_tests_dind "$website_dir"; then
        echo "✅ All unit tests completed successfully in DIND mode!"
    else
        echo "❌ Unit tests failed in DIND mode"
        exit 1
    fi
    
    # Run mutation tests
    if run_mutation_tests_dind "$website_dir"; then
        echo "✅ Mutation tests completed successfully in DIND mode!"
    else
        echo "❌ Mutation tests failed in DIND mode"
        exit 1
    fi
    
    # Run linting tests
    if run_lint_tests_dind "$website_dir"; then
        echo "✅ All linting tests completed successfully in DIND mode!"
    else
        echo "❌ Linting tests failed in DIND mode"
        exit 1
    fi
    
    echo "🎉 All tests completed successfully!"
}

# Show usage information
show_usage() {
    echo "Usage: $0 [COMMAND|WEBSITE_DIR]"
    echo ""
    echo "Commands (for backward compatibility):"
    echo "  test-unit              Run unit tests only"
    echo "  test-mutation          Run mutation tests only"
    echo "  test-lint              Run lint tests only"
    echo ""
    echo "Arguments:"
    echo "  WEBSITE_DIR            Website directory path (default: current directory)"
    echo ""
    echo "This script runs unit tests, mutation tests, and linting tests in Docker-in-Docker mode"
    echo "using the Makefile commands with proper Docker container setup."
    echo ""
    echo "Examples:"
    echo "  $0 test-unit           # Run only unit tests (backward compatible)"
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
    test-unit)
        echo "🧪 Running unit tests only..."
        run_unit_tests_dind "."
        ;;
    test-mutation)
        echo "🧬 Running mutation tests only..."
        run_mutation_tests_dind "."
        ;;
    test-lint)
        echo "🔍 Running lint tests only..."
        run_lint_tests_dind "."
        ;;
    *)
        main "$@"
        ;;
esac 