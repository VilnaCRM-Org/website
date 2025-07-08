#!/bin/bash

# CI Environment Script
# This script contains CI-specific operations that don't need to be in the Makefile

set -e

# Get script directory - works both when sourced and executed in different shells
if [ -n "${BASH_SOURCE[0]}" ]; then
    WEBSITE_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
    WEBSITE_SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
fi
# PROJECT_ROOT is the website directory (script is in website/scripts/env/)
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
    log_info "Skipping Makefile modifications in DinD mode"
    log_info "✅ DinD environment uses direct container management instead of Makefile targets"
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
    log_info "Skipping Makefile test target modifications in DinD mode"
    log_info "✅ DinD tests are called directly via buildspec commands instead of Makefile targets"
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

# Run mutation tests in DIND mode
run_mutation_tests_dind() {
    log_info "Running mutation tests in Docker-in-Docker mode"
    
    cd "${PROJECT_ROOT}"
    
    log_info "Setting up Docker network..."
    if ! docker network ls | grep -q website-network; then
        docker network create website-network
    fi
    
    log_info "🧹 Cleaning up any existing mutation containers..."
    docker rm -f website-dev-mutation 2>/dev/null || true
    
    log_info "Building container image..."
    docker compose -f docker-compose.yml build dev
    
    log_info "🛠️ Starting mutation container..."
    docker run -d --name website-dev-mutation --network website-network -p 3000:3000 website-dev tail -f /dev/null
    
    log_info "📂 Copying source files into container..."
    if docker cp . website-dev-mutation:/app/; then
        log_success "✅ Source files copied successfully"
    else
        log_error "❌ Failed to copy source files"
        docker rm -f website-dev-mutation
        return 1
    fi
    
    log_info "📦 Installing dependencies inside container..."
    if docker exec website-dev-mutation sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        log_success "✅ Dependencies installed successfully"
    else
        log_error "❌ Failed to install dependencies"
        docker rm -f website-dev-mutation
        return 1
    fi
    
    log_info "🔨 Building project inside container..."
    if docker exec website-dev-mutation sh -c "cd /app && ./node_modules/.bin/next build"; then
        log_success "✅ Project built successfully"
    else
        log_error "❌ Failed to build project"
        docker rm -f website-dev-mutation
        return 1
    fi
    
    log_info "🚀 Starting dev server inside container..."
    docker exec -d website-dev-mutation sh -c "cd /app && ./node_modules/.bin/next dev"
    
    log_info "⏳ Waiting for dev server to be ready..."
    for i in {1..60}; do
        if docker exec website-dev-mutation curl -f http://localhost:3000 >/dev/null 2>&1; then
            log_success "✅ Dev server is ready"
            break
        fi
        sleep 3
        if [ $i -eq 60 ]; then
            log_error "❌ Dev server failed to start"
            docker rm -f website-dev-mutation
            return 1
        fi
    done
    
    log_info "🧬 Running mutation tests..."
    if docker exec website-dev-mutation sh -c "cd /app && pnpm stryker run"; then
        log_success "✅ Mutation tests PASSED"
    else
        log_error "❌ Mutation tests FAILED"
        docker logs website-dev-mutation --tail 30
        docker rm -f website-dev-mutation
        return 1
    fi
    
    log_info "📊 Copying mutation reports..."
    docker cp website-dev-mutation:/app/reports/mutation ./reports/ 2>/dev/null || true
    
    log_info "🧹 Cleaning up mutation container..."
    docker rm -f website-dev-mutation
    log_success "🎉 Mutation tests completed successfully in DinD mode!"
}

# Run E2E tests in DIND mode
run_e2e_tests_dind() {
    log_info "Running E2E tests in Docker-in-Docker mode"
    
    cd "${PROJECT_ROOT}"
    
    log_info "Setting up Docker network..."
    if ! docker network ls | grep -q website-network; then
        docker network create website-network
    fi
    
    log_info "🧹 Cleaning up any existing E2E containers..."
    docker rm -f website-playwright 2>/dev/null || true
    
    log_info "Building container image..."
    docker compose -f docker-compose.yml build playwright
    
    log_info "🛠️ Starting Playwright container..."
    docker run -d --name website-playwright --network website-network -p 9323:9323 website-playwright tail -f /dev/null
    
    log_info "📂 Copying source files into container..."
    if docker cp . website-playwright:/app/; then
        log_success "✅ Source files copied successfully"
    else
        log_error "❌ Failed to copy source files"
        docker rm -f website-playwright
        return 1
    fi
    
    log_info "📦 Installing dependencies inside container..."
    if docker exec website-playwright sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        log_success "✅ Dependencies installed successfully"
    else
        log_error "❌ Failed to install dependencies"
        docker rm -f website-playwright
        return 1
    fi
    
    log_info "🎭 Running E2E tests..."
    if docker exec website-playwright sh -c "cd /app && ./node_modules/.bin/playwright test src/test/e2e --reporter=html"; then
        log_success "✅ E2E tests PASSED"
    else
        log_error "❌ E2E tests FAILED"
        docker logs website-playwright --tail 30
        docker rm -f website-playwright
        return 1
    fi
    
    log_info "📊 Copying E2E reports..."
    docker cp website-playwright:/app/playwright-report ./reports/ 2>/dev/null || true
    
    log_info "🧹 Cleaning up E2E container..."
    docker rm -f website-playwright
    log_success "🎉 E2E tests completed successfully in DinD mode!"
}

