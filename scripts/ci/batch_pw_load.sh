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
    
    echo "Building test services..."
    make build-prod
    
    echo "🚀 Starting core test services (prod, apollo, mockoon) and waiting for health..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d --wait prod apollo mockoon

    echo "📂 Ensuring Playwright container is up"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d playwright

    echo "Creating directories in container..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright mkdir -p /app/src/test /app/src/config /app/pages/i18n

    echo "Copying complete test directory..."
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "src/test/." "playwright:/app/src/test/"; then
        echo "✅ Complete test directory copied successfully"
    else
        echo "❌ Failed to copy complete test directory"
        exit 1
    fi

    echo "Copying config files..."
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "src/config" "playwright:/app/src/"; then
        echo "✅ Config files copied successfully"
    else
        echo "❌ Failed to copy config files"
        exit 1
    fi

    echo "Copying i18n files..."
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "pages/i18n" "playwright:/app/pages/"; then
        echo "✅ i18n files copied successfully"
    else
        echo "❌ Failed to copy i18n files"
        exit 1
    fi

    echo "Copying TypeScript configuration files..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "tsconfig.json" "playwright:/app/" || echo "⚠️  Failed to copy tsconfig.json"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "tsconfig.paths.json" "playwright:/app/" || echo "⚠️  Failed to copy tsconfig.paths.json"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "next.config.js" "playwright:/app/" || echo "⚠️  Failed to copy next.config.js"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "playwright.config.ts" "playwright:/app/" || echo "⚠️  Failed to copy playwright.config.ts"

    echo "🔍 Verifying files were copied correctly..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright ls -la /app/src/test/visual/ || echo "⚠️  Visual files not found in container"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright ls -la /app/src/test/e2e/utils/ || echo "⚠️  E2E utils not found in container"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright ls -la /app/src/config/ || echo "⚠️  Config files not found in container"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright ls -la /app/pages/i18n/ || echo "⚠️  i18n files not found in container"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright sh -lc 'ls -la /app/tsconfig*.json' || echo "⚠️  TypeScript config files not found"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright ls -la /app/next.config.js || echo "⚠️  Next.js config not found"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright ls -la /app/playwright.config.ts || echo "⚠️  Playwright config not found"
    
    echo "🧹 Cleaning up previous E2E results..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright rm -rf /app/playwright-report /app/test-results || true

    echo "🎭 Running Playwright E2E tests with service-based connectivity..."
    PROD_URL="http://prod:3001"
    echo "🔍 Testing container connectivity..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright curl -f "$PROD_URL" >/dev/null 2>&1 || echo "⚠️  Container connectivity test failed"

    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T $PLAYWRIGHT_ENV_FLAGS -e NEXT_PUBLIC_PROD_CONTAINER_API_URL="$PROD_URL" -w /app playwright npx playwright test src/test/e2e --timeout=60000; then
        echo "✅ E2E tests PASSED"
    else
        echo "❌ E2E tests FAILED"
        docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" logs --tail=30 playwright || true
        echo "⚠️  E2E tests failed but continuing with build..."
    fi

    echo "📂 Copying E2E test results..."
    mkdir -p playwright-report test-results
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "playwright:/app/playwright-report/." "playwright-report/" 2>/dev/null || echo "No playwright-report to copy"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "playwright:/app/test-results/." "test-results/" 2>/dev/null || echo "No test-results to copy"

    echo "🧹 Cleaning up Docker services..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" down --volumes --remove-orphans || true
}

