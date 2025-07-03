#!/bin/bash

# CI Environment Script
# This script contains CI-specific operations that don't need to be in the Makefile

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Setup Docker-in-Docker environment
setup_dind() {
    log_info "Setting up Docker-in-Docker environment"
    
    # Configure Docker daemon
    if [ ! -f /etc/docker/daemon.json ]; then
        log_info "Creating Docker daemon configuration"
        sudo mkdir -p /etc/docker
        echo '{"hosts": ["tcp://0.0.0.0:2375", "unix:///var/run/docker.sock"]}' | sudo tee /etc/docker/daemon.json
    fi
    
    # Start Docker service if not running
    if ! docker info > /dev/null 2>&1; then
        log_info "Starting Docker service"
        sudo service docker start
        sleep 5
    fi
    
    # Create network if needed
    if ! docker network ls | grep -q website-network; then
        log_info "Creating Docker network"
        docker network create website-network
    fi
    
    log_success "Docker-in-Docker environment ready"
}

# Install system dependencies for CI
install_ci_deps() {
    log_info "Installing CI dependencies"
    
    # Update package list
    sudo apt-get update -qq
    
    # Install required packages
    sudo apt-get install -y -qq \
        curl \
        gnupg \
        lsb-release \
        ca-certificates \
        software-properties-common
    
    log_success "CI dependencies installed"
}

# Setup Node.js environment
setup_nodejs() {
    log_info "Setting up Node.js environment"
    
    # Install Node.js if not present
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Install pnpm if not present
    if ! command -v pnpm &> /dev/null; then
        curl -fsSL https://get.pnpm.io/install.sh | sh -
        export PATH="$HOME/.local/share/pnpm:$PATH"
    fi
    
    log_success "Node.js environment ready"
}

# Run unit tests in CI mode with enhanced error handling
run_unit_tests_ci() {
    log_info "Running unit tests in CI mode"
    
    cd "${PROJECT_ROOT}"
    
    # Install dependencies
    pnpm install --frozen-lockfile
    
    # Run client tests
    log_info "Running client-side tests"
    if ! env TEST_ENV=client ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2; then
        log_error "Client-side tests failed"
        return 1
    fi
    
    # Run server tests
    log_info "Running server-side tests"
    if ! env TEST_ENV=server ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2 ./src/test/apollo-server; then
        log_error "Server-side tests failed"
        return 1
    fi
    
    log_success "All unit tests passed"
}

# Run mutation tests in CI mode
run_mutation_tests_ci() {
    log_info "Running mutation tests in CI mode"
    
    cd "${PROJECT_ROOT}"
    
    # Build the project first
    ./node_modules/.bin/next build
    
    # Start dev server in background
    ./node_modules/.bin/next dev &
    DEV_PID=$!
    
    # Wait for server to be ready
    log_info "Waiting for dev server to be ready"
    for i in {1..60}; do
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            log_success "Dev server is ready"
            break
        fi
        sleep 3
        if [ $i -eq 60 ]; then
            log_error "Dev server failed to start"
            kill $DEV_PID 2>/dev/null || true
            return 1
        fi
    done
    
    # Run mutation tests
    if ! pnpm stryker run; then
        log_error "Mutation tests failed"
        kill $DEV_PID 2>/dev/null || true
        return 1
    fi
    
    # Cleanup
    kill $DEV_PID 2>/dev/null || true
    log_success "Mutation tests completed"
}

# Run linting in CI mode
run_lint_ci() {
    log_info "Running linting in CI mode"
    
    cd "${PROJECT_ROOT}"
    
    # ESLint
    log_info "Running ESLint"
    if ! ./node_modules/.bin/next lint; then
        log_error "ESLint failed"
        return 1
    fi
    
    # TypeScript check
    log_info "Running TypeScript check"
    if ! ./node_modules/.bin/tsc; then
        log_error "TypeScript check failed"
        return 1
    fi
    
    # Markdown lint
    log_info "Running Markdown lint"
    if ! ./node_modules/.bin/markdownlint -i CHANGELOG.md -i "test-results/**/*.md" -i "playwright-report/data/**/*.md" "**/*.md"; then
        log_error "Markdown lint failed"
        return 1
    fi
    
    log_success "All linting checks passed"
}

# Generate test reports for CI
generate_reports() {
    log_info "Generating test reports"
    
    # Create reports directory
    mkdir -p reports
    
    # Collect Jest coverage if available
    if [ -d coverage ]; then
        cp -r coverage reports/
        log_success "Jest coverage reports collected"
    fi
    
    # Collect Stryker reports if available
    if [ -d reports/mutation ]; then
        log_success "Mutation test reports available"
    fi
    
    # Collect Playwright reports if available
    if [ -d playwright-report ]; then
        cp -r playwright-report reports/
        log_success "Playwright reports collected"
    fi
    
    log_success "Reports generation completed"
}

# Main function to handle different CI operations
main() {
    case "${1:-help}" in
        "setup-dind")
            setup_dind
            ;;
        "install-deps")
            install_ci_deps
            ;;
        "setup-nodejs")
            setup_nodejs
            ;;
        "test-unit")
            run_unit_tests_ci
            ;;
        "test-mutation")
            run_mutation_tests_ci
            ;;
        "lint")
            run_lint_ci
            ;;
        "reports")
            generate_reports
            ;;
        "full-setup")
            install_ci_deps
            setup_nodejs
            setup_dind
            ;;
        "help"|*)
            echo "Usage: $0 {setup-dind|install-deps|setup-nodejs|test-unit|test-mutation|lint|reports|full-setup}"
            echo ""
            echo "Commands:"
            echo "  setup-dind     - Configure Docker-in-Docker environment"
            echo "  install-deps   - Install system dependencies"
            echo "  setup-nodejs   - Setup Node.js and pnpm"
            echo "  test-unit      - Run unit tests in CI mode"
            echo "  test-mutation  - Run mutation tests in CI mode"
            echo "  lint           - Run all linting checks"
            echo "  reports        - Generate and collect test reports"
            echo "  full-setup     - Run complete CI environment setup"
            ;;
    esac
}

main "$@" 