# Run load tests in DIND mode
run_load_tests_dind() {
    log_info "Running load tests in Docker-in-Docker mode"
    
    cd "${PROJECT_ROOT}"
    
    log_info "Setting up Docker network..."
    if ! docker network ls | grep -q website-network; then
        docker network create website-network
    fi
    
    log_info "🧹 Cleaning up any existing load test containers..."
    docker rm -f website-k6-temp 2>/dev/null || true
    
    log_info "Building container image..."
    docker compose -f docker-compose.yml build k6
    
    log_info "🛠️ Starting K6 container..."
    docker run -d --name website-k6-temp --network website-network website-k6 tail -f /dev/null
    
    log_info "📂 Copying K6 test files into container..."
    if docker cp ./src/test/load/. website-k6-temp:/loadTests/; then
        log_success "✅ Load test files copied successfully"
    else
        log_error "❌ Failed to copy load test files"
        docker rm -f website-k6-temp
        return 1
    fi
    
    log_info "⚡ Running load tests..."
    if docker exec website-k6-temp k6 run /loadTests/load-test.js --summary-trend-stats="avg,min,med,max,p(95),p(99),count"; then
        log_success "✅ Load tests PASSED"
    else
        log_error "❌ Load tests FAILED"
        docker logs website-k6-temp --tail 30
        docker rm -f website-k6-temp
        return 1
    fi
    
    log_info "📊 Copying load test results..."
    docker cp website-k6-temp:/results ./reports/load/ 2>/dev/null || true
    
    log_info "🧹 Cleaning up load test container..."
    docker rm -f website-k6-temp
    log_success "🎉 Load tests completed successfully in DinD mode!"
}

# Run visual tests in DIND mode
run_visual_tests_dind() {
    log_info "Running visual regression tests in Docker-in-Docker mode"
    
    cd "${PROJECT_ROOT}"
    
    log_info "Setting up Docker network..."
    if ! docker network ls | grep -q website-network; then
        docker network create website-network
    fi
    
    log_info "🧹 Cleaning up any existing visual test containers..."
    docker rm -f website-playwright-visual 2>/dev/null || true
    
    log_info "Building container image..."
    docker compose -f docker-compose.yml build playwright
    
    log_info "🛠️ Starting Playwright visual container..."
    docker run -d --name website-playwright-visual --network website-network -p 9324:9324 website-playwright tail -f /dev/null
    
    log_info "📂 Copying source files into container..."
    if docker cp . website-playwright-visual:/app/; then
        log_success "✅ Source files copied successfully"
    else
        log_error "❌ Failed to copy source files"
        docker rm -f website-playwright-visual
        return 1
    fi
    
    log_info "📦 Installing dependencies inside container..."
    if docker exec website-playwright-visual sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        log_success "✅ Dependencies installed successfully"
    else
        log_error "❌ Failed to install dependencies"
        docker rm -f website-playwright-visual
        return 1
    fi
    
    log_info "👀 Running visual regression tests..."
    if docker exec website-playwright-visual sh -c "cd /app && ./node_modules/.bin/playwright test src/test/visual --timeout=60000"; then
        log_success "✅ Visual tests PASSED"
    else
        log_error "❌ Visual tests FAILED"
        docker logs website-playwright-visual --tail 30
        docker rm -f website-playwright-visual
        return 1
    fi
    
    log_info "📊 Copying visual test reports..."
    docker cp website-playwright-visual:/app/test-results ./reports/visual/ 2>/dev/null || true
    
    log_info "🧹 Cleaning up visual test container..."
    docker rm -f website-playwright-visual
    log_success "🎉 Visual tests completed successfully in DinD mode!"
}

