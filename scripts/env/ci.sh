#!/bin/bash

# CI Environment Script
# This script contains CI-specific operations that don't need to be in the Makefile

set -e

# Get script directory - works both when sourced and executed in different shells
WEBSITE_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PROJECT_ROOT="$(cd "${WEBSITE_SCRIPT_DIR}/../.." && pwd)"

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
        mkdir -p /etc/docker
        echo '{"hosts": ["tcp://0.0.0.0:2375", "unix:///var/run/docker.sock"]}' > /etc/docker/daemon.json
    fi
    
    # Start Docker service if not running
    if ! docker info > /dev/null 2>&1; then
        log_info "Docker service is already managed by the container"
    fi
    
    # Create network if needed
    if ! docker network ls | grep -q website-network; then
        log_info "Creating Docker network"
        docker network create website-network
    fi
    
    log_success "Docker-in-Docker environment ready"
}

# Setup Makefile for DIND environment (environment-specific bash setup)
setup_makefile_for_dind() {
    log_info "Setting up Makefile targets for DIND environment"
    
    cd "${PROJECT_ROOT}"
    
    # Add DIND variable if not present
    if ! grep -q "^DIND" Makefile; then
        log_info "📝 Adding DIND variable to Makefile..."
        sed -i '/^CI[[:space:]]*?= 0$/a DIND                        ?= 0' Makefile
        log_success "✅ DIND variable added"
    else
        log_info "ℹ️  DIND variable already exists"
    fi
    
    # Add missing variables for DIND mode if not present
    log_info "📝 Adding missing variables for DIND mode..."
    if ! grep -q "^WEBSITE_DOMAIN" Makefile; then
        sed -i '/^NETWORK_NAME.*= website-network$/a WEBSITE_DOMAIN              ?= localhost' Makefile
    fi
    if ! grep -q "^DEV_PORT" Makefile; then
        sed -i '/^WEBSITE_DOMAIN.*?= localhost$/a DEV_PORT                    ?= 3000' Makefile
    fi
    if ! grep -q "^NEXT_PUBLIC_PROD_PORT" Makefile; then
        sed -i '/^DEV_PORT.*?= 3000$/a NEXT_PUBLIC_PROD_PORT       ?= 3001' Makefile
    fi
    if ! grep -q "^PLAYWRIGHT_TEST_PORT" Makefile; then
        sed -i '/^NEXT_PUBLIC_PROD_PORT.*?= 3001$/a PLAYWRIGHT_TEST_PORT        ?= 9323' Makefile
    fi
    if ! grep -q "^UI_HOST" Makefile; then
        sed -i '/^PLAYWRIGHT_TEST_PORT.*?= 9323$/a UI_HOST                     ?= 0.0.0.0' Makefile
    fi
    
    # Add setup-dind-network target if not present
    if ! grep -q "setup-dind-network:" Makefile; then
        log_info "📝 Adding setup-dind-network target..."
        cat >> Makefile << 'SETUP_DIND_TARGET'
setup-dind-network: ## Configure Docker Compose files and create network for DIND mode
ifeq ($(DIND), 1)
	@./scripts/env/ci.sh setup-dind-environment
else
	@echo "ℹ️  DIND mode not enabled, skipping DIND setup"
endif
SETUP_DIND_TARGET
    fi
    
    log_success "✅ Makefile setup completed for DIND environment"
}

# Setup DIND environment (called by Makefile, not complex concatenation)
setup_dind_environment() {
    log_info "🔧 Setting up DIND environment..."
    cd "${PROJECT_ROOT}"
    
    if [ -x "./scripts/ci/configure-dind.sh" ]; then
        ./scripts/ci/configure-dind.sh
    else
        log_warning "configure-dind.sh not found or not executable"
    fi
}

# Add cross-environment test targets to Makefile (environment-specific bash setup)
add_test_targets() {
    log_info "Adding cross-environment test targets to Makefile"
    
    cd "${PROJECT_ROOT}"
    
    # Remove existing test targets to avoid duplicates
    for t in test-unit-all test-mutation lint-next lint-tsc lint-md; do
        sed -i "/^${t}:/,/^[a-zA-Z][a-zA-Z-]*:/d" Makefile
    done
    
    # Add simple unit test target that calls bash script
    cat >> Makefile << 'UNIT_TEST_TARGET'
test-unit-all: ## Execute all unit tests (supports local, CI, and DIND modes)
ifeq ($(DIND), 1)
	@./scripts/env/ci.sh run-unit-dind
else
	$(UNIT_TESTS) TEST_ENV=client $(JEST_BIN) $(JEST_FLAGS)
	$(UNIT_TESTS) TEST_ENV=server $(JEST_BIN) $(JEST_FLAGS) $(TEST_DIR_APOLLO)
endif
UNIT_TEST_TARGET

    log_success "✅ Simple test targets added to Makefile"
}

