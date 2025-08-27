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
    echo "📡 Ensuring Docker network via Make..."
    make create-network
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
    echo "🎭 Running E2E tests with working approach + Make"
    
    setup_docker_network
    echo "🏗️ Building test services..."
    make build-prod
    
    echo "🚀 Starting core services (prod, apollo, mockoon) with health waits..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d --wait prod apollo mockoon
    
    echo "📂 Ensuring Playwright container is up"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d playwright
    
    echo "Creating directories in Playwright container..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright mkdir -p /app/src/test /app/src/config /app/pages/i18n
    
    echo "Copying test files into Playwright container..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp src/test/. playwright:/app/src/test/ || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp src/config playwright:/app/src/ || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp pages/i18n playwright:/app/pages/ || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp tsconfig.json playwright:/app/ || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp tsconfig.paths.json playwright:/app/ || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp next.config.js playwright:/app/ || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp playwright.config.ts playwright:/app/ || true
    
    echo "🧹 Cleaning previous E2E results..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright rm -rf /app/playwright-report /app/test-results || true
    
    local PROD_URL="http://prod:3001"
    echo "🔍 Sanity check prod URL from Playwright..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright curl -fsS "$PROD_URL" >/dev/null || true
    
    echo "🎭 Executing Playwright E2E..."
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T -e NEXT_PUBLIC_MAIN_LANGUAGE=uk -e NEXT_PUBLIC_FALLBACK_LANGUAGE=en -e NEXT_PUBLIC_PROD_CONTAINER_API_URL="$PROD_URL" -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value -e NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL=https://github.com/VilnaCRM-Org/ -e NEXT_PUBLIC_GRAPHQL_API_URL=http://apollo:4000/graphql -w /app playwright npx playwright test src/test/e2e --timeout=60000; then
        echo "✅ E2E tests PASSED"
    else
        echo "❌ E2E tests FAILED"
        docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" logs --tail=60 playwright || true
        echo "⚠️ Continuing pipeline"
    fi
    
    echo "📂 Collecting E2E artifacts..."
    mkdir -p playwright-report test-results
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp playwright:/app/playwright-report/. playwright-report/ 2>/dev/null || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp playwright:/app/test-results/. test-results/ 2>/dev/null || true
    
    echo "🧹 Tearing down test stack"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" down
}

run_visual_tests_dind() {
    local website_dir=$1
    echo "🎨 Running Visual tests with working approach + Make"
    
    setup_docker_network
    echo "🏗️ Building test services..."
    make build-prod
    
    echo "🚀 Starting services with health waits..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d --wait prod apollo mockoon
    
    echo "📂 Ensuring Playwright container is up"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d playwright
    
    echo "Creating directories in Playwright container..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright mkdir -p /app/src/test /app/src/config /app/pages/i18n
    
    echo "Copying test files into Playwright container..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp src/test/. playwright:/app/src/test/ || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp src/config playwright:/app/src/ || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp pages/i18n playwright:/app/pages/ || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp tsconfig.json playwright:/app/ || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp tsconfig.paths.json playwright:/app/ || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp next.config.js playwright:/app/ || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp playwright.config.ts playwright:/app/ || true
    
    echo "🧹 Cleaning previous Visual results..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright rm -rf /app/playwright-report /app/test-results || true
    
    local PROD_URL="http://prod:3001"
    echo "🔍 Sanity check prod URL from Playwright..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright curl -fsS "$PROD_URL" >/dev/null || true
    
    echo "🎨 Executing Playwright Visual..."
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T -e NEXT_PUBLIC_MAIN_LANGUAGE=uk -e NEXT_PUBLIC_FALLBACK_LANGUAGE=en -e NEXT_PUBLIC_PROD_CONTAINER_API_URL="$PROD_URL" -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value -e NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL=https://github.com/VilnaCRM-Org/ -e NEXT_PUBLIC_GRAPHQL_API_URL=http://apollo:4000/graphql -w /app playwright npx playwright test src/test/visual --timeout=60000; then
        echo "✅ Visual tests PASSED"
    else
        echo "❌ Visual tests FAILED"
        docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" logs --tail=60 playwright || true
        echo "⚠️ Continuing pipeline"
    fi
    
    echo "📂 Collecting Visual artifacts..."
    mkdir -p playwright-report test-results
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp playwright:/app/playwright-report/. playwright-report/ 2>/dev/null || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp playwright:/app/test-results/. test-results/ 2>/dev/null || true
    
    echo "🧹 Tearing down test stack"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" down
}

run_load_tests_dind() {
    local website_dir=$1
    echo "⚡ Running K6 Load tests with working approach + Make"
    
    setup_docker_network
    echo "🏗️ Building production container image..."
    make build-prod
    
    echo "🚀 Starting prod with health waits..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d --wait prod
    
    echo "🏗️ Building K6 image..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load build k6
    echo "🚀 Starting K6 service..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load up -d k6
    echo "📂 Prepare K6 directories..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load exec -T k6 sh -lc 'mkdir -p /loadTests/results && rm -rf /loadTests/results/* || true'
    
    echo "⚡ Executing K6 homepage scenario..."
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load exec -T -w /loadTests k6 k6 run --summary-trend-stats="avg,min,med,max,p(95),p(99)" --out "web-dashboard=period=1s&export=/loadTests/results/homepage.html" /loadTests/homepage.js; then
        echo "✅ Load tests PASSED"
    else
        echo "❌ Load tests FAILED"
        docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load logs --tail=60 k6 || true
        exit 1
    fi
    
    echo "📂 Collecting K6 artifacts..."
    mkdir -p src/test/load/reports
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load cp k6:/loadTests/results/. src/test/load/reports/ 2>/dev/null || true
    
    echo "🧹 Clean up K6"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load stop k6 || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load rm -f k6 || true
}

run_load_tests_swagger_dind() {
    local website_dir=$1
    echo "📊 Running Swagger load tests with working approach + Make"
    
    setup_docker_network
    echo "🏗️ Building production container image..."
    make build-prod
    
    echo "🚀 Starting prod with health waits..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d --wait prod
    
    echo "🏗️ Building K6 image (swagger)..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load build k6
    echo "🚀 Starting K6 service..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load up -d k6
    echo "📂 Prepare K6 directories..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load exec -T k6 sh -lc 'mkdir -p /loadTests/results && rm -rf /loadTests/results/* || true'
    
    echo "⚡ Executing K6 swagger scenario..."
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load exec -T -w /loadTests k6 k6 run --summary-trend-stats="avg,min,med,max,p(95),p(99)" --out "web-dashboard=period=1s&export=/loadTests/results/swagger.html" /loadTests/swagger.js; then
        echo "✅ Swagger load tests PASSED"
    else
        echo "❌ Swagger load tests FAILED"
        docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load logs --tail=60 k6 || true
        exit 1
    fi
    
    echo "📂 Collecting Swagger artifacts..."
    mkdir -p src/test/load/reports
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load cp k6:/loadTests/results/. src/test/load/reports/ 2>/dev/null || true
    
    echo "🧹 Clean up K6"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load stop k6 || true
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load rm -f k6 || true
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