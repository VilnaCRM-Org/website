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

# Function to run make commands with proper Docker setup
run_make_with_dind() {
    local target=$1
    local description=$2
    local website_dir=$3
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    configure_docker_compose
    
    # Start the development container
    echo "🔧 Starting development container"
    if ! docker compose up -d dev; then
        echo "❌ Failed to start development container"
        exit 1
    fi
    
    # Wait for container to be ready
    wait_for_dev_dind
    
    # Run make command with CI=0 to use Docker container commands (DIND mode)
    export DIND=1
    if cd "$website_dir" && make "$target" CI=0; then
        echo "✅ $description completed successfully"
    else
        echo "❌ $description failed"
        exit 1
    fi
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
        main "." && run_unit_tests_dind "."
        ;;
    test-mutation)
        echo "🧬 Running mutation tests only..."
        main "." && run_mutation_tests_dind "."
        ;;
    test-lint)
        echo "🔍 Running lint tests only..."
        main "." && run_lint_tests_dind "."
        ;;
    *)
        main "$@"
        ;;
esac 