# Run unit tests in DIND mode (complex logic in bash, not Makefile)
run_unit_tests_dind() {
    log_info "Running unit tests in true Docker-in-Docker mode"
    
    cd "${PROJECT_ROOT}"
    
    log_info "Setting up Docker network..."
    if ! docker network ls | grep -q website-network; then
        docker network create website-network
    fi
    
    # Setup DIND configuration
    log_info "🔧 Setting up DIND environment..."
    if [ -x "./scripts/ci/configure-dind.sh" ]; then
        ./scripts/ci/configure-dind.sh
    fi
    
    log_info "Building container image..."
    docker compose -f docker-compose.yml build dev
    
    log_info "🧹 Cleaning up any existing temporary containers..."
    docker rm -f website-dev-temp 2>/dev/null || true
    
    log_info "🛠️ Starting container in background for file operations..."
    docker run -d --name website-dev-temp --network website-network website-dev tail -f /dev/null
    
    log_info "📂 Copying source files into container..."
    if docker cp . website-dev-temp:/app/; then
        log_success "✅ Source files copied successfully"
    else
        log_error "❌ Failed to copy source files"
        docker rm -f website-dev-temp
        return 1
    fi
    
    log_info "📦 Installing dependencies inside container..."
    if docker exec website-dev-temp sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        log_success "✅ Dependencies installed successfully"
    else
        log_error "❌ Failed to install dependencies"
        docker logs website-dev-temp --tail 20
        docker rm -f website-dev-temp
        return 1
    fi
    
    log_info "🧪 Running client-side tests..."
    if docker exec website-dev-temp sh -c "cd /app && env TEST_ENV=client ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2"; then
        log_success "✅ Client-side tests PASSED"
    else
        log_error "❌ Client-side tests FAILED"
        docker logs website-dev-temp --tail 30
        docker rm -f website-dev-temp
        return 1
    fi
    
    log_info "🧪 Running server-side tests..."
    if docker exec website-dev-temp sh -c "cd /app && env TEST_ENV=server ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2 ./src/test/apollo-server"; then
        log_success "✅ Server-side tests PASSED"
    else
        log_error "❌ Server-side tests FAILED"
        docker logs website-dev-temp --tail 30
        docker rm -f website-dev-temp
        return 1
    fi
    
    log_info "🧹 Cleaning up temporary container..."
    docker rm -f website-dev-temp
    log_success "🎉 All unit tests completed successfully in true DinD mode!"
}

# Setup Node.js environment
setup_nodejs() {
    log_info "Setting up Node.js environment"
    
    # Node.js should already be installed in the container
    if command -v node &> /dev/null; then
        log_info "Node.js version: $(node --version)"
    else
        log_error "Node.js not found"
        return 1
    fi
    
    # Install pnpm if not present
    if ! command -v pnpm &> /dev/null; then
        log_info "Installing pnpm"
        npm install -g pnpm
    fi
    
    log_success "Node.js environment ready"
}

# Install project dependencies (simplified - just call Makefile)
install_project_deps() {
    log_info "Installing project dependencies via Makefile"
    
    cd "${PROJECT_ROOT}"
    
    # In DIND mode, dependencies will be installed by test targets as needed
    # In non-DIND mode, install directly
    if [ "${DIND:-0}" = "1" ]; then
        log_info "DIND mode: Dependencies will be installed by test targets as needed"
        log_success "Ready for DIND operations"
    else
        log_info "Installing dependencies directly (non-DIND mode)"
        if ! command -v pnpm &> /dev/null; then
            npm install -g pnpm
        fi
        pnpm install --frozen-lockfile
        log_success "Dependencies installed"
    fi
}

# Run unit tests (simplified - just call Makefile)
run_unit_tests_ci() {
    log_info "Running unit tests via Makefile"
    
    cd "${PROJECT_ROOT}"
    
    # Call the Makefile target which handles environment detection
    if [ "${DIND:-0}" = "1" ]; then
        log_info "Running tests with DIND=1"
        DIND=1 make test-unit-all
    else
        log_info "Running tests with CI=1"
        CI=1 make test-unit-all
    fi
    
    log_success "Unit tests completed"
}

# Install system dependencies for CI
install_ci_deps() {
    log_info "Installing CI dependencies"
    
    # Check if we're in Alpine Linux
    if [ -f /etc/alpine-release ]; then
        log_info "Detected Alpine Linux - using apk"
        
        # Update package index
        apk update
        
        # Install required packages (most are already installed in the container)
        apk add --no-cache \
            curl \
            git \
            bash \
            make \
            nodejs \
            npm \
            python3 \
            py3-pip \
            ca-certificates
    else
        log_info "Detected Ubuntu/Debian - using apt-get"
        
        # Update package list
        apt-get update -qq
        
        # Install required packages
        apt-get install -y -qq \
            curl \
            gnupg \
            lsb-release \
            ca-certificates \
            software-properties-common
    fi
    
    log_success "CI dependencies installed"
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
        "setup-dind-environment")
            setup_dind_environment
            ;;
        "install-deps")
            install_ci_deps
            ;;
        "setup-nodejs")
            setup_nodejs
            ;;
        "setup-makefile")
            setup_makefile_for_dind
            ;;
        "add-test-targets")
            add_test_targets
            ;;
        "install-project-deps")
            install_project_deps
            ;;
        "run-unit-dind")
            run_unit_tests_dind
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
            setup_makefile_for_dind
            add_test_targets
            ;;
        "help"|*)
            echo "Usage: $0 {setup-dind|setup-dind-environment|install-deps|setup-nodejs|setup-makefile|add-test-targets|install-project-deps|run-unit-dind|test-unit|test-mutation|lint|reports|full-setup}"
            echo ""
            echo "Commands:"
            echo "  setup-dind           - Configure Docker-in-Docker environment"
            echo "  setup-dind-environment - Setup DIND environment (called by Makefile)"
            echo "  install-deps         - Install system dependencies"
            echo "  setup-nodejs         - Setup Node.js and pnpm"
            echo "  setup-makefile       - Setup Makefile for DIND environment"
            echo "  add-test-targets     - Add cross-environment test targets to Makefile"
            echo "  install-project-deps - Install project dependencies (simplified for DIND)"
            echo "  run-unit-dind        - Run unit tests in DIND mode (called by Makefile)"
            echo "  test-unit            - Run unit tests via Makefile (cross-environment)"
            echo "  test-mutation        - Run mutation tests in CI mode"
            echo "  lint                 - Run all linting checks"
            echo "  reports              - Generate and collect test reports"
            echo "  full-setup           - Run complete CI environment setup with Makefile targets"
            ;;
    esac
}

main "$@" 