# Run lint tests in DIND mode
run_lint_tests_dind() {
    log_info "Running lint tests in Docker-in-Docker mode"
    
    cd "${PROJECT_ROOT}"
    
    log_info "Setting up Docker network..."
    if ! docker network ls | grep -q website-network; then
        docker network create website-network
    fi
    
    log_info "🧹 Cleaning up any existing lint containers..."
    docker rm -f website-lint-eslint website-lint-tsc website-lint-md 2>/dev/null || true
    
    log_info "Building container image..."
    docker compose -f docker-compose.yml build dev
    
    # ESLint in parallel
    log_info "🔍 Running ESLint in container..."
    docker run -d --name website-lint-eslint --network website-network website-dev tail -f /dev/null
    docker cp . website-lint-eslint:/app/
    docker exec website-lint-eslint sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile" >/dev/null 2>&1
    
    # TypeScript in parallel  
    log_info "🔍 Running TypeScript check in container..."
    docker run -d --name website-lint-tsc --network website-network website-dev tail -f /dev/null
    docker cp . website-lint-tsc:/app/
    docker exec website-lint-tsc sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile" >/dev/null 2>&1
    
    # Markdown in parallel
    log_info "🔍 Running Markdown lint in container..."
    docker run -d --name website-lint-md --network website-network website-dev tail -f /dev/null
    docker cp . website-lint-md:/app/
    docker exec website-lint-md sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile" >/dev/null 2>&1
    
    # Run all lints in parallel and check results
    ESLINT_SUCCESS=0
    TSC_SUCCESS=0
    MD_SUCCESS=0
    
    if docker exec website-lint-eslint sh -c "cd /app && ./node_modules/.bin/next lint"; then
        log_success "✅ ESLint PASSED"
        ESLINT_SUCCESS=1
    else
        log_error "❌ ESLint FAILED"
    fi
    
    if docker exec website-lint-tsc sh -c "cd /app && ./node_modules/.bin/tsc --noEmit"; then
        log_success "✅ TypeScript check PASSED"
        TSC_SUCCESS=1
    else
        log_error "❌ TypeScript check FAILED"
    fi
    
    if docker exec website-lint-md sh -c "cd /app && ./node_modules/.bin/markdownlint -i CHANGELOG.md -i 'test-results/**/*.md' -i 'playwright-report/data/**/*.md' '**/*.md'"; then
        log_success "✅ Markdown lint PASSED"
        MD_SUCCESS=1
    else
        log_error "❌ Markdown lint FAILED"
    fi
    
    # Cleanup containers
    log_info "🧹 Cleaning up lint containers..."
    docker rm -f website-lint-eslint website-lint-tsc website-lint-md
    
    # Check if all passed
    if [ $ESLINT_SUCCESS -eq 1 ] && [ $TSC_SUCCESS -eq 1 ] && [ $MD_SUCCESS -eq 1 ]; then
        log_success "🎉 All lint tests completed successfully in DinD mode!"
        return 0
    else
        log_error "❌ Some lint tests failed"
        return 1
    fi
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
        "run-mutation-dind")
            run_mutation_tests_dind
            ;;
        "run-e2e-dind")
            run_e2e_tests_dind
            ;;
        "run-load-dind")
            run_load_tests_dind
            ;;
        "run-visual-dind")
            run_visual_tests_dind
            ;;
        "run-lint-dind")
            run_lint_tests_dind
            ;;
        "test-unit")
            run_unit_tests_ci
            ;;
        "reports")
            generate_reports
            ;;
        "full-setup")
            install_ci_deps
            setup_nodejs
            setup_dind
            log_info "✅ CI environment setup completed (DinD mode ready)"
            ;;
        "help"|*)
            echo "Usage: $0 {setup-dind|setup-dind-environment|install-deps|setup-nodejs|install-project-deps|run-unit-dind|run-mutation-dind|run-e2e-dind|run-load-dind|run-visual-dind|run-lint-dind|test-unit|reports|full-setup}"
            echo ""
            echo "Commands:"
            echo "  setup-dind           - Configure Docker-in-Docker environment"
            echo "  setup-dind-environment - Setup DIND environment (called by buildspec)"
            echo "  install-deps         - Install system dependencies"
            echo "  setup-nodejs         - Setup Node.js and pnpm"
            echo "  install-project-deps - Install project dependencies (simplified for DIND)"
            echo "  run-unit-dind        - Run unit tests in DIND mode (website-dev-temp container)"
            echo "  run-mutation-dind    - Run mutation tests in DIND mode (website-dev-mutation container)"
            echo "  run-e2e-dind         - Run E2E tests in DIND mode (website-playwright container)"
            echo "  run-load-dind        - Run load tests in DIND mode (website-k6-temp container)"
            echo "  run-visual-dind      - Run visual tests in DIND mode (website-playwright-visual container)"
            echo "  run-lint-dind        - Run lint tests in DIND mode (parallel containers)"
            echo "  test-unit            - Run unit tests in CI mode (fallback)"
            echo "  reports              - Generate and collect test reports"
            echo "  full-setup           - Run complete CI environment setup for DinD mode"
            ;;
    esac
}

main "$@" 