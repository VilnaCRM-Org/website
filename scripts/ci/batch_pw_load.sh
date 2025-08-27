#!/bin/bash

set -euo pipefail

NETWORK_NAME=${NETWORK_NAME:-"website-network"}
WEBSITE_DOMAIN=${WEBSITE_DOMAIN:-"localhost"}
DEV_PORT=${DEV_PORT:-"3000"}
NEXT_PUBLIC_PROD_PORT=${NEXT_PUBLIC_PROD_PORT:-"3001"}
PLAYWRIGHT_TEST_PORT=${PLAYWRIGHT_TEST_PORT:-"9323"}
UI_HOST=${UI_HOST:-"0.0.0.0"}
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

start_prod_dind() {
    echo "🐳 Starting production environment in true Docker-in-Docker mode"
    echo "Building production container image..."
    make build-prod
    echo "🚀 Starting production services..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d --wait prod
    echo "🎉 Production environment started successfully!"
}

run_make_with_prod_dind() {
    local target=$1
    local description=$2
    local website_dir=$3
    echo "🚀 Running: $description via Make"
    if cd "$website_dir" && make "$target" CI=0; then
        echo "✅ $description completed successfully"
    else
        echo "❌ $description failed"
        exit 1
    fi
}

run_e2e_tests_dind() {
    local website_dir=$1
    echo "🎭 Running E2E tests via Make"
    if cd "$website_dir" && make test-e2e CI=0; then
        echo "✅ E2E tests PASSED"
    else
        echo "❌ E2E tests FAILED"
        exit 1
    fi
}

run_visual_tests_dind() {
    local website_dir=$1
    echo "🎨 Running Visual tests via Make"
    if cd "$website_dir" && make test-visual CI=0; then
        echo "✅ Visual tests PASSED"
    else
        echo "❌ Visual tests FAILED"
        exit 1
    fi
}

run_load_tests_dind() {
    local website_dir=$1
    echo "⚡ Running K6 Load tests via Make"
    if cd "$website_dir" && make load-tests CI=0; then
        echo "✅ Load tests PASSED"
    else
        echo "❌ Load tests FAILED"
        exit 1
    fi
}

run_load_tests_swagger_dind() {
    local website_dir=$1
    echo "📊 Running Swagger load tests via Make"
    if cd "$website_dir" && make load-tests-swagger CI=0; then
        echo "✅ Swagger load tests PASSED"
    else
        echo "❌ Swagger load tests FAILED"
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

    # Run sequentially; rely on set -e to stop on failure
    run_e2e_tests_dind "$website_dir"
    run_visual_tests_dind "$website_dir"
    run_load_tests_dind "$website_dir"
    run_load_tests_swagger_dind "$website_dir"
}

case "${1:-all}" in
    test-e2e)
        run_e2e_tests_dind "."
        ;;
    test-visual)
        run_visual_tests_dind "."
        ;;
    test-load)
        run_load_tests_dind "."
        ;;
    test-load-swagger)
        run_load_tests_swagger_dind "."
        ;;
    all|*)
        main "$@"
        ;;
esac