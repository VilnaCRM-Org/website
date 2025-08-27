#!/bin/bash

set -euo pipefail

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
    echo "📡 Using compose-managed network"
}

start_prod_dind() {
    echo "🐳 Starting production via Make"
    make start-prod
}

run_memory_leak_tests_dind() {
    local website_dir=$1
    echo "🧠 Running Memory Leak tests via Make"
    if cd "$website_dir" && make test-memory-leak CI=0; then
        echo "✅ Memory leak tests PASSED"
    else
        echo "❌ Memory leak tests FAILED"
        exit 1
    fi
}

run_lighthouse_desktop_dind() {
    local website_dir=$1
    echo "🔦 Running Lighthouse Desktop via Make"
    if cd "$website_dir" && make lighthouse-desktop CI=0; then
        echo "✅ Lighthouse desktop tests completed"
    else
        echo "❌ Lighthouse desktop tests failed"
        exit 1
    fi
}

run_lighthouse_mobile_dind() {
    local website_dir=$1
    echo "📱 Running Lighthouse Mobile via Make"
    if cd "$website_dir" && make lighthouse-mobile CI=0; then
        echo "✅ Lighthouse mobile tests completed"
    else
        echo "❌ Lighthouse mobile tests failed"
        exit 1
    fi
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
        run_memory_leak_tests_dind "."
        ;;
    test-lighthouse-desktop)
        run_lighthouse_desktop_dind "."
        ;;
    test-lighthouse-mobile)
        run_lighthouse_mobile_dind "."
        ;;
    all|*)
        main "$@"
        ;;
esac