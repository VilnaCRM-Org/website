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

    echo "🚀 Starting production services..."
    make start-prod

    export NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name
    export NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value

    echo "🧠 Running memory leak tests..."
    if make test-memory-leak; then
        echo "✅ Memory leak tests PASSED" 
    else
        echo "❌ Memory leak tests FAILED"
        docker compose -f docker-compose.memory-leak.yml logs --tail=30 memory-leak || true
        exit 1
    fi

    echo "📂 Copying memory leak test results..."
    mkdir -p memory-leak-logs
    docker compose -f docker-compose.memory-leak.yml cp memory-leak:/app/src/test/memory-leak/results/. memory-leak-logs/ 2>/dev/null || echo "No memory leak results to copy"
    docker compose -f docker-compose.memory-leak.yml logs memory-leak > memory-leak-logs/test-execution.log 2>&1 || true

    echo "🎉 Memory leak tests completed successfully in true DinD mode!"
}

run_lighthouse_desktop_dind() {
    echo "🔦 Running Lighthouse Desktop tests using robust container approach"

    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network

    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"

    echo "🚀 Starting production services with DIND configuration..."
    make start-prod

    echo "📦 Installing Chrome and Lighthouse CLI in prod container..."
    make install-chromium-lhci

    echo "📂 Copying Lighthouse config files to prod container..."
    docker compose -f "$DOCKER_COMPOSE_TEST_FILE" cp lighthouserc.desktop.js prod:/app/

    echo "🧪 Testing Chrome installation..."
    make test-chromium

    echo "🔦 Running Lighthouse desktop tests..."
    make lighthouse-desktop-dind

    echo "📂 Copying lighthouse results from prod container..."
    mkdir -p lhci-reports-desktop
    docker compose -f "$DOCKER_COMPOSE_TEST_FILE" cp prod:/app/lhci-reports-desktop/. lhci-reports-desktop/ 2>/dev/null || echo "No lighthouse results to copy"
}

run_lighthouse_mobile_dind() {
    echo "📱 Running Lighthouse Mobile tests using robust container approach"

    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network

    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"

    echo "🚀 Starting production services with DIND configuration..."
    make start-prod

    echo "📦 Installing Chrome and Lighthouse CLI in prod container..."
    make install-chromium-lhci

    echo "📂 Copying Lighthouse config files to prod container..."
    docker compose -f "$DOCKER_COMPOSE_TEST_FILE" cp lighthouserc.mobile.js prod:/app/

    echo "🧪 Testing Chrome installation..."
    make test-chromium

    echo "📱 Running Lighthouse mobile tests..."
    make lighthouse-mobile-dind    
    
    echo "📂 Copying lighthouse results from prod container..."
    mkdir -p lhci-reports-mobile
    docker compose -f "$DOCKER_COMPOSE_TEST_FILE" cp prod:/app/lhci-reports-mobile/. lhci-reports-mobile/ 2>/dev/null || echo "No lighthouse results to copy"
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