#!/bin/bash
set -e
NETWORK_NAME=${NETWORK_NAME:-"website-network"}
WEBSITE_DOMAIN=${WEBSITE_DOMAIN:-"localhost"}
DEV_PORT=${DEV_PORT:-"3000"}
NEXT_PUBLIC_PROD_PORT=${NEXT_PUBLIC_PROD_PORT:-"3001"}
PLAYWRIGHT_TEST_PORT=${PLAYWRIGHT_TEST_PORT:-"9323"}
UI_HOST=${UI_HOST:-"0.0.0.0"}
PROD_CONTAINER_NAME=${PROD_CONTAINER_NAME:-"website-prod"}
DOCKER_COMPOSE_DEV_FILE=${DOCKER_COMPOSE_DEV_FILE:-"docker-compose.yml"}
DOCKER_COMPOSE_TEST_FILE=${DOCKER_COMPOSE_TEST_FILE:-"docker-compose.test.yml"}
COMMON_HEALTHCHECKS_FILE=${COMMON_HEALTHCHECKS_FILE:-"common-healthchecks.yml"}
echo "🐳 DIND Environment Setup Script"
echo "================================"
setup_docker_network() {
    echo "📡 Setting up Docker network..."
    docker network create "$NETWORK_NAME" 2>/dev/null || echo "Network $NETWORK_NAME already exists"
    echo "✅ Docker network configured"
}
run_memory_leak_tests_dind() {
    echo "🧠 Running Memory Leak tests using Makefile approach"
    
    # Use Makefile target to start production services with network setup
    echo "🚀 Starting production services..."
    make start-prod
    
    # Set environment variables for the memory leak tests
    export NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name
    export NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value
    
    # Use Makefile target for complete memory leak testing workflow
    echo "🧠 Running memory leak tests..."
    if make test-memory-leak; then
        echo "✅ Memory leak tests PASSED" 
    else
        echo "❌ Memory leak tests FAILED"
        docker compose -f docker-compose.memory-leak.yml logs --tail=30 memory-leak || true
        exit 1
    fi

    # Copy results to memory-leak-logs directory for CI artifacts
    echo "📂 Copying memory leak test results..."
    mkdir -p memory-leak-logs
    docker compose -f docker-compose.memory-leak.yml cp memory-leak:/app/src/test/memory-leak/results/. memory-leak-logs/ 2>/dev/null || echo "No memory leak results to copy"
    docker compose -f docker-compose.memory-leak.yml logs memory-leak > memory-leak-logs/test-execution.log 2>&1 || true

    echo "🎉 Memory leak tests completed successfully in true DinD mode!"
}

run_lighthouse_desktop_dind() {
    echo "🔦 Running Lighthouse Desktop tests using Makefile approach"
    
    # Set DIND-specific environment variables
    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"
    
    # Ensure dependencies are installed and lhci is available
    echo "📦 Installing dependencies..."
    pnpm install --frozen-lockfile
    
    # Install Chrome and Lighthouse CLI for DinD environment
    echo "📦 Installing Chrome and Lighthouse CLI..."
    apk add --no-cache chromium chromium-chromedriver
    npm install -g @lhci/cli@0.14.0
    
    # Set Chrome path for Lighthouse
    export CHROME_PATH=/usr/bin/chromium-browser
    
    # Use Makefile target for complete lighthouse desktop workflow
    echo "🚀 Running lighthouse desktop tests..."
    if make lighthouse-desktop; then
        echo "✅ Lighthouse desktop tests PASSED"
    else
        echo "❌ Lighthouse desktop tests FAILED"
        exit 1
    fi

    # Copy results to lhci-reports-desktop directory for CI artifacts
    echo "📂 Copying lighthouse desktop results..."
    mkdir -p lhci-reports-desktop
    cp -r lhci-reports-desktop/. lhci-reports-desktop/ 2>/dev/null || echo "No lighthouse results to copy"

    echo "🎉 Lighthouse desktop tests completed successfully!"
}

run_lighthouse_mobile_dind() {
    echo "📱 Running Lighthouse Mobile tests using Makefile approach"
    
    # Set DIND-specific environment variables
    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"
    
    # Ensure dependencies are installed and lhci is available
    echo "📦 Installing dependencies..."
    pnpm install --frozen-lockfile
    
    # Install Chrome and Lighthouse CLI for DinD environment
    echo "📦 Installing Chrome and Lighthouse CLI..."
    apk add --no-cache chromium chromium-chromedriver
    npm install -g @lhci/cli@0.14.0
    
    # Set Chrome path for Lighthouse
    export CHROME_PATH=/usr/bin/chromium-browser
    
    # Use Makefile target for complete lighthouse mobile workflow
    echo "🚀 Running lighthouse mobile tests..."
    if make lighthouse-mobile; then
        echo "✅ Lighthouse mobile tests PASSED"
    else
        echo "❌ Lighthouse mobile tests FAILED"
        exit 1
    fi

    # Copy results to lhci-reports-mobile directory for CI artifacts
    echo "📂 Copying lighthouse mobile results..."
    mkdir -p lhci-reports-mobile
    cp -r lhci-reports-mobile/. lhci-reports-mobile/ 2>/dev/null || echo "No lighthouse results to copy"

    echo "🎉 Lighthouse mobile tests completed successfully!"
}

main() {
    local website_dir="${1:-.}"
    
    if [ ! -d "$website_dir" ]; then
        echo "❌ Website directory not found: $website_dir"
        exit 1
    fi
    
    echo "📁 Working directory: $(pwd)"
    echo "🌐 Website directory: $website_dir"

    # Run sequentially; stop on first failure via set -e
    run_memory_leak_tests_dind "$website_dir"
    run_lighthouse_desktop_dind "$website_dir"
    run_lighthouse_mobile_dind "$website_dir"
}

case "${1:-all}" in
    test-memory-leak)
        echo "🧪 Running memory leak tests only..."
        run_memory_leak_tests_dind "."
        ;;
    test-lighthouse-desktop)
        echo "🔍 Running Lighthouse desktop tests only..."
        run_lighthouse_desktop_dind "."
        ;;
    test-lighthouse-mobile)
        echo "🔍 Running Lighthouse mobile tests only..."
        run_lighthouse_mobile_dind "."
        ;;
    *)
        main "$@"
        ;;
	esac 