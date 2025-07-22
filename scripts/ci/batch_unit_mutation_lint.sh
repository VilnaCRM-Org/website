#!/bin/bash

# Batch script for Unit, Mutation, and Lint tests using Makefile
# This script provides a unified interface for local, GitHub, and AWS CI environments

set -e

# Script configuration
# Use a more robust approach for script path detection
if [ -n "${BASH_SOURCE[0]:-}" ]; then
    # Script is being sourced
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
elif [ -n "$0" ]; then
    # Script is being executed directly
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
else
    # Fallback: use current directory
    SCRIPT_DIR="$(pwd)"
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
    print_status "🐳 Running unit tests in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    setup_docker_network
    configure_docker_compose
    echo "Building container image..."
    docker-compose $DOCKER_COMPOSE_DEV_FILE build dev
    echo "🧹 Cleaning up any existing temporary containers..."
    docker rm -f website-dev-temp 2>/dev/null || true
    echo "🛠️ Starting container in background for file operations..."
    docker run -d --name website-dev-temp --network "$NETWORK_NAME" website-dev tail -f /dev/null
    
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
    if docker exec website-dev-temp sh -c "cd /app && env TEST_ENV=server ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2 ./src/test/apollo-server"; then
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

# Function to run mutation tests in DIND mode
run_mutation_tests_dind() {
    print_status "🧬 Running mutation tests in DIND mode"
    
    setup_docker_network
    configure_docker_compose
    
    print_status "Building development container..."
    docker-compose $DOCKER_COMPOSE_DEV_FILE build dev
    
    print_status "Starting development container..."
    docker-compose $DOCKER_COMPOSE_DEV_FILE up -d dev
    wait_for_dev_dind
    
    print_status "🧪 Running mutation tests..."
    if docker exec website-dev sh -c "cd /app && pnpm stryker run"; then
        print_success "✅ Mutation tests PASSED"
    else
        print_error "❌ Mutation tests FAILED"
        docker logs website-dev --tail 30
        exit 1
    fi
    
    print_success "🎉 Mutation tests completed successfully in DIND mode!"
}

# Function to run linting tests in DIND mode
run_lint_tests_dind() {
    print_status "🔍 Running linting tests in DIND mode"
    
    setup_docker_network
    configure_docker_compose
    
    print_status "Building development container..."
    docker-compose $DOCKER_COMPOSE_DEV_FILE build dev
    
    print_status "Starting development container..."
    docker-compose $DOCKER_COMPOSE_DEV_FILE up -d dev
    wait_for_dev_dind
    
    print_status "🧪 Running ESLint..."
    if docker exec website-dev sh -c "cd /app && pnpm next lint"; then
        print_success "✅ ESLint PASSED"
    else
        print_error "❌ ESLint FAILED"
        docker logs website-dev --tail 30
        exit 1
    fi
    
    print_status "🧪 Running TypeScript check..."
    if docker exec website-dev sh -c "cd /app && pnpm tsc"; then
        print_success "✅ TypeScript check PASSED"
    else
        print_error "❌ TypeScript check FAILED"
        docker logs website-dev --tail 30
        exit 1
    fi
    
    print_status "🧪 Running Markdown linting..."
    if docker exec website-dev sh -c "cd /app && pnpm markdownlint **/*.md -i CHANGELOG.md -i 'test-results/**/*.md' -i 'playwright-report/data/**/*.md'"; then
        print_success "✅ Markdown linting PASSED"
    else
        print_error "❌ Markdown linting FAILED"
        docker logs website-dev --tail 30
        exit 1
    fi
    
    print_success "🎉 All linting tests completed successfully in DIND mode!"
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
# When sourced, we need to handle arguments differently
if [ -n "${BASH_SOURCE[0]}" ]; then
    # Script is being sourced - check if we have arguments
    if [ $# -gt 0 ]; then
        # We have arguments, execute the command
        COMMAND="$1"
    else
        # No arguments, show help
        COMMAND="help"
    fi
else
    # Script is being executed directly
    COMMAND="${1:-help}"
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