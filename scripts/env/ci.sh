#!/bin/bash

# CI Environment Script
# This script contains CI-specific operations that don't need to be in the Makefile

set -e

# Get script directory - works both when sourced and executed in different shells
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PROJECT_ROOT="$(cd "${CURRENT_SCRIPT_DIR}/../.." && pwd)"

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

# Setup Docker environment using host Docker daemon (best practice)
setup_dind() {
    log_info "Setting up Docker environment using host Docker daemon"
    
    # Verify Docker socket is accessible (should be bind-mounted from host)
    if [ ! -S /var/run/docker.sock ]; then
        log_error "Docker socket not found. Ensure /var/run/docker.sock is bind-mounted from host"
        log_error "Use: -v /var/run/docker.sock:/var/run/docker.sock"
        return 1
    fi
    
    # Test Docker connectivity
    if ! docker info > /dev/null 2>&1; then
        log_error "Cannot connect to Docker daemon"
        return 1
    fi
    
    log_info "Docker daemon version: $(docker --version)"
    
    # Create custom network if needed (user-defined networks have built-in DNS)
    if ! docker network ls | grep -q app-net; then
        log_info "Creating custom Docker network 'app-net' for DNS resolution"
        docker network create app-net --driver bridge
    fi
    
    # Log network information for debugging
    log_info "Available Docker networks:"
    docker network ls
    
    log_success "Docker environment ready (using host daemon)"
}

