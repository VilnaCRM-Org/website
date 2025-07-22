#!/bin/bash

# Batch script for Lighthouse and Memory Leak tests using Makefile
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
    
    if [ ! -f "$MAKEFILE_PATH" ]; then
        print_error "Makefile not found at: $MAKEFILE_PATH"
        exit 1
    fi
    
    if cd "$PROJECT_ROOT" && make "$target"; then
        print_success "$description completed successfully"
    else
        print_error "$description failed"
        exit 1
    fi
}

# DIND Environment Configuration
NETWORK_NAME="website-network"
WEBSITE_DOMAIN="localhost"
DEV_PORT="3000"
NEXT_PUBLIC_PROD_PORT="3001"
DOCKER_COMPOSE_DEV_FILE="-f docker-compose.yml"
DOCKER_COMPOSE_TEST_FILE="-f docker-compose.test.yml"
COMMON_HEALTHCHECKS_FILE="-f common-healthchecks.yml"
DOCKER_COMPOSE_MEMLEAK_FILE="-f docker-compose.memory-leak.yml"

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
    
    # Configure memory leak compose file
    if [ -f "docker-compose.memory-leak.yml" ]; then
        add_container_name "memory-leak" "website-memory-leak" "docker-compose.memory-leak.yml"
        update_env_references "docker-compose.memory-leak.yml"
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

# Function to run memory leak tests in DIND mode
run_memory_leak_tests_dind() {
    print_status "🧪 Running memory leak tests in DIND mode"
    
    setup_docker_network
    configure_docker_compose
    
    print_status "Starting production service..."
    start_prod_dind
    
    print_status "Starting memory leak test environment..."
    docker-compose $DOCKER_COMPOSE_MEMLEAK_FILE up -d
    
    print_status "🧹 Cleaning up previous memory leak results..."
    docker-compose $DOCKER_COMPOSE_MEMLEAK_FILE exec -T website-memory-leak rm -rf ./src/test/memory-leak/results
    
    print_status "🚀 Running memory leak tests..."
    if docker-compose $DOCKER_COMPOSE_MEMLEAK_FILE exec -T website-memory-leak node ./src/test/memory-leak/runMemlabTests.js; then
        print_success "✅ Memory leak tests PASSED"
    else
        print_error "❌ Memory leak tests FAILED"
        docker logs website-memory-leak --tail 30
        exit 1
    fi
    
    print_status "🧹 Cleaning up memory leak test containers..."
    docker-compose $DOCKER_COMPOSE_MEMLEAK_FILE down --remove-orphans
    
    print_success "🎉 Memory leak tests completed successfully in DIND mode!"
}

# Function to run Lighthouse desktop tests in DIND mode
run_lighthouse_desktop_tests_dind() {
    print_status "🔦 Running Lighthouse Desktop tests using robust container approach"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose # Added this call

    # Set DIND-specific environment variables
    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"

    echo "🚀 Starting production services with DIND configuration..."
    docker-compose -f docker-compose.test.yml up -d --build prod # Corrected docker-compose syntax
    wait_for_prod_dind

    echo "🧪 Verifying application accessibility from host..."
    if curl -I http://localhost:3001; then
        echo "✅ Application is accessible from host"
    else
        echo "❌ Application is not accessible from host"
        docker logs website-prod --tail 20
        exit 1
    fi

    echo "🔦 Running Lighthouse Desktop audit from build environment..."
    if pnpm lhci autorun --config=lighthouserc.desktop.js; then
        print_success "✅ Lighthouse Desktop tests PASSED"
    else
        print_error "❌ Lighthouse Desktop tests FAILED"
        exit 1
    fi

    print_success "🎉 Lighthouse Desktop tests completed successfully in DIND mode!"
}

# Function to run Lighthouse mobile tests in DIND mode
run_lighthouse_mobile_tests_dind() {
    print_status "🔦 Running Lighthouse Mobile tests using robust container approach"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose # Added this call

    # Set DIND-specific environment variables
    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"

    echo "🚀 Starting production services with DIND configuration..."
    docker-compose -f docker-compose.test.yml up -d --build prod # Corrected docker-compose syntax
    wait_for_prod_dind

    echo "🧪 Verifying application accessibility from host..."
    if curl -I http://localhost:3001; then
        echo "✅ Application is accessible from host"
    else
        echo "❌ Application is not accessible from host"
        docker logs website-prod --tail 20
        exit 1
    fi

    echo "🔦 Running Lighthouse Mobile audit from build environment..."
    if pnpm lhci autorun --config=lighthouserc.mobile.js; then
        print_success "✅ Lighthouse Mobile tests PASSED"
    else
        print_error "❌ Lighthouse Mobile tests FAILED"
        exit 1
    fi

    print_success "🎉 Lighthouse Mobile tests completed successfully in DIND mode!"
}

