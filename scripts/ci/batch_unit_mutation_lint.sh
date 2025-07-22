#!/bin/bash

# Batch script for Unit, Mutation, and Lint tests using Makefile
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

# Function to run unit tests in DIND mode
run_unit_tests_dind() {
    print_status "🐳 Running unit tests in DIND mode using Makefile"
    
    # Set up DIND environment
    setup_docker_network
    configure_docker_compose
    
    # Set CI=1 to use local pnpm commands instead of docker exec
    export CI=1
    
    # Use Makefile target for unit tests
    if run_make "test-unit-all" "Unit tests (client + server)"; then
        print_success "✅ All unit tests completed successfully in DIND mode!"
    else
        print_error "❌ Unit tests failed in DIND mode"
        exit 1
    fi
}

# Function to run mutation tests in DIND mode
run_mutation_tests_dind() {
    print_status "🧬 Running mutation tests in DIND mode using Makefile"
    
    # Set up DIND environment
    setup_docker_network
    configure_docker_compose
    
    # Set CI=1 to use local pnpm commands instead of docker exec
    export CI=1
    
    # Use Makefile target for mutation tests
    if run_make "test-mutation" "Mutation tests"; then
        print_success "✅ Mutation tests completed successfully in DIND mode!"
    else
        print_error "❌ Mutation tests failed in DIND mode"
        exit 1
    fi
}


# Function to fix Docker file paths for DIND mode
fix_docker_file_paths() {
    print_status "🔧 Fixing Docker file paths for DIND mode"

    # Create a temporary directory to store the fixed files
    local temp_dir="$(mktemp -d)"

    # Copy the .mjs files from scripts to the root directory
    if [ -f "scripts/fetchSwaggerSchema.mjs" ]; then
        cp "scripts/fetchSwaggerSchema.mjs" "$temp_dir/"
        print_status "✅ Copied fetchSwaggerSchema.mjs to temp directory"
    fi

    if [ -f "scripts/patchSwaggerServer.mjs" ]; then
        cp "scripts/patchSwaggerServer.mjs" "$temp_dir/"
        print_status "✅ Copied patchSwaggerServer.mjs to temp directory"
    fi

    # Copy the files to the container after it's built but before it starts
    if docker ps -q -f name=website-dev | grep -q .; then
        docker cp "$temp_dir/fetchSwaggerSchema.mjs" website-dev:/app/ 2>/dev/null || true
        docker cp "$temp_dir/patchSwaggerServer.mjs" website-dev:/app/ 2>/dev/null || true
        print_status "✅ Copied .mjs files to container"
    fi

    # Clean up temp directory
    rm -rf "$temp_dir"
    print_success "✅ Docker file paths fixed for DIND mode"
}

# Function to run linting tests in DIND mode
run_lint_tests_dind() {
    print_status "🔍 Running linting tests in DIND mode using Makefile"
    
    # Set up DIND environment
    setup_docker_network
    configure_docker_compose
    
    # Set CI=1 to use local pnpm commands instead of docker exec
    export CI=1
    
    # Use Makefile target for linting tests
    if run_make "lint" "All linting tests (ESLint, TypeScript, Markdown)"; then
        print_success "✅ All linting tests completed successfully in DIND mode!"
    else
        print_error "❌ Linting tests failed in DIND mode"
        exit 1
    fi
}

# Function to run unit tests (wrapper for DIND mode)
run_unit_tests() {
    if [ "$DIND" = "1" ] || [ "$CI" = "1" ]; then
        run_unit_tests_dind
    else
        print_status "🐳 Running unit tests in local mode"
        run_make "test-unit-all" "Unit tests (client + server)"
        print_success "🎉 All unit tests completed successfully!"
    fi
}

# Function to run mutation tests (wrapper for DIND mode)
run_mutation_tests() {
    if [ "$DIND" = "1" ] || [ "$CI" = "1" ]; then
        run_mutation_tests_dind
    else
        print_status "🐳 Running mutation tests in local mode"
        run_make "test-mutation" "Mutation tests"
        print_success "🎉 Mutation tests completed successfully!"
    fi
}

# Function to run linting tests (wrapper for DIND mode)
run_lint_tests() {
    if [ "$DIND" = "1" ] || [ "$CI" = "1" ]; then
        run_lint_tests_dind
    else
        print_status "🐳 Running linting tests in local mode"
        run_make "lint" "All linting tests (ESLint, TypeScript, Markdown)"
        print_success "🎉 All linting tests completed successfully!"
    fi
}

# Function to run all tests in batch
run_batch_tests() {
    print_status "🚀 Starting batch execution: Unit, Mutation, and Lint tests"
    
    # Run unit tests
    run_unit_tests
    
    # Run mutation tests
    run_mutation_tests
    
    # Run linting tests
    run_lint_tests
    
    print_success "🎉 All batch tests completed successfully!"
}

# Function to cleanup resources
cleanup() {
    print_status "🧹 Cleaning up resources..."
    
    # Stop and remove containers
    docker rm -f website-dev website-dev-temp website-prod website-playwright website-apollo website-mockoon 2>/dev/null || true
    
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
    echo "Batch Unit, Mutation, and Lint Tests Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  test-unit              Run unit tests (client + server)"
    echo "  test-mutation          Run mutation tests"
    echo "  test-lint              Run all linting tests"
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
    echo "  $0 test-unit           # Run only unit tests"
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
    test-unit)
        run_unit_tests
        ;;
    test-mutation)
        run_mutation_tests
        ;;
    test-lint)
        run_lint_tests
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