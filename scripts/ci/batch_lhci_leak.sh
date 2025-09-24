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
    echo "🔦 Running Lighthouse Desktop tests using Makefile approach"

    # Set DIND-specific environment variables
    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"

    # Resolve target URL depending on DinD or not (DinD -> localhost)
    if [ "${DIND_MODE}" = "1" ]; then
        export NEXT_PUBLIC_PROD_HOST_API_URL="http://localhost:${NEXT_PUBLIC_PROD_PORT}"
    else
        export NEXT_PUBLIC_PROD_HOST_API_URL="http://website-prod:${NEXT_PUBLIC_PROD_PORT}"
    fi

    # Optional headers used by LHCI config; safe defaults for local runs
    export NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=${NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME:-no-aws-header-name}
    export NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=${NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE:-no-aws-header-value}

    # Ensure dependencies are installed via Makefile (CI-aware)
    echo "📦 Installing dependencies..."
    CI=1 make install

    # Install Chromium only if missing (DinD-friendly, non-interactive)
    if ! command -v chromium-browser >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1; then
        echo "📦 Installing Chromium (DinD)..."
        if command -v apk >/dev/null 2>&1; then
            apk add --no-cache chromium chromium-chromedriver || true
        fi
    fi

    # Start production services via Makefile (handles network + health)
    echo "🚀 Starting production services..."
    make start-prod

    # LHCI configuration via env vars for Chrome path/flags in DinD
    export LHCI_COLLECT__CHROME_PATH="/usr/bin/chromium-browser"
    export LHCI_COLLECT__CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-software-rasterizer --disable-setuid-sandbox --single-process --no-zygote --js-flags=--max-old-space-size=4096"

    # Run Lighthouse via Makefile target
    echo "🚀 Running lighthouse desktop tests with DinD configuration..."
    if CI=1 make lighthouse-desktop; then
        echo "✅ Lighthouse desktop tests PASSED"
    else
        echo "❌ Lighthouse desktop tests FAILED"
        exit 1
    fi

    # Ensure artifacts directory exists (reports are written by LHCI)
    echo "📂 Ensuring lighthouse desktop reports directory exists..."
    mkdir -p lhci-reports-desktop

    echo "🎉 Lighthouse desktop tests completed successfully!"
}

run_lighthouse_mobile_dind() {
    echo "📱 Running Lighthouse Mobile tests using Makefile approach"
    
    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"
    if [ "${DIND_MODE}" = "1" ]; then
        export NEXT_PUBLIC_PROD_HOST_API_URL="http://localhost:${NEXT_PUBLIC_PROD_PORT}"
    else
        export NEXT_PUBLIC_PROD_HOST_API_URL="http://website-prod:${NEXT_PUBLIC_PROD_PORT}"
    fi

    echo "📦 Installing dependencies via Make (CI-aware)..."
    CI=1 make install

    # Install Chromium only if missing (DinD, non-interactive)
    if ! command -v chromium-browser >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1; then
        echo "📦 Installing Chromium (DinD)..."
        apk add --no-cache chromium chromium-chromedriver
    fi

    # LHCI environment overrides for DinD Chrome path/flags
    export LHCI_COLLECT__CHROME_PATH="/usr/bin/chromium-browser"
    export LHCI_COLLECT__CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-software-rasterizer --disable-setuid-sandbox --single-process --no-zygote --js-flags=--max-old-space-size=4096"

    echo "🚀 Starting production services..."
    make start-prod
    make wait-for-prod

    # Ensure artifacts directory exists; LHCI will write into it
    mkdir -p lhci-reports-mobile

    echo "🚀 Running Lighthouse mobile tests (via Make)..."
    if CI=1 make lighthouse-mobile; then
        echo "✅ Lighthouse mobile tests PASSED"
    else
        echo "❌ Lighthouse mobile tests FAILED"
        exit 1
    fi

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