# Function to run memory leak tests (wrapper for DIND mode)
run_memory_leak_tests() {
    if [ "$DIND" = "1" ] || [ "$CI" = "1" ]; then
        run_memory_leak_tests_dind
    else
        print_status "🐳 Running memory leak tests in local mode"
        run_make "test-memory-leak" "Memory leak tests"
        print_success "🎉 Memory leak tests completed successfully!"
    fi
}

# Function to run Lighthouse desktop tests (wrapper for DIND mode)
run_lighthouse_desktop_tests() {
    if [ "$DIND" = "1" ] || [ "$CI" = "1" ]; then
        run_lighthouse_desktop_tests_dind
    else
        print_status "🐳 Running Lighthouse desktop tests in local mode"
        run_make "lighthouse-desktop" "Lighthouse desktop audit"
        print_success "🎉 Lighthouse desktop tests completed successfully!"
    fi
}

# Function to run Lighthouse mobile tests (wrapper for DIND mode)
run_lighthouse_mobile_tests() {
    if [ "$DIND" = "1" ] || [ "$CI" = "1" ]; then
        run_lighthouse_mobile_tests_dind
    else
        print_status "🐳 Running Lighthouse mobile tests in local mode"
        run_make "lighthouse-mobile" "Lighthouse mobile audit"
        print_success "🎉 Lighthouse mobile tests completed successfully!"
    fi
}

# Function to run all tests in batch
run_batch_tests() {
    print_status "🚀 Starting batch execution: Memory Leak and Lighthouse tests"
    
    # Run memory leak tests
    run_memory_leak_tests
    
    # Run Lighthouse desktop tests
    run_lighthouse_desktop_tests
    
    # Run Lighthouse mobile tests
    run_lighthouse_mobile_tests
    
    print_success "🎉 All batch tests completed successfully!"
}

# Function to cleanup resources
cleanup() {
    print_status "🧹 Cleaning up resources..."
    
    # Stop and remove containers
    docker rm -f website-dev website-prod website-playwright website-apollo website-mockoon website-memory-leak 2>/dev/null || true
    
    # Stop docker-compose services
    if cd "$PROJECT_ROOT"; then
        docker-compose down --remove-orphans 2>/dev/null || true
        docker-compose $DOCKER_COMPOSE_TEST_FILE down --remove-orphans 2>/dev/null || true
        docker-compose $DOCKER_COMPOSE_MEMLEAK_FILE down --remove-orphans 2>/dev/null || true
    fi
    
    # Remove network
    docker network rm "$NETWORK_NAME" 2>/dev/null || true
    
    print_status "✅ Cleanup completed"
}

# Set up cleanup trap
trap cleanup EXIT

# Function to show help
show_help() {
    echo "Batch Lighthouse and Memory Leak Tests Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  test-memory-leak        Run memory leak tests"
    echo "  test-lighthouse-desktop Run Lighthouse desktop audit"
    echo "  test-lighthouse-mobile  Run Lighthouse mobile audit"
    echo "  test-all                Run all tests in batch"
    echo "  setup-network           Setup Docker network for DIND"
    echo "  configure-compose       Configure Docker Compose files for DIND"
    echo "  cleanup                 Clean up Docker resources"
    echo "  help                    Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  CI                      Set to 1 for CI environment"
    echo "  GITHUB_ACTIONS          Set to true for GitHub Actions"
    echo "  CODEBUILD_BUILD_ID      Set for AWS CodeBuild"
    echo ""
    echo "Examples:"
    echo "  $0 test-memory-leak     # Run only memory leak tests"
    echo "  $0 test-all             # Run all tests"
    echo "  $0 cleanup              # Clean up resources"
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
    test-memory-leak)
        run_memory_leak_tests
        ;;
    test-lighthouse-desktop)
        run_lighthouse_desktop_tests
        ;;
    test-lighthouse-mobile)
        run_lighthouse_mobile_tests
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