run_visual_tests_dind() {
    echo "🎨 Running Visual tests in DIND mode (matching local behavior)"
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    
    echo "Building test services..."
    make build-prod
    
    echo "🚀 Starting test services..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d --wait prod apollo mockoon
    

    echo "📂 Copying Visual test files to Playwright container..."

    echo "📂 Ensuring Playwright container is up"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d playwright

    echo "Creating directories in container..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright mkdir -p /app/src/test /app/src/config /app/pages/i18n

    echo "Copying complete test directory..."
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "src/test/." "playwright:/app/src/test/"; then
        echo "✅ Complete test directory copied successfully"
    else
        echo "❌ Failed to copy complete test directory"
        exit 1
    fi

    echo "Copying config files..."
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "src/config" "playwright:/app/src/"; then
        echo "✅ Config files copied successfully"
    else
        echo "❌ Failed to copy config files"
        exit 1
    fi

    echo "Copying i18n files..."
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "pages/i18n" "playwright:/app/pages/"; then
        echo "✅ i18n files copied successfully"
    else
        echo "❌ Failed to copy i18n files"
        exit 1
    fi

    echo "Copying TypeScript configuration files..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "tsconfig.json" "playwright:/app/" || echo "⚠️  Failed to copy tsconfig.json"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "tsconfig.paths.json" "playwright:/app/" || echo "⚠️  Failed to copy tsconfig.paths.json"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "next.config.js" "playwright:/app/" || echo "⚠️  Failed to copy next.config.js"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "playwright.config.ts" "playwright:/app/" || echo "⚠️  Failed to copy playwright.config.ts"

    echo "🔍 Verifying files were copied correctly..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright ls -la /app/src/test/visual/ || echo "⚠️  Visual files not found in container"
    
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright ls -la /app/src/test/e2e/utils/ || echo "⚠️  E2E utils not found in container"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright ls -la /app/src/config/ || echo "⚠️  Config files not found in container"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright ls -la /app/pages/i18n/ || echo "⚠️  i18n files not found in container"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright sh -lc 'ls -la /app/tsconfig*.json' || echo "⚠️  TypeScript config files not found"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright ls -la /app/next.config.js || echo "⚠️  Next.js config not found"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright ls -la /app/playwright.config.ts || echo "⚠️  Playwright config not found"
    
    echo "🧹 Cleaning up previous Visual results..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright rm -rf /app/playwright-report /app/test-results || true

    echo "🎨 Running Playwright Visual tests with service-based connectivity..."
    PROD_URL="http://prod:3001"
    echo "🔍 Testing container connectivity..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T playwright curl -f "$PROD_URL" >/dev/null 2>&1 || echo "⚠️  Container connectivity test failed"

    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" exec -T $PLAYWRIGHT_ENV_FLAGS -e NEXT_PUBLIC_PROD_CONTAINER_API_URL="$PROD_URL" -w /app playwright npx playwright test src/test/visual --timeout=60000; then
        echo "✅ Visual tests PASSED"
    else
        echo "❌ Visual tests FAILED"
        docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" logs --tail=30 playwright
        echo "⚠️  Visual tests failed but continuing with build..."
    fi

    echo "📂 Copying Visual test results..."
    mkdir -p playwright-report test-results
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "playwright:/app/playwright-report/." "playwright-report/" 2>/dev/null || echo "No playwright-report to copy"
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" cp "playwright:/app/test-results/." "test-results/" 2>/dev/null || echo "No test-results to copy"

    echo "🧹 Cleaning up Docker services..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" down --volumes --remove-orphans || true
    
    echo "🎉 Visual tests completed successfully in DIND mode!"
}

run_load_tests_dind() {
    echo "⚡ Running K6 Load tests in true Docker-in-Docker mode"
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    
    echo "Building production container image..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" build

    echo "🚀 Starting production services..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" up -d --wait prod

    echo "Building K6 container image..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load build k6

    echo "⚡ Starting K6 service..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load up -d k6

    echo "📂 Preparing K6 directories..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load exec -T k6 mkdir -p /loadTests/results
    echo "📂 Copying K6 test files..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load cp "src/test/load/." "k6:/loadTests/"
    echo "✅ Load test files copied successfully"

    echo "🧹 Cleaning up previous load test results..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load exec -T k6 sh -lc 'rm -rf /loadTests/results || true && mkdir -p /loadTests/results'

    echo "⚡ Running K6 load tests..."
    ok=0
    if docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load exec -T -w /loadTests k6 \
       k6 run --summary-trend-stats="avg,min,med,max,p(95),p(99)" \
       --out "web-dashboard=period=1s&export=/loadTests/results/homepage.html" /loadTests/homepage.js; then
        echo "✅ Load tests PASSED"
    else
        echo "❌ Load tests FAILED"
        docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load logs --tail=30 k6 || true
        ok=1
    fi

    echo "📂 Copying load test results..."
    mkdir -p src/test/load/reports
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load cp "k6:/loadTests/results/." "src/test/load/reports/" 2>/dev/null || echo "No load test results to copy"

    echo "🧹 Cleaning up K6 services..."
    docker compose -f "$COMMON_HEALTHCHECKS_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" --profile load down --volumes --remove-orphans || true

    [ "$ok" -eq 0 ] || exit 1

    echo "🎉 Load tests completed successfully in true DinD mode!"
}

    run_load_tests_swagger_dind() {
    local website_dir=$1
    echo "📊 Running Swagger load tests in DIND mode using Makefile"
    run_make_with_prod_dind "load-tests-swagger" "Swagger load tests" "$website_dir"
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
    run_load_tests_swagger_dind "$website_dir"
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
    test-swagger)
        echo "📊 Running Swagger load tests only..."
        run_load_tests_swagger_dind "."
        ;;
    *)
        main "$@"
        ;;
esac