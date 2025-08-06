#!/bin/bash

set -euo pipefail

NETWORK_NAME=${NETWORK_NAME:-"website-network"}
WEBSITE_DOMAIN=${WEBSITE_DOMAIN:-"localhost"}
NEXT_PUBLIC_PROD_PORT=${NEXT_PUBLIC_PROD_PORT:-"3001"}
PROD_CONTAINER_NAME=${PROD_CONTAINER_NAME:-"website-prod"}
PLAYWRIGHT_CONTAINER_NAME=${PLAYWRIGHT_CONTAINER_NAME:-"website-playwright"}

DOCKER_COMPOSE_DEV_FILE=${DOCKER_COMPOSE_DEV_FILE:-"docker-compose.yml"}
DOCKER_COMPOSE_TEST_FILE=${DOCKER_COMPOSE_TEST_FILE:-"docker-compose.test.yml"}
COMMON_HEALTHCHECKS_FILE=${COMMON_HEALTHCHECKS_FILE:-"common-healthchecks.yml"}

if [ ! -f "common-healthchecks.yml" ]; then
    COMMON_HEALTHCHECKS_FILE=""
fi

echo "🐳 DIND Environment Setup Script"
echo "================================"



setup_docker_network() {
    echo "📡 Setting up Docker network..."
    docker network create "$NETWORK_NAME" 2>/dev/null || echo "Network $NETWORK_NAME already exists"
    echo "✅ Docker network configured"
}

test_container_connectivity() {
    echo "🔍 Enhanced container connectivity testing..."
    PROD_IP=$(docker inspect "$PROD_CONTAINER_NAME" --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "")
    if [ -n "$PROD_IP" ]; then
        echo "✅ Production container IP: $PROD_IP"
    else
        echo "⚠️  Could not get production container IP"
        return 1
    fi
    
    echo "🔍 Testing DNS resolution..."
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" nslookup $PROD_CONTAINER_NAME >/dev/null 2>&1 || echo "⚠️  DNS lookup failed for $PROD_CONTAINER_NAME"
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" nslookup apollo >/dev/null 2>&1 || echo "⚠️  DNS lookup failed for apollo"
    
    echo "🔍 Testing ping connectivity..."
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" ping -c 2 $PROD_CONTAINER_NAME >/dev/null 2>&1 || echo "⚠️  Ping failed for $PROD_CONTAINER_NAME"
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" ping -c 2 apollo >/dev/null 2>&1 || echo "⚠️  Ping failed for apollo"
    
    echo "🔍 Testing HTTP connectivity..."
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" curl -f http://$PROD_CONTAINER_NAME:3001 >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for $PROD_CONTAINER_NAME:3001"
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" curl -f "http://$PROD_IP:3001" >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for $PROD_IP:3001"
    docker exec "$PLAYWRIGHT_CONTAINER_NAME" curl -f http://apollo:4000/graphql >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for apollo:4000/graphql"
    
    echo "✅ Container connectivity testing completed"
}

start_prod_dind() {
    echo "🐳 Starting production environment in true Docker-in-Docker mode"
    echo "Building production container image..."
    make build-prod
    echo "🚀 Starting production services..."
    make start-prod
    echo "🎉 Production environment started successfully!"
}

run_make_with_prod_dind() {
    local target=$1
    local description=$2
    local website_dir=$3
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    
    echo "🚀 Starting production environment for $description"
    start_prod_dind
    
    export DIND=1
    echo "🚀 Running: $description"
    echo "[INFO] Target: $target"
    echo "[INFO] Website directory: $website_dir"
    echo "[INFO] Makefile path: $website_dir/Makefile"
    
    if cd "$website_dir" && make "$target" CI=0; then
        echo "✅ $description completed successfully"
    else
        echo "❌ $description failed"
        exit 1
    fi
}

run_memory_leak_tests_dind() {
    local website_dir=$1
    echo "🧠 Running Memory Leak tests using Makefile approach"
    run_make_with_prod_dind "test-memory-leak" "Memory leak tests" "$website_dir"
}

run_lighthouse_desktop_dind() {
    local website_dir=$1
    echo "🔦 Running Lighthouse Desktop tests using Makefile approach"
    run_make_with_prod_dind "lighthouse-desktop" "Lighthouse desktop tests" "$website_dir"
}

run_lighthouse_mobile_dind() {
    local website_dir=$1
    echo "📱 Running Lighthouse Mobile tests using Makefile approach"
    run_make_with_prod_dind "lighthouse-mobile" "Lighthouse mobile tests" "$website_dir"
}

main() {
    local website_dir="${1:-.}"
    
    if [ ! -d "$website_dir" ]; then
        echo "❌ Website directory not found: $website_dir"
        exit 1
    fi
    
    echo "📁 Working directory: $(pwd)"
    echo "🌐 Website directory: $website_dir"
    
    if run_memory_leak_tests_dind "$website_dir"; then
        echo "✅ Memory leak tests completed successfully in DIND mode!"
    else
        echo "❌ Memory leak tests failed in DIND mode"
        exit 1
    fi
    
    if run_lighthouse_desktop_dind "$website_dir"; then
        echo "✅ Lighthouse desktop tests completed successfully in DIND mode!"
    else
        echo "❌ Lighthouse desktop tests failed in DIND mode"
        exit 1
    fi
    
    if run_lighthouse_mobile_dind "$website_dir"; then
        echo "✅ Lighthouse mobile tests completed successfully in DIND mode!"
    else
        echo "❌ Lighthouse mobile tests failed in DIND mode"
        exit 1
    fi
    
    echo "🎉 All Lighthouse and memory leak tests completed successfully!"
}

show_usage() {
    echo "Usage: $0 [COMMAND|WEBSITE_DIR]"
    echo ""
    echo "Commands (for backward compatibility):"
    echo "  test-memory-leak       Run memory leak tests only"
    echo "  test-lighthouse-desktop Run Lighthouse desktop tests only"
    echo "  test-lighthouse-mobile Run Lighthouse mobile tests only"
    echo ""
    echo "Arguments:"
    echo "  WEBSITE_DIR            Website directory path (default: current directory)"
    echo ""
    echo "This script runs Lighthouse and memory leak tests in Docker-in-Docker mode"
    echo "using the working Docker setup approach."
    echo ""
    echo "Examples:"
    echo "  $0 test-memory-leak"
    echo "  $0 ."
    echo "  $0 /path/to/website"
    echo ""
    echo "Environment Variables:"
    echo "  NETWORK_NAME           Docker network name (default: website-network)"
    echo "  WEBSITE_DOMAIN         Website domain (default: localhost)"
    echo "  NEXT_PUBLIC_PROD_PORT  Production port (default: 3001)"
    echo "  PROD_CONTAINER_NAME    Production container name (default: $PROD_CONTAINER_NAME)"
}

case "${1:-help}" in
    help|--help|-h)
        show_usage
        exit 0
        ;;
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