# Helper function to run Docker Compose with best practices
run_compose_with_host_daemon() {
    local compose_files="$1"
    local action="$2"
    
    log_info "Running Docker Compose with host daemon (best practice)"
    log_info "Compose files: $compose_files"
    log_info "Action: $action"
    
    # Example of the recommended pattern:
    # docker run --rm -it \
    #   -v /var/run/docker.sock:/var/run/docker.sock \
    #   -v "$(pwd)":/workspace \
    #   -w /workspace \
    #   docker:24.0.2 \
    #   sh -c "docker compose $compose_files $action"
    
    # For direct usage (when already in container with mounted socket):
    docker compose $compose_files $action
    
    # Verify network connectivity after starting services
    if [ "$action" = "up -d" ]; then
        log_info "Checking network connectivity..."
        docker network inspect app-net >/dev/null 2>&1 && {
            log_info "Services on app-net network:"
            docker network inspect app-net --format '{{range .Containers}}{{.Name}} ({{.IPv4Address}}) {{end}}'
        }
    fi
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

# Install project dependencies (key working logic from legacy scripts)
install_project_deps() {
    log_info "Installing project dependencies"
    
    cd "${PROJECT_ROOT}"
    
    # Exact sequence from legacy script that works
    log_info "Installing pnpm globally"
    npm install -g pnpm
    
    log_info "Installing dependencies with frozen lockfile"
    pnpm install --frozen-lockfile
    
    # Verify installation
    log_info "Verifying installation"
    if [ -f "./node_modules/.bin/jest" ]; then
        log_success "✅ Jest found at ./node_modules/.bin/jest"
    else
        log_error "❌ Jest not found at ./node_modules/.bin/jest"
        ls -la ./node_modules/.bin/ || log_error "node_modules/.bin/ directory not found"
        return 1
    fi
    
    log_success "Project dependencies installed successfully"
}

# Lighthouse Desktop Tests
test_lighthouse_desktop() {
    log_info "Running Lighthouse Desktop audit"
    cd "${PROJECT_ROOT}"
    
    # Check if running in CodeBuild DinD environment
    if [ "${DIND:-0}" = "1" ]; then
        log_info "🐳 Running Lighthouse Desktop audit in true Docker-in-Docker mode"
        
        # Setup Docker network (like legacy scripts)
        if command -v make &> /dev/null && [ -f "Makefile" ]; then
            make setup-dind-network || log_warn "Could not setup dind network via Makefile"
        else
            # Fallback network setup
            if ! docker network ls | grep -q website-network; then
                docker network create website-network
            fi
        fi
        
        # Build production environment
        log_info "Building production environment for lighthouse..."
        docker compose -f docker-compose.yml -f docker-compose.test.yml build
        
        # Create temporary docker-compose override with memory settings
        log_info "📝 Creating temporary docker-compose override with memory settings for Chrome..."
        cat > docker-compose.memory-override.yml << EOF
services:
  prod:
    mem_limit: 2g
    mem_reservation: 1g
    shm_size: 2gb
EOF
        
        # Start production with memory override
        log_info "🚀 Starting production services with increased memory..."
        docker compose -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.memory-override.yml up -d
        rm -f docker-compose.memory-override.yml
        
        # Wait for production to be ready
        log_info "⏳ Waiting for production services to be ready..."
        for i in $(seq 1 60); do
            if docker ps --filter "name=website-prod" --filter "status=running" --format "{{.Names}}" | grep -q "website-prod"; then
                if docker exec website-prod sh -c "curl -f http://localhost:3001 >/dev/null 2>&1"; then
                    log_success "✅ Production service is ready on port 3001!"
                    break
                fi
            fi
            echo "Attempt $i: Production service not ready yet..."
            sleep 3
            if [ $i -eq 60 ]; then
                log_error "❌ Production service failed to start within 180 seconds"
                return 1
            fi
        done
        
        # Install Chrome and Lighthouse in the production container
        log_info "📦 Installing Chrome and Lighthouse CLI in container..."
        if docker exec website-prod sh -c "apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0"; then
            log_success "✅ Chrome and Lighthouse CLI installed successfully"
        else
            log_error "❌ Failed to install Chrome and Lighthouse CLI"
            return 1
        fi
        
        # Copy Lighthouse config
        log_info "📂 Copying Lighthouse config files..."
        if docker cp lighthouserc.desktop.js website-prod:/app/; then
            log_success "✅ Lighthouse config files copied successfully"
        else
            log_error "❌ Failed to copy Lighthouse config files"
            return 1
        fi
        
        # Test Chrome installation
        log_info "🧪 Testing Chrome installation..."
        if docker exec website-prod /usr/bin/chromium-browser --version; then
            log_success "✅ Chrome is installed and working"
        else
            log_error "❌ Chrome installation test failed"
            return 1
        fi
        
        # Run Lighthouse audit
        log_info "🏃 Running Lighthouse Desktop audit..."
        mkdir -p lhci-reports-desktop
        if docker exec -w /app website-prod lhci autorun --config=lighthouserc.desktop.js \
            --collect.url=http://localhost:3001 \
            --collect.chromePath=/usr/bin/chromium-browser \
            --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding"; then
            log_success "✅ Lighthouse Desktop audit PASSED"
        else
            log_error "❌ Lighthouse Desktop audit FAILED"
            docker logs website-prod --tail 30
            return 1
        fi
        
        # Copy results
        docker cp website-prod:/app/lhci-reports-desktop/. lhci-reports-desktop/ 2>/dev/null || echo "No lighthouse desktop results to copy"
        log_success "🎉 Lighthouse Desktop audit completed successfully in true DinD mode!"
        
    else
        # Standard mode (non-CodeBuild)
        log_info "🐳 Running Lighthouse Desktop audit with standard Docker Compose"
        
        # Install Chrome and Lighthouse CLI if needed
        if ! command -v chromium-browser &> /dev/null; then
            log_info "Installing Chromium browser"
            if command -v apk &> /dev/null; then
                apk add --no-cache chromium chromium-chromedriver
            elif command -v apt-get &> /dev/null; then
                apt-get update && apt-get install -y chromium-browser
            fi
        fi
        
        if ! command -v lhci &> /dev/null; then
            log_info "Installing Lighthouse CI"
            npm install -g @lhci/cli@0.14.0
        fi
        
        # Start production if not running
        if ! docker ps --filter "name=website-prod" --filter "status=running" -q | grep -q .; then
            log_info "Starting production environment for Lighthouse"
            docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
            sleep 10
        fi
        
        # Run audit
        mkdir -p lhci-reports-desktop
        lhci autorun --config=lighthouserc.desktop.js \
            --collect.url=http://localhost:3001 \
            --collect.chromePath=/usr/bin/chromium-browser \
            --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless"
        
        log_success "Lighthouse Desktop audit completed"
    fi
}

# Lighthouse Mobile Tests  
test_lighthouse_mobile() {
    log_info "Running Lighthouse Mobile audit"
    cd "${PROJECT_ROOT}"
    
    # Check if running in CodeBuild DinD environment
    if [ "${DIND:-0}" = "1" ]; then
        log_info "🐳 Running Lighthouse Mobile audit in true Docker-in-Docker mode"
        
        # Setup Docker network
        if command -v make &> /dev/null && [ -f "Makefile" ]; then
            make setup-dind-network || log_warn "Could not setup dind network via Makefile"
        else
            if ! docker network ls | grep -q website-network; then
                docker network create website-network
            fi
        fi
        
        # Build production environment
        log_info "Building production environment for lighthouse..."
        docker compose -f docker-compose.yml -f docker-compose.test.yml build
        
        # Create temporary docker-compose override with memory settings
        log_info "📝 Creating temporary docker-compose override with memory settings for Chrome..."
        cat > docker-compose.memory-override.yml << EOF
services:
  prod:
    mem_limit: 2g
    mem_reservation: 1g
    shm_size: 2gb
EOF
        
        # Start production with memory override
        log_info "🚀 Starting production services with increased memory..."
        docker compose -f docker-compose.yml -f docker-compose.test.yml -f docker-compose.memory-override.yml up -d
        rm -f docker-compose.memory-override.yml
        
        # Wait for production to be ready
        log_info "⏳ Waiting for production services to be ready..."
        for i in $(seq 1 60); do
            if docker ps --filter "name=website-prod" --filter "status=running" --format "{{.Names}}" | grep -q "website-prod"; then
                if docker exec website-prod sh -c "curl -f http://localhost:3001 >/dev/null 2>&1"; then
                    log_success "✅ Production service is ready on port 3001!"
                    break
                fi
            fi
            echo "Attempt $i: Production service not ready yet..."
            sleep 3
            if [ $i -eq 60 ]; then
                log_error "❌ Production service failed to start within 180 seconds"
                return 1
            fi
        done
        
        # Install Chrome and Lighthouse in the production container
        log_info "📦 Installing Chrome and Lighthouse CLI in container..."
        if docker exec website-prod sh -c "apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0"; then
            log_success "✅ Chrome and Lighthouse CLI installed successfully"
        else
            log_error "❌ Failed to install Chrome and Lighthouse CLI"
            return 1
        fi
        
        # Copy Lighthouse config
        log_info "📂 Copying Lighthouse config files..."
        if docker cp lighthouserc.mobile.js website-prod:/app/; then
            log_success "✅ Lighthouse config files copied successfully"
        else
            log_error "❌ Failed to copy Lighthouse config files"
            return 1
        fi
        
        # Test Chrome installation
        log_info "🧪 Testing Chrome installation..."
        if docker exec website-prod /usr/bin/chromium-browser --version; then
            log_success "✅ Chrome is installed and working"
        else
            log_error "❌ Chrome installation test failed"
            return 1
        fi
        
        # Run Lighthouse audit
        log_info "🏃 Running Lighthouse Mobile audit..."
        mkdir -p lhci-reports-mobile
        if docker exec -w /app website-prod lhci autorun --config=lighthouserc.mobile.js \
            --collect.url=http://localhost:3001 \
            --collect.chromePath=/usr/bin/chromium-browser \
            --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding"; then
            log_success "✅ Lighthouse Mobile audit PASSED"
        else
            log_error "❌ Lighthouse Mobile audit FAILED"
            docker logs website-prod --tail 30
            return 1
        fi
        
        # Copy results
        docker cp website-prod:/app/lhci-reports-mobile/. lhci-reports-mobile/ 2>/dev/null || echo "No lighthouse mobile results to copy"
        log_success "🎉 Lighthouse Mobile audit completed successfully in true DinD mode!"
        
    else
        # Standard mode (non-CodeBuild)
        log_info "🐳 Running Lighthouse Mobile audit with standard Docker Compose"
        
        # Install Chrome and Lighthouse CLI if needed
        if ! command -v chromium-browser &> /dev/null; then
            log_info "Installing Chromium browser"
            if command -v apk &> /dev/null; then
                apk add --no-cache chromium chromium-chromedriver
            elif command -v apt-get &> /dev/null; then
                apt-get update && apt-get install -y chromium-browser
            fi
        fi
        
        if ! command -v lhci &> /dev/null; then
            log_info "Installing Lighthouse CI"
            npm install -g @lhci/cli@0.14.0
        fi
        
        # Start production if not running
        if ! docker ps --filter "name=website-prod" --filter "status=running" -q | grep -q .; then
            log_info "Starting production environment for Lighthouse"
            docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
            sleep 10
        fi
        
        # Run audit
        mkdir -p lhci-reports-mobile
        lhci autorun --config=lighthouserc.mobile.js \
            --collect.url=http://localhost:3001 \
            --collect.chromePath=/usr/bin/chromium-browser \
            --collect.chromeFlags="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless"
        
        log_success "Lighthouse Mobile audit completed"
    fi
}

# Memory Leak Tests
test_memory_leak() {
    log_info "Running Memory Leak tests using Memlab"
    cd "${PROJECT_ROOT}"
    
    # Check if running in CodeBuild DinD environment
    if [ "${DIND:-0}" = "1" ]; then
        log_info "🐳 Running memory leak tests in true Docker-in-Docker mode"
        
        # Setup Docker network
        if command -v make &> /dev/null && [ -f "Makefile" ]; then
            make setup-dind-network || log_warn "Could not setup dind network via Makefile"
        else
            if ! docker network ls | grep -q website-network; then
                docker network create website-network
            fi
        fi
        
        # Clean up existing containers
        log_info "🧹 Cleaning up any existing containers..."
        docker rm -f website-prod website-memory-leak-temp 2>/dev/null || true
        
        # Build and start production
        log_info "🏗️ Building production environment for memory leak testing..."
        docker compose -f docker-compose.yml -f docker-compose.test.yml build
        docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
        
        # Wait for production to be ready
        log_info "⏳ Waiting for production services to be ready..."
        for i in $(seq 1 60); do
            if docker ps --filter "name=website-prod" --filter "status=running" --format "{{.Names}}" | grep -q "website-prod"; then
                if docker exec website-prod sh -c "curl -f http://localhost:3001 >/dev/null 2>&1"; then
                    log_success "✅ Production service is ready on port 3001!"
                    break
                fi
            fi
            echo "Attempt $i: Production service not ready yet..."
            if [ $((i % 15)) -eq 0 ]; then
                echo "Debug info at attempt $i:"
                docker ps --filter "name=website-prod" || echo "No prod containers found"
            fi
            sleep 3
            if [ $i -eq 60 ]; then
                log_error "❌ Production service failed to start within 180 seconds"
                docker logs website-prod --tail 50 2>/dev/null || echo "Cannot get prod logs"
                return 1
            fi
        done
        
        # Build memory leak container
        log_info "🧪 Building memory leak test container..."
        docker compose -f docker-compose.memory-leak.yml build memory-leak
        
        # Start temporary memory leak container
        log_info "🛠️ Starting memory leak test container..."
        docker run -d --name website-memory-leak-temp \
            --network website-network \
            --env NEXT_PUBLIC_PROD_CONTAINER_API_URL=http://website-prod:3001 \
            --env MEMLAB_DEBUG=true \
            --env MEMLAB_SKIP_WARMUP=true \
            --env DISPLAY=:99 \
            --shm-size=1gb \
            website-memory-leak tail -f /dev/null
        
        # Copy source files
        log_info "📂 Copying source files into memory leak container..."
        if docker cp src/test/memory-leak/. website-memory-leak-temp:/app/src/test/memory-leak/; then
            log_success "✅ Memory leak test files copied successfully"
        else
            log_error "❌ Failed to copy memory leak test files"
            docker rm -f website-memory-leak-temp
            return 1
        fi
        
        # Copy config files
        docker cp src/config/i18nConfig.js website-memory-leak-temp:/app/src/config/ 2>/dev/null || echo "Config file not found"
        docker cp pages/i18n/localization.json website-memory-leak-temp:/app/pages/i18n/ 2>/dev/null || echo "Localization file not found"
        
        # Clean up previous results and run tests
        docker exec website-memory-leak-temp sh -c "rm -rf /app/src/test/memory-leak/results"
        log_info "🧠 Running Memlab memory leak tests..."
        if docker exec website-memory-leak-temp sh -c "cd /app && node src/test/memory-leak/runMemlabTests.js"; then
            log_success "✅ Memory leak tests PASSED"
        else
            log_error "❌ Memory leak tests FAILED"
            docker logs website-memory-leak-temp --tail 30
            docker rm -f website-memory-leak-temp
            return 1
        fi
        
        # Copy results and cleanup
        mkdir -p memory-leak-results
        docker cp website-memory-leak-temp:/app/src/test/memory-leak/results/. memory-leak-results/ 2>/dev/null || echo "No memory leak results to copy"
        docker rm -f website-memory-leak-temp
        log_success "🎉 Memory leak tests completed successfully in true DinD mode!"
        
    else
        # Standard mode
        log_info "🐳 Running memory leak tests with standard Docker Compose"
        docker compose -f docker-compose.memory-leak.yml up -d
        docker compose -f docker-compose.memory-leak.yml exec -T memory-leak rm -rf /app/src/test/memory-leak/results
        docker compose -f docker-compose.memory-leak.yml exec -T memory-leak node /app/src/test/memory-leak/runMemlabTests.js
        log_success "Memory leak tests completed"
    fi
}

# Playwright E2E Tests
test_e2e() {
    log_info "Running Playwright E2E tests"
    cd "${PROJECT_ROOT}"
    
    # Check if running in CodeBuild DinD environment
    if [ "${DIND:-0}" = "1" ]; then
        log_info "🐳 Running E2E tests in true Docker-in-Docker mode"
        
        # Check if Playwright container is available
        log_info "Checking if Playwright container is available..."
        for i in $(seq 1 30); do
            if docker ps --filter "name=website-playwright" --filter "status=running" --format "{{.Names}}" | grep -q "website-playwright"; then
                log_success "✅ Playwright container is running"
                break
            fi
            echo "Attempt $i: Playwright container not running yet, waiting..."
            sleep 2
            if [ $i -eq 30 ]; then
                log_error "❌ Playwright container failed to start within 60 seconds"
                docker ps -a --filter "name=website-playwright"
                return 1
            fi
        done
        
        # Copy source code and run tests
        mkdir -p playwright-e2e-reports
        log_info "📂 Copying source code to Playwright container..."
        docker cp . website-playwright:/app || echo "Warning: Failed to copy source code"
        
        log_info "🔍 Debugging: Verifying source code copy..."
        docker exec website-playwright sh -c "ls -la /app && ls -la /app/src/test/e2e | head -5" || true
        
        if docker exec website-playwright sh -c "cd /app && npx playwright test src/test/e2e --reporter=html"; then
            log_success "✅ E2E tests PASSED"
        else
            log_error "❌ E2E tests FAILED"
            echo "🔍 Debugging: Checking Playwright install and test files..."
            docker exec website-playwright sh -c "npx playwright --version && find /app -name '*.spec.ts' | head -5" || true
            return 1
        fi
        
        # Copy results
        docker cp website-playwright:/app/playwright-report/. playwright-e2e-reports/ 2>/dev/null || echo "No E2E reports to copy"
        log_success "🎉 E2E tests completed successfully in true DinD mode!"
        
    else
        # Standard mode
        log_info "Starting production environment for E2E testing"
        docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
        
        mkdir -p playwright-e2e-reports
        if ! docker ps --filter "name=website-playwright" --filter "status=running" -q | grep -q .; then
            log_error "Playwright container not running"
            return 1
        fi
        
        docker exec website-playwright sh -c "cd /app && npx playwright test src/test/e2e --reporter=html"
        log_success "E2E tests completed"
    fi
}

# Playwright Visual Tests
test_visual() {
    log_info "Running Playwright Visual tests"
    cd "${PROJECT_ROOT}"
    
    # Check if running in CodeBuild DinD environment
    if [ "${DIND:-0}" = "1" ]; then
        log_info "🐳 Running Visual tests in true Docker-in-Docker mode"
        
        # Check if Playwright container is available
        log_info "Checking if Playwright container is available..."
        for i in $(seq 1 30); do
            if docker ps --filter "name=website-playwright" --filter "status=running" --format "{{.Names}}" | grep -q "website-playwright"; then
                log_success "✅ Playwright container is running"
                break
            fi
            echo "Attempt $i: Playwright container not running yet, waiting..."
            sleep 2
            if [ $i -eq 30 ]; then
                log_error "❌ Playwright container failed to start within 60 seconds"
                docker ps -a --filter "name=website-playwright"
                return 1
            fi
        done
        
        # Copy source code and run tests
        mkdir -p playwright-visual-reports
        log_info "📂 Copying source code to Playwright container..."
        docker cp . website-playwright:/app || echo "Warning: Failed to copy source code"
        
        log_info "🔍 Debugging: Verifying source code copy..."
        docker exec website-playwright sh -c "ls -la /app && ls -la /app/src/test/visual | head -5" || true
        
        if docker exec website-playwright sh -c "cd /app && npx playwright test src/test/visual --reporter=html --timeout=30000"; then
            log_success "✅ Visual tests PASSED"
        else
            log_error "❌ Visual tests FAILED"
            echo "🔍 Debugging: Checking Playwright install and test files..."
            docker exec website-playwright sh -c "npx playwright --version && find /app -path '*/visual/*.spec.ts' | head -5" || true
            return 1
        fi
        
        # Copy results
        docker cp website-playwright:/app/playwright-report/. playwright-visual-reports/ 2>/dev/null || echo "No Visual reports to copy"
        log_success "🎉 Visual tests completed successfully in true DinD mode!"
        
    else
        # Standard mode
        log_info "Starting production environment for visual testing"
        docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
        
        mkdir -p playwright-visual-reports
        if ! docker ps --filter "name=website-playwright" --filter "status=running" -q | grep -q .; then
            log_error "Playwright container not running"
            return 1
        fi
        
        docker exec website-playwright sh -c "cd /app && npx playwright test src/test/visual --reporter=html --timeout=30000"
        log_success "Visual tests completed"
    fi
}

# Playwright Visual Tests with UI
test_visual_ui() {
    log_info "Running Playwright Visual tests with UI"
    cd "${PROJECT_ROOT}"
    
    # Check if running in CodeBuild DinD environment
    if [ "${DIND:-0}" = "1" ]; then
        log_info "🐳 Running Visual tests with UI in true Docker-in-Docker mode"
        log_info "⚠️  Note: UI mode not fully supported in DinD environment"
        
        # Check if Playwright container is available
        log_info "Checking if Playwright container is available..."
        for i in $(seq 1 30); do
            if docker ps --filter "name=website-playwright" --filter "status=running" --format "{{.Names}}" | grep -q "website-playwright"; then
                log_success "✅ Playwright container is running"
                break
            fi
            echo "Attempt $i: Playwright container not running yet, waiting..."
            sleep 2
            if [ $i -eq 30 ]; then
                log_error "❌ Playwright container failed to start within 60 seconds"
                docker ps -a --filter "name=website-playwright"
                return 1
            fi
        done
        
        # Copy source code and run tests
        mkdir -p playwright-visual-reports
        log_info "📂 Copying source code to Playwright container..."
        docker cp . website-playwright:/app || echo "Warning: Failed to copy source code"
        
        if docker exec website-playwright sh -c "cd /app && npx playwright test src/test/visual --ui-port=9324 --ui-host=0.0.0.0 --reporter=html --timeout=30000"; then
            log_success "✅ Visual UI tests PASSED"
        else
            log_error "❌ Visual UI tests FAILED"
            return 1
        fi
        
        # Copy results
        docker cp website-playwright:/app/playwright-report/. playwright-visual-reports/ 2>/dev/null || echo "No Visual reports to copy"
        log_success "🎉 Visual UI tests completed successfully in true DinD mode!"
        
    else
        # Standard mode
        log_info "Starting production environment for visual UI testing"
        docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
        
        mkdir -p playwright-visual-reports
        if ! docker ps --filter "name=website-playwright" --filter "status=running" -q | grep -q .; then
            log_error "Playwright container not running"
            return 1
        fi
        
        docker exec website-playwright sh -c "cd /app && npx playwright test src/test/visual --ui-port=9324 --ui-host=0.0.0.0 --reporter=html --timeout=30000"
        log_success "Visual UI tests completed"
    fi
}

# Update Playwright Visual Snapshots
test_visual_update() {
    log_info "Updating Playwright Visual snapshots"
    cd "${PROJECT_ROOT}"
    
    # Check if running in CodeBuild DinD environment
    if [ "${DIND:-0}" = "1" ]; then
        log_info "🐳 Updating Visual snapshots in true Docker-in-Docker mode"
        
        # Check if Playwright container is available
        log_info "Checking if Playwright container is available..."
        for i in $(seq 1 30); do
            if docker ps --filter "name=website-playwright" --filter "status=running" --format "{{.Names}}" | grep -q "website-playwright"; then
                log_success "✅ Playwright container is running"
                break
            fi
            echo "Attempt $i: Playwright container not running yet, waiting..."
            sleep 2
            if [ $i -eq 30 ]; then
                log_error "❌ Playwright container failed to start within 60 seconds"
                docker ps -a --filter "name=website-playwright"
                return 1
            fi
        done
        
        # Copy source code and update snapshots
        log_info "📸 Updating Playwright Visual snapshots..."
        log_info "📂 Copying source code to Playwright container..."
        docker cp . website-playwright:/app || echo "Warning: Failed to copy source code"
        
        if docker exec website-playwright sh -c "cd /app && npx playwright test src/test/visual --update-snapshots --timeout=15000"; then
            log_success "✅ Visual snapshots updated successfully"
        else
            log_error "❌ Visual snapshot update FAILED"
            return 1
        fi
        
        # Copy updated snapshots back
        log_info "📂 Copying updated snapshots back..."
        docker cp website-playwright:/app/src/test/visual/. src/test/visual/ 2>/dev/null || echo "No snapshots to copy back"
        log_success "🎉 Visual snapshots updated successfully in true DinD mode!"
        
    else
        # Standard mode
        log_info "Starting production environment for snapshot update"
        docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
        
        if ! docker ps --filter "name=website-playwright" --filter "status=running" -q | grep -q .; then
            log_error "Playwright container not running"
            return 1
        fi
        
        docker exec website-playwright sh -c "cd /app && npx playwright test src/test/visual --update-snapshots --timeout=15000"
        log_success "Visual snapshots updated successfully"
    fi
}

# K6 Load Tests
test_load() {
    log_info "Running K6 Load tests"
    cd "${PROJECT_ROOT}"
    
    # Check if running in CodeBuild DinD environment
    if [ "${DIND:-0}" = "1" ]; then
        log_info "🐳 Running Load tests in true Docker-in-Docker mode"
        
        # Setup Docker network
        if command -v make &> /dev/null && [ -f "Makefile" ]; then
            make setup-dind-network || log_warn "Could not setup dind network via Makefile"
        else
            if ! docker network ls | grep -q website-network; then
                docker network create website-network
            fi
        fi
        
        # Build k6 container
        log_info "Building k6 container image..."
        docker compose -f docker-compose.test.yml --profile load build k6
        
        # Clean up existing containers
        log_info "🧹 Cleaning up any existing k6 containers..."
        docker rm -f website-k6-temp 2>/dev/null || true
        
        # Create results directory
        log_info "📂 Creating results directory..."
        mkdir -p src/test/load/results
        
        # Start k6 container in background for file operations
        log_info "🛠️ Starting k6 container in background for file operations..."
        docker run -d --name website-k6-temp --network website-network --entrypoint=/bin/sh website-k6 -c "while true; do sleep 60; done"
        
        # Copy load test files
        log_info "📂 Copying load test files into k6 container..."
        if docker cp src/test/load/. website-k6-temp:/loadTests/; then
            log_success "✅ Load test files copied successfully"
        else
            log_error "❌ Failed to copy load test files"
            docker rm -f website-k6-temp
            return 1
        fi
        
        # Verify files
        log_info "📂 Verifying load test files..."
        docker exec website-k6-temp /bin/sh -c "ls -la /loadTests/ && head -5 /loadTests/homepage.js"
        
        # Run load tests
        log_info "🚀 Running K6 load tests..."
        if docker exec -w /loadTests website-k6-temp /bin/k6 run --summary-trend-stats='avg,min,med,max,p(95),p(99)' --out 'web-dashboard=period=1s&export=/loadTests/results/homepage.html' homepage.js; then
            log_success "✅ Load tests PASSED"
        else
            log_error "❌ Load tests FAILED"
            docker logs website-k6-temp --tail 30
            docker rm -f website-k6-temp
            return 1
        fi
        
        # Copy results and cleanup
        docker cp website-k6-temp:/loadTests/results/. src/test/load/results/ 2>/dev/null || echo "No load test results to copy"
        docker rm -f website-k6-temp
        log_success "🎉 Load tests completed successfully in true DinD mode!"
        
    else
        # Standard mode
        log_info "Starting production environment for load testing"
        docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
        
        mkdir -p src/test/load/results
        docker compose -f docker-compose.test.yml --profile load build k6
        docker run --rm --network website-network \
            -v "$(pwd)/src/test/load:/loadTests" \
            -v "$(pwd)/src/test/load/results:/results" \
            website-k6 run --summary-trend-stats='avg,min,med,max,p(95),p(99)' \
            --out 'web-dashboard=period=1s&export=/results/homepage.html' \
            /loadTests/homepage.js
        
        log_success "Load tests completed"
    fi
}

# Generate test reports for CI
generate_reports() {
    log_info "Generating test reports for CI"
    cd "${PROJECT_ROOT}"
    
    # Create reports directory
    mkdir -p reports
    
    # Copy various test results
    [ -d "playwright-e2e-reports" ] && cp -r playwright-e2e-reports reports/
    [ -d "playwright-visual-reports" ] && cp -r playwright-visual-reports reports/
    [ -d "lhci-reports-desktop" ] && cp -r lhci-reports-desktop reports/
    [ -d "lhci-reports-mobile" ] && cp -r lhci-reports-mobile reports/
    [ -d "memory-leak-results" ] && cp -r memory-leak-results reports/
    [ -d "src/test/load/results" ] && cp -r src/test/load/results reports/load-results
    [ -f "coverage/lcov.info" ] && cp coverage/lcov.info reports/
    [ -f "test-results.json" ] && cp test-results.json reports/
    
    log_success "All test reports generated and collected"
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
        "compose")
            run_compose_with_host_daemon "$2" "$3"
            ;;
        "install-project-deps")
            install_project_deps
            ;;
        "test-lighthouse-desktop")
            test_lighthouse_desktop
            ;;
        "test-lighthouse-mobile")
            test_lighthouse_mobile
            ;;
        "test-memory-leak")
            test_memory_leak
            ;;
        "test-e2e")
            test_e2e
            ;;
        "test-visual")
            test_visual
            ;;
        "test-visual-ui")
            test_visual_ui
            ;;
        "test-visual-update")
            test_visual_update
            ;;
        "test-load")
            test_load
            ;;
        "help"|*)
            echo "Usage: $0 {setup-dind|install-deps|setup-nodejs|test-unit|test-mutation|lint|reports|compose|full-setup|install-project-deps|test-lighthouse-desktop|test-lighthouse-mobile|test-memory-leak|test-e2e|test-visual|test-visual-ui|test-visual-update|test-load}"
            echo ""
            echo "Commands:"
            echo "  setup-dind         - Setup Docker using host daemon (best practice)"
            echo "  install-deps       - Install system dependencies"
            echo "  setup-nodejs       - Setup Node.js and pnpm"
            echo "  test-unit          - Run unit tests in CI mode"
            echo "  test-mutation      - Run mutation tests in CI mode"
            echo "  lint               - Run all linting checks"
            echo "  reports            - Generate and collect test reports"
            echo "  compose <files> <action> - Run Docker Compose with host daemon"
            echo "  full-setup         - Run complete CI environment setup"
            echo "  install-project-deps - Install project dependencies"
            echo "  test-lighthouse-desktop - Run Lighthouse Desktop audit"
            echo "  test-lighthouse-mobile - Run Lighthouse Mobile audit"
            echo "  test-memory-leak - Run Memory Leak tests"
            echo "  test-e2e - Run Playwright E2E tests"
            echo "  test-visual - Run Playwright Visual tests"
            echo "  test-visual-ui - Run Playwright Visual tests with UI"
            echo "  test-visual-update - Update Playwright Visual snapshots"
            echo "  test-load - Run K6 Load tests"
            echo ""
            echo "Docker Best Practices:"
            echo "  • Use host Docker daemon: -v /var/run/docker.sock:/var/run/docker.sock"
            echo "  • Custom networks for DNS: docker network create app-net"
            echo "  • Example: $0 compose '-f docker-compose.yml' 'up -d'"
            ;;
    esac
}

main "$@" 