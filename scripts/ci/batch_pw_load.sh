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

# Ensure required compose env vars have sane defaults for healthchecks
NEXT_PUBLIC_MOCKOON_PORT=${NEXT_PUBLIC_MOCKOON_PORT:-"8080"}
GRAPHQL_PORT=${GRAPHQL_PORT:-"4000"}
GRAPHQL_API_PATH=${GRAPHQL_API_PATH:-"graphql"}
export NEXT_PUBLIC_MOCKOON_PORT GRAPHQL_PORT GRAPHQL_API_PATH NEXT_PUBLIC_PROD_PORT

echo "🐳 DIND Environment Setup Script"
echo "================================"

PLAYWRIGHT_ENV_FLAGS="\
    -e NEXT_PUBLIC_MAIN_LANGUAGE=uk \
    -e NEXT_PUBLIC_FALLBACK_LANGUAGE=en \
    -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name \
    -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value \
    -e NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL=https://github.com/VilnaCRM-Org/ \
    -e NEXT_PUBLIC_GRAPHQL_API_URL=http://apollo:4000/graphql"

setup_docker_network() {
    echo "📡 Setting up Docker network..."
    docker network create "$NETWORK_NAME" 2>/dev/null || echo "Network $NETWORK_NAME already exists"
    echo "✅ Docker network configured"
}

start_prod_dind() {
    echo "🐳 Starting production environment in true Docker-in-Docker mode"
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
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

run_e2e_tests_dind() {
    echo "🎭 Running E2E tests in DIND mode (matching local behavior)"

    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
      
    echo "🚀 Starting production services and waiting for readiness..."
    make start-prod

    echo "📂 Copying all project files to Playwright container..."
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "." "playwright:/app/"; then
        echo "✅ All project files copied successfully"
    else
        echo "❌ Failed to copy project files"
        exit 1
    fi

    echo "🎭 Running Playwright E2E tests with service-based connectivity..."
    PROD_URL="http://prod:3001"
    echo "🔍 Running E2E tests..."
    make test-e2e

    echo "📂 Copying E2E test results..."
    mkdir -p playwright-report test-results
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "playwright:/app/playwright-report/." "playwright-report/" 2>/dev/null || echo "No playwright-report to copy"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "playwright:/app/test-results/." "test-results/" 2>/dev/null || echo "No test-results to copy"

}

run_visual_tests_dind() {
    echo "🎨 Running Visual tests in DIND mode (matching local behavior)"

    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network

    echo "🚀 Starting production services..."
    make start-prod

    echo "Creating directories in container..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright mkdir -p /app/src/test /app/src/config /app/pages/i18n

    echo "📂 Copying all project files to Playwright container..."
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "." "playwright:/app/"; then
        echo "✅ All project files copied successfully"
    else
        echo "❌ Failed to copy project files"
        exit 1
    fi

    echo "🎨 Running Playwright Visual tests with service-based connectivity..."
    PROD_URL="http://prod:3001"
    echo "🔍 Running Visual tests..."
    make test-visual

    echo "📂 Copying Visual test results..."
    mkdir -p playwright-report test-results
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "playwright:/app/playwright-report/." "playwright-report/" 2>/dev/null || echo "No playwright-report to copy"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "playwright:/app/test-results/." "test-results/" 2>/dev/null || echo "No test-results to copy"

    echo "🎉 Visual tests completed successfully in DIND mode!"
}

run_load_tests_dind() {
    echo "⚡ Running K6 Load tests in true Docker-in-Docker mode"
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network

    echo "🚀 Starting production services..."
    make start-prod

    make build-k6

    echo "⚡ Starting K6 helper container..."
    k6_helper_container="website-k6-helper"
    make create-k6-helper-container-dind K6_HELPER_NAME="$k6_helper_container"

    echo "📂 Preparing K6 directories..."
    docker exec "$k6_helper_container" mkdir -p /loadTests/results
    echo "📂 Copying K6 test files..."
    docker cp "src/test/load/." "$k6_helper_container:/loadTests/"
    echo "✅ Load test files copied successfully"

    if make run-load-tests-dind K6_HELPER_NAME="$k6_helper_container"; then
        echo "✅ Load tests PASSED"
    else
        echo "❌ Load tests FAILED"
        exit 1
    fi

    echo "📂 Copying load test results..."
    mkdir -p src/test/load/reports
    docker cp "$k6_helper_container:/loadTests/results/." "src/test/load/reports/" 2>/dev/null || echo "No load test results to copy"

    echo "🎉 Load tests completed successfully in true DinD mode!"
}

main() {
    local website_dir="${1:-.}"
    
    if [ ! -d "$website_dir" ]; then
        echo "❌ Website directory not found: $website_dir"
        exit 1
    fi
    
    echo "📁 Working directory: $(pwd)"
    echo "🌐 Website directory: $website_dir"

    run_e2e_tests_dind "$website_dir"
    run_visual_tests_dind "$website_dir"
    run_load_tests_dind "$website_dir"
}

case "${1:-all}" in
    test-e2e)
        echo "🧪 Running E2E tests only..."
        run_e2e_tests_dind "."
        ;;
    test-visual)
        echo "🎨 Running visual tests only..."
        run_visual_tests_dind "."
        ;;
    test-load)
        echo "📊 Running load tests only..."
        run_load_tests_dind "."
        ;;
    *)
        main "$@"
        ;;
esac