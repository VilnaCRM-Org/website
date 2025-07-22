#!/bin/bash

# Batch script for Playwright (E2E/Visual) and Load tests using Makefile
# This script provides a unified interface for local, GitHub, and AWS CI environments

set -e

# Script configuration
# Shell-agnostic script path detection
SCRIPT_DIR="$(pwd)"
if [ -n "$0" ] && [ "$0" != "bash" ] && [ "$0" != "sh" ]; then
    # Try to get script directory from $0
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MAKEFILE_PATH="$PROJECT_ROOT/Makefile"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if we're in a CI environment
is_ci_environment() {
    [ "$CI" = "1" ] || [ "$GITHUB_ACTIONS" = "true" ] || [ "$CODEBUILD_BUILD_ID" != "" ]
}

# Function to run make command with proper error handling
run_make() {
    local target="$1"
    local description="$2"
    
    print_status "Running: $description"
    print_status "Target: $target"
    print_status "Project root: $PROJECT_ROOT"
    print_status "Makefile path: $MAKEFILE_PATH"
    print_status "Current directory: $(pwd)"
    print_status "CI environment: $CI"
    print_status "CODEBUILD_BUILD_ID: $CODEBUILD_BUILD_ID"
    
    if [ ! -f "$MAKEFILE_PATH" ]; then
        print_error "Makefile not found at: $MAKEFILE_PATH"
        print_error "Current directory contents:"
        ls -la "$PROJECT_ROOT" || true
        exit 1
    fi
    
    if cd "$PROJECT_ROOT" && make "$target"; then
        print_success "$description completed successfully"
    else
        print_error "$description failed"
        print_error "Makefile contents:"
        head -20 "$MAKEFILE_PATH" || true
        exit 1
    fi
}

# DIND Environment Configuration
NETWORK_NAME="website-network"
WEBSITE_DOMAIN="localhost"
DEV_PORT="3000"
NEXT_PUBLIC_PROD_PORT="3001"
PLAYWRIGHT_TEST_PORT="9324"
DOCKER_COMPOSE_DEV_FILE="-f docker-compose.yml"
DOCKER_COMPOSE_TEST_FILE="-f docker-compose.test.yml"
COMMON_HEALTHCHECKS_FILE="-f common-healthchecks.yml"

# Function to safely add container name to a service
add_container_name() {
    local service_name="$1"
    local container_name="$2"
    local compose_file="$3"
    
    if [ -f "$compose_file" ]; then
        # Check if container_name is already set
        if ! grep -q "container_name: $container_name" "$compose_file"; then
            # Add container_name after the service name
            sed -i "/^  $service_name:/a\    container_name: $container_name" "$compose_file"
        fi
    fi
}

# Function to update environment variable references
update_env_references() {
    local compose_file="$1"
    
    if [ -f "$compose_file" ]; then
        # Update environment variable references for DIND mode
        sed -i 's/\${WEBSITE_DOMAIN}/localhost/g' "$compose_file"
        sed -i 's/\${NEXT_PUBLIC_PROD_PORT}/3001/g' "$compose_file"
        sed -i 's/\${DEV_PORT}/3000/g' "$compose_file"
    fi
}

# Function to configure Docker Compose files for DIND
configure_docker_compose() {
    print_status "🔧 Configuring Docker Compose files for DIND mode"
    
    # Configure test compose file
    if [ -f "docker-compose.test.yml" ]; then
        add_container_name "prod" "website-prod" "docker-compose.test.yml"
        add_container_name "playwright" "website-playwright" "docker-compose.test.yml"
        add_container_name "apollo" "website-apollo" "docker-compose.test.yml"
        add_container_name "mockoon" "website-mockoon" "docker-compose.test.yml"
        update_env_references "docker-compose.test.yml"
    fi
    
    # Configure dev compose file
    if [ -f "docker-compose.yml" ]; then
        add_container_name "dev" "website-dev" "docker-compose.yml"
        update_env_references "docker-compose.yml"
    fi
    
    print_success "✅ Docker Compose files configured for DIND mode"
}

# Function to setup Docker network for DIND
setup_docker_network() {
    print_status "🔧 Setting up Docker network for DIND"
    
    if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
        if ! docker network create "$NETWORK_NAME"; then
            print_error "❌ Failed to create network $NETWORK_NAME"
            exit 1
        fi
        print_success "✅ Network $NETWORK_NAME created successfully"
    else
        print_status "✅ Network $NETWORK_NAME already exists"
    fi
}

# Function to wait for dev service in DIND mode
wait_for_dev_dind() {
    print_status "⏳ Waiting for dev service to be ready in DIND mode"
    
    for i in $(seq 1 30); do
        if docker exec "website-dev" sh -c "curl -f http://localhost:$DEV_PORT >/dev/null 2>&1"; then
            print_success "✅ Dev service is ready on port $DEV_PORT"
            return 0
        fi
        print_status "Waiting for dev service... attempt $i/30"
        sleep 2
    done
    
    print_error "❌ Dev service failed to start within 60 seconds"
    docker logs "website-dev" --tail 20
    exit 1
}

