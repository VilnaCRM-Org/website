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
    echo "🎭 Running E2E tests using Makefile approach"

    echo "🚀 Starting production services..."
    make start-prod

    echo "🎭 Running E2E tests..."
    if make test-e2e; then
        echo "✅ E2E tests PASSED"
    else
        echo "❌ E2E tests FAILED"
        docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" logs --tail=30 playwright || true
        exit 1
    fi

    echo "📂 Collecting E2E artifacts..."
    mkdir -p artifacts/app
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp playwright:/app/. artifacts/app/ 2>/dev/null || echo "No /app artifacts to copy"

    mkdir -p playwright-report test-results
    if [ -d artifacts/app/playwright-report ]; then
        cp -a artifacts/app/playwright-report/. playwright-report/ || true
    else
        echo "No playwright-report to copy"
    fi
    if [ -d artifacts/app/test-results ]; then
        cp -a artifacts/app/test-results/. test-results/ || true
    else
        echo "No test-results to copy"
    fi

    echo "🎉 E2E tests completed successfully!"
}

run_visual_tests_dind() {
    echo "🎨 Running Visual tests using Makefile approach"
    echo "🚀 Starting production services..."
    make start-prod
    echo "🎨 Running Visual tests..."
    if make test-visual; then
        echo "✅ Visual tests PASSED"
    else
        echo "❌ Visual tests FAILED"
        docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" logs --tail=30 playwright || true
        exit 1
    fi
    echo "📂 Collecting Visual artifacts..."
    mkdir -p artifacts/app
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp playwright:/app/. artifacts/app/ 2>/dev/null || echo "No /app artifacts to copy"
    mkdir -p playwright-report test-results
    if [ -d artifacts/app/playwright-report ]; then
        cp -a artifacts/app/playwright-report/. playwright-report/ || true
    else
        echo "No playwright-report to copy"
    fi
    if [ -d artifacts/app/test-results ]; then
        cp -a artifacts/app/test-results/. test-results/ || true
    else
        echo "No test-results to copy"
    fi
    echo "🎉 Visual tests completed successfully!"
}

run_load_tests_dind() {
    echo "⚡ Running Load tests using Makefile approach"

    echo "🚀 Starting production services..."
    make start-prod

    echo "⚡ Running Load tests..."
    if make load-tests; then
        echo "✅ Load tests PASSED"
        test_exit=0
    else
        echo "❌ Load tests FAILED"
        test_exit=1
        docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load logs --tail=30 k6 || true
    fi

    echo "📦 Collecting artifacts from k6 container..."
    mkdir -p artifacts/app artifacts/loadTests src/test/load/reports

    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load cp k6:/app/. artifacts/app/ 2>/dev/null; then
        echo "🗂 Copied k6:/app to artifacts/app"
        if [ -d artifacts/app/loadTests/results ]; then
            cp -a artifacts/app/loadTests/results/. src/test/load/reports/ 2>/dev/null || true
        fi
    elif docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load cp k6:/loadTests/. artifacts/loadTests/ 2>/dev/null; then
        echo "🗂 Copied k6:/loadTests to artifacts/loadTests"
        if [ -d artifacts/loadTests/results ]; then
            cp -a artifacts/loadTests/results/. src/test/load/reports/ 2>/dev/null || true
        fi
    else
        echo "ℹ️ No artifacts directory found in k6 container" >&2
    fi

    if [ "${test_exit}" -ne 0 ]; then
        exit "${test_exit}"
    fi

    echo "🎉 Load tests completed successfully!"
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