# Function to wait for production service in DIND mode
wait_for_prod_dind() {
    print_status "⏳ Waiting for production service to be ready in DIND mode"
    
    for i in $(seq 1 30); do
        if docker exec "website-prod" sh -c "curl -f http://localhost:$NEXT_PUBLIC_PROD_PORT >/dev/null 2>&1"; then
            print_success "✅ Production service is ready on port $NEXT_PUBLIC_PROD_PORT"
            return 0
        fi
        print_status "Waiting for production service... attempt $i/30"
        sleep 2
    done
    
    print_error "❌ Production service failed to start within 60 seconds"
    docker logs "website-prod" --tail 20
    exit 1
}

# Function to start development environment in DIND mode
start_dev_dind() {
    print_status "🚀 Starting development environment in DIND mode"
    
    setup_docker_network
    configure_docker_compose
    
    print_status "Building development container..."
    docker-compose $DOCKER_COMPOSE_DEV_FILE build dev
    
    print_status "Starting development container..."
    docker-compose $DOCKER_COMPOSE_DEV_FILE up -d dev
    
    wait_for_dev_dind
    print_success "✅ Development environment started successfully"
}

# Function to start production environment in DIND mode
start_prod_dind() {
    print_status "🚀 Starting production environment in DIND mode"
    
    setup_docker_network
    configure_docker_compose
    
    print_status "Building production container..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build prod
    
    print_status "Starting production container..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE up -d prod
    
    wait_for_prod_dind
    print_success "✅ Production environment started successfully"
}

# Function to run E2E tests in DIND mode
run_e2e_tests_dind() {
    print_status "🎭 Running E2E tests in DIND mode"
    
    setup_docker_network
    configure_docker_compose
    
    print_status "Building test services..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build
    
    print_status "Starting test services..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE up -d
    wait_for_prod_dind
    
    print_status "📂 Copying E2E test files to Playwright container..."
    
    # Wait for container to be ready
    for i in $(seq 1 30); do
        if docker exec website-playwright echo "Container ready" >/dev/null 2>&1; then
            print_status "✅ Container website-playwright is ready"
            break
        fi
        print_status "Waiting for container to be ready... attempt $i"
        sleep 2
        if [ "$i" -eq 30 ]; then
            print_error "❌ Container not ready after 60 seconds"
            exit 1
        fi
    done
    
    # Copy test files
    if docker cp ./src/test/e2e website-playwright:/app/src/test/; then
        print_status "✅ E2E test files copied successfully"
    else
        print_error "❌ Failed to copy E2E test files"
        exit 1
    fi
    
    print_status "🧪 Running E2E tests..."
    if docker exec website-playwright sh -c "cd /app && npx playwright test src/test/e2e --reporter=html"; then
        print_success "✅ E2E tests PASSED"
    else
        print_error "❌ E2E tests FAILED"
        docker logs website-playwright --tail 30
        exit 1
    fi
    
    print_success "🎉 E2E tests completed successfully in DIND mode!"
}

# Function to run visual tests in DIND mode
run_visual_tests_dind() {
    print_status "🎨 Running visual tests in DIND mode"
    
    setup_docker_network
    configure_docker_compose
    
    print_status "Building test services..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build
    
    print_status "Starting test services..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE up -d
    wait_for_prod_dind
    
    print_status "📂 Copying visual test files to Playwright container..."
    
    # Wait for container to be ready
    for i in $(seq 1 30); do
        if docker exec website-playwright echo "Container ready" >/dev/null 2>&1; then
            print_status "✅ Container website-playwright is ready"
            break
        fi
        print_status "Waiting for container to be ready... attempt $i"
        sleep 2
        if [ "$i" -eq 30 ]; then
            print_error "❌ Container not ready after 60 seconds"
            exit 1
        fi
    done
    
    # Copy test files
    if docker cp ./src/test/visual website-playwright:/app/src/test/; then
        print_status "✅ Visual test files copied successfully"
    else
        print_error "❌ Failed to copy visual test files"
        exit 1
    fi
    
    print_status "🧪 Running visual tests..."
    if docker exec website-playwright sh -c "cd /app && npx playwright test src/test/visual --reporter=html"; then
        print_success "✅ Visual tests PASSED"
    else
        print_error "❌ Visual tests FAILED"
        docker logs website-playwright --tail 30
        exit 1
    fi
    
    print_success "🎉 Visual tests completed successfully in DIND mode!"
}

# Function to run load tests in DIND mode
run_load_tests_dind() {
    print_status "⚡ Running load tests in DIND mode"
    
    setup_docker_network
    configure_docker_compose
    
    print_status "Building test services..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE build
    
    print_status "Starting production service..."
    docker-compose $COMMON_HEALTHCHECKS_FILE $DOCKER_COMPOSE_TEST_FILE up -d prod
    wait_for_prod_dind
    
    print_status "📂 Copying load test files to K6 container..."
    
    # Start K6 container
    docker-compose $DOCKER_COMPOSE_TEST_FILE --profile load up -d k6
    
    # Wait for K6 container to be ready
    for i in $(seq 1 30); do
        if docker exec website-k6 echo "Container ready" >/dev/null 2>&1; then
            print_status "✅ Container website-k6 is ready"
            break
        fi
        print_status "Waiting for K6 container to be ready... attempt $i"
        sleep 2
        if [ "$i" -eq 30 ]; then
            print_error "❌ K6 container not ready after 60 seconds"
            exit 1
        fi
    done
    
    # Copy test files
    if docker cp ./src/test/load website-k6:/loadTests/; then
        print_status "✅ Load test files copied successfully"
    else
        print_error "❌ Failed to copy load test files"
        exit 1
    fi
    
    print_status "🧪 Running load tests..."
    if docker exec website-k6 sh -c "cd /loadTests && k6 run --summary-trend-stats='avg,min,med,max,p(95),p(99)' --out 'web-dashboard=period=1s&export=results/homepage.html' homepage.js"; then
        print_success "✅ Load tests PASSED"
    else
        print_error "❌ Load tests FAILED"
        docker logs website-k6 --tail 30
        exit 1
    fi
    
    print_success "🎉 Load tests completed successfully in DIND mode!"
}

# Function to run E2E tests (wrapper for DIND mode)
run_e2e_tests() {
    if [ "$DIND" = "1" ] || [ "$CI" = "1" ]; then
        run_e2e_tests_dind
    else
        print_status "🐳 Running E2E tests in local mode"
        run_make "test-e2e" "E2E tests"
        print_success "🎉 E2E tests completed successfully!"
    fi
}

# Function to run visual tests (wrapper for DIND mode)
run_visual_tests() {
    if [ "$DIND" = "1" ] || [ "$CI" = "1" ]; then
        run_visual_tests_dind
    else
        print_status "🐳 Running visual tests in local mode"
        run_make "test-visual" "Visual tests"
        print_success "🎉 Visual tests completed successfully!"
    fi
}

# Function to run load tests (wrapper for DIND mode)
run_load_tests() {
    if [ "$DIND" = "1" ] || [ "$CI" = "1" ]; then
        run_load_tests_dind
    else
        print_status "🐳 Running load tests in local mode"
        run_make "load-tests" "Load tests"
        print_success "🎉 Load tests completed successfully!"
    fi
}

# Function to run all tests in batch
run_batch_tests() {
    print_status "🚀 Starting batch execution: E2E, Visual, and Load tests"
    
    # Run E2E tests
    run_e2e_tests
    
    # Run visual tests
    run_visual_tests
    
    # Run load tests
    run_load_tests
    
    print_success "🎉 All batch tests completed successfully!"
}

# Function to cleanup resources
cleanup() {
    print_status "🧹 Cleaning up resources..."
    
    # Stop and remove containers
    docker rm -f website-dev website-prod website-playwright website-apollo website-mockoon website-k6 2>/dev/null || true
    
    # Stop docker-compose services
    if cd "$PROJECT_ROOT"; then
        docker-compose down --remove-orphans 2>/dev/null || true
        docker-compose $DOCKER_COMPOSE_TEST_FILE down --remove-orphans 2>/dev/null || true
    fi
    
    # Remove network
    docker network rm "$NETWORK_NAME" 2>/dev/null || true
    
    print_status "✅ Cleanup completed"
}

# Set up cleanup trap
trap cleanup EXIT

# Function to show help
show_help() {
    echo "Batch Playwright and Load Tests Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  test-e2e               Run E2E tests"
    echo "  test-visual            Run visual tests"
    echo "  test-load              Run load tests"
    echo "  test-all               Run all tests in batch"
    echo "  setup-network          Setup Docker network for DIND"
    echo "  configure-compose      Configure Docker Compose files for DIND"
    echo "  cleanup                Clean up Docker resources"
    echo "  help                   Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  CI                     Set to 1 for CI environment"
    echo "  GITHUB_ACTIONS         Set to true for GitHub Actions"
    echo "  CODEBUILD_BUILD_ID     Set for AWS CodeBuild"
    echo ""
    echo "Examples:"
    echo "  $0 test-e2e            # Run only E2E tests"
    echo "  $0 test-all            # Run all tests"
    echo "  $0 cleanup             # Clean up resources"
}

# Main command dispatcher
# Simple argument handling that works in all shells
if [ $# -gt 0 ]; then
    # We have arguments, execute the command
    COMMAND="$1"
else
    # No arguments, show help
    COMMAND="help"
fi

case "$COMMAND" in
    test-e2e)
        run_e2e_tests
        ;;
    test-visual)
        run_visual_tests
        ;;
    test-load)
        run_load_tests
        ;;
    test-all)
        run_batch_tests
        ;;
    setup-network)
        run_make "create-network" "Docker network setup"
        ;;
    configure-compose)
        print_status "Docker Compose configuration is handled automatically by the existing Makefile"
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        echo ""
        show_help
        exit 1
        ;;
esac 