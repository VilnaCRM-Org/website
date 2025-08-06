#!/bin/bash

set -euo pipefail

NETWORK_NAME=${NETWORK_NAME:-"website-network"}
WEBSITE_DOMAIN=${WEBSITE_DOMAIN:-"localhost"}
DEV_PORT=${DEV_PORT:-"3000"}
NEXT_PUBLIC_PROD_PORT=${NEXT_PUBLIC_PROD_PORT:-"3001"}
PLAYWRIGHT_TEST_PORT=${PLAYWRIGHT_TEST_PORT:-"9323"}
UI_HOST=${UI_HOST:-"0.0.0.0"}
PROD_CONTAINER_NAME=${PROD_CONTAINER_NAME:-"$PROD_CONTAINER_NAME"}
PLAYWRIGHT_CONTAINER_NAME=${PLAYWRIGHT_CONTAINER_NAME:-"$PLAYWRIGHT_CONTAINER_NAME"}
DEV_CONTAINER_NAME=${DEV_CONTAINER_NAME:-"$DEV_CONTAINER_NAME"}

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

test_container_connectivity() {
    echo "🔍 Enhanced container connectivity testing..."
    PROD_IP=$(docker inspect $PROD_CONTAINER_NAME --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || echo "")
    if [ -n "$PROD_IP" ]; then
        echo "✅ Production container IP: $PROD_IP"
    else
        echo "⚠️  Could not get production container IP"
        return 1
    fi
    
    echo "🔍 Testing DNS resolution..."
    docker exec $PLAYWRIGHT_CONTAINER_NAME nslookup $PROD_CONTAINER_NAME >/dev/null 2>&1 || echo "⚠️  DNS lookup failed for $PROD_CONTAINER_NAME"
    docker exec $PLAYWRIGHT_CONTAINER_NAME nslookup apollo >/dev/null 2>&1 || echo "⚠️  DNS lookup failed for apollo"
    
    echo "🔍 Testing ping connectivity..."
    docker exec $PLAYWRIGHT_CONTAINER_NAME ping -c 2 $PROD_CONTAINER_NAME >/dev/null 2>&1 || echo "⚠️  Ping failed for $PROD_CONTAINER_NAME"
    docker exec $PLAYWRIGHT_CONTAINER_NAME ping -c 2 apollo >/dev/null 2>&1 || echo "⚠️  Ping failed for apollo"
    
    echo "🔍 Testing HTTP connectivity..."
    docker exec $PLAYWRIGHT_CONTAINER_NAME curl -f http://$PROD_CONTAINER_NAME:3001 >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for $PROD_CONTAINER_NAME:3001"
    docker exec $PLAYWRIGHT_CONTAINER_NAME curl -f "http://$PROD_IP:3001" >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for $PROD_IP:3001"
    docker exec $PLAYWRIGHT_CONTAINER_NAME curl -f http://apollo:4000/graphql >/dev/null 2>&1 || echo "⚠️  HTTP connectivity failed for apollo:4000/graphql"
    
    echo "✅ Container connectivity testing completed"
}

wait_for_dev_dind() {
    echo "🐳 Waiting for dev service to be ready via Docker network..."
    echo "Debug: Checking if container is running..."
    echo "⏳ Checking if dev container is running..."
    if ! docker ps --filter "name=$DEV_CONTAINER_NAME" --filter "status=running" --format "{{.Names}}" | grep -q "$DEV_CONTAINER_NAME"; then
        echo "❌ Container $DEV_CONTAINER_NAME is not running"
        docker ps -a --filter "name=$DEV_CONTAINER_NAME"
        exit 1
    fi
    echo "✅ Container $DEV_CONTAINER_NAME is running"
    
    echo "🔍 Testing container connectivity..."
    echo "⏳ Waiting for dev service to be ready on port $DEV_PORT..."
    make wait-for-dev
}



start_dev_dind() {
    echo "🐳 Starting development environment in DIND mode..."
    make create-network
    make start
    wait_for_dev_dind
    echo "🎉 Development environment started successfully!"
}

start_prod_dind() {
    echo "🐳 Starting production environment in true Docker-in-Docker mode"
    echo "Setting up Docker network..."
    make create-network
    echo "Building production container image..."
    make build-prod
    echo "🚀 Starting production services..."
    make start-prod

    echo "🎉 Production environment started successfully!"
}

run_make_with_dind() {
    local target=$1
    local description=$2
    local website_dir=$3
    
    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network
    
    echo "Building container image..."
    docker compose -f "$DOCKER_COMPOSE_DEV_FILE" build dev
    
    local container_name="$DEV_CONTAINER_NAME-${target//[^a-zA-Z0-9]/}"
    echo "🧹 Cleaning up any existing temporary containers..."
    docker rm -f "$container_name" 2>/dev/null || true
    
    echo "🛠️ Starting container in background for file operations..."
    docker run -d --name "$container_name" --network "$NETWORK_NAME" $DEV_CONTAINER_NAME tail -f /dev/null
    
    echo "📂 Copying source files into container..."
    if docker cp . "$container_name:/app/"; then
        echo "✅ Source files copied successfully"
    else
        echo "❌ Failed to copy source files"
        docker rm -f "$container_name"
        exit 1
    fi
    
    echo "📦 Installing dependencies inside container..."
    if docker exec "$container_name" sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        docker logs "$container_name" --tail 20
        docker rm -f "$container_name"
        exit 1
    fi
    
    export DIND=1
    echo "🚀 Running: $description"
    echo "[INFO] Target: $target"
    echo "[INFO] Website directory: $website_dir"
    echo "[INFO] Makefile path: $website_dir/Makefile"
    
    if [ "$target" = "test-unit-all" ]; then
        echo "🧪 Running client-side tests..."
        if docker exec "$container_name" sh -c "cd /app && env TEST_ENV=client ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2"; then
            echo "✅ Client-side tests PASSED"
        else
            echo "❌ Client-side tests FAILED"
            docker logs "$container_name" --tail 30
            docker rm -f "$container_name"
            exit 1
        fi
        
        echo "🧪 Running server-side tests..."
        if docker exec "$container_name" sh -c "cd /app && env TEST_ENV=server ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2 ./src/test/apollo-server"; then
            echo "✅ Server-side tests PASSED"
        else
            echo "❌ Server-side tests FAILED"
            docker logs "$container_name" --tail 30
            docker rm -f "$container_name"
            exit 1
        fi
        
        echo "✅ $description completed successfully"
    elif [ "$target" = "test-mutation" ]; then
        echo "🧬 Running Stryker mutation tests..."
        if docker exec "$container_name" sh -c "cd /app && pnpm stryker run"; then
            echo "✅ Mutation tests PASSED"
        else
            echo "❌ Mutation tests FAILED"
            docker logs "$container_name" --tail 30
            docker rm -f "$container_name"
            exit 1
        fi
        
        echo "✅ $description completed successfully"
    else
        if [ "$target" = "lint" ] || [ "$target" = "lint-next" ] || [ "$target" = "lint-tsc" ] || [ "$target" = "lint-md" ]; then
            if docker exec "$container_name" sh -c "cd /app && make $target CI=1"; then
                echo "✅ $description completed successfully"
            else
                echo "❌ $description failed"
                docker logs "$container_name" --tail 30
                docker rm -f "$container_name"
                exit 1
            fi
        else
            if docker exec "$container_name" sh -c "cd /app && make $target CI=0"; then
                echo "✅ $description completed successfully"
            else
                echo "❌ $description failed"
                docker logs "$container_name" --tail 30
                docker rm -f "$container_name"
                exit 1
            fi
        fi
    fi
    
    echo "🧹 Cleaning up temporary container..."
    docker rm -f "$container_name"
}

run_unit_tests_dind() {
    local website_dir=$1
    echo "🧪 Running unit tests in DIND mode using Makefile"
    run_make_with_dind "test-unit-all" "Unit tests (client + server)" "$website_dir"
}

run_mutation_tests_dind() {
    local website_dir=$1
    echo "🧬 Running mutation tests in DIND mode using Makefile"
    run_make_with_dind "test-mutation" "Mutation tests" "$website_dir"
}

run_lint_tests_dind() {
    local website_dir=$1
    echo "🔍 Running linting tests in DIND mode using Makefile"
    run_make_with_dind "lint" "All linting tests (ESLint, TypeScript, Markdown)" "$website_dir"
}

run_eslint_dind() {
    local website_dir=$1
    echo "🔍 Running ESLint in DIND mode using Makefile"
    run_make_with_dind "lint-next" "ESLint check" "$website_dir"
}

run_typescript_check_dind() {
    local website_dir=$1
    echo "🔍 Running TypeScript check in DIND mode using Makefile"
    run_make_with_dind "lint-tsc" "TypeScript check" "$website_dir"
}

run_markdown_lint_dind() {
    local website_dir=$1
    echo "🔍 Running Markdown linting in DIND mode using Makefile"
    run_make_with_dind "lint-md" "Markdown linting" "$website_dir"
}

run_all_lint_dind() {
    local website_dir=$1
    echo "🧹 Running all lint checks in DIND mode..."
    mkdir -p "$website_dir/lint-logs"
    
    echo "🔍 Running ESLint with log capture..."
    if run_eslint_dind "$website_dir" > "$website_dir/lint-logs/eslint.log" 2>&1; then
        echo "✅ ESLint PASSED" | tee -a "$website_dir/lint-logs/summary.log"
    else
        echo "❌ ESLint FAILED" | tee -a "$website_dir/lint-logs/summary.log"
        echo "ESLint failed, but continuing with other checks..."
    fi
    
    echo "🔍 Running TypeScript check with log capture..."
    if run_typescript_check_dind "$website_dir" > "$website_dir/lint-logs/typescript.log" 2>&1; then
        echo "✅ TypeScript check PASSED" | tee -a "$website_dir/lint-logs/summary.log"
    else
        echo "❌ TypeScript check FAILED" | tee -a "$website_dir/lint-logs/summary.log"
        echo "TypeScript check failed, but continuing with other checks..."
    fi
    
    echo "🔍 Running Markdown linting with log capture..."
    if run_markdown_lint_dind "$website_dir" > "$website_dir/lint-logs/markdown.log" 2>&1; then
        echo "✅ Markdown linting PASSED" | tee -a "$website_dir/lint-logs/summary.log"
    else
        echo "❌ Markdown linting FAILED" | tee -a "$website_dir/lint-logs/summary.log"
        echo "Markdown linting failed, but continuing..."
    fi
    
    failed_count=$(grep -c "FAILED" "$website_dir/lint-logs/summary.log" 2>/dev/null || echo "0")
    if [ "$failed_count" -gt 0 ]; then
        echo "❌ $failed_count lint check(s) failed. Check $website_dir/lint-logs/ for details."
        exit 1
    else
        echo "🎉 All lint checks completed successfully!"
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
    echo "📋 Makefile path: $website_dir/Makefile"
    
    if [ ! -f "$website_dir/Makefile" ]; then
        echo "❌ Makefile not found in $website_dir"
        exit 1
    fi
    
    if run_unit_tests_dind "$website_dir"; then
        echo "✅ All unit tests completed successfully in DIND mode!"
    else
        echo "❌ Unit tests failed in DIND mode"
        exit 1
    fi
    
    if run_mutation_tests_dind "$website_dir"; then
        echo "✅ Mutation tests completed successfully in DIND mode!"
    else
        echo "❌ Mutation tests failed in DIND mode"
        exit 1
    fi
    
    if run_all_lint_dind "$website_dir"; then
        echo "✅ All linting tests completed successfully in DIND mode!"
    else
        echo "❌ Linting tests failed in DIND mode"
        exit 1
    fi
    
    echo "🎉 All tests completed successfully!"
}

show_usage() {
    echo "Usage: $0 [COMMAND|WEBSITE_DIR]"
    echo ""
    echo "Commands (for backward compatibility):"
    echo "  test-unit              Run unit tests only"
    echo "  test-mutation          Run mutation tests only"
    echo "  test-lint              Run lint tests only"
    echo ""
    echo "Arguments:"
    echo "  WEBSITE_DIR            Website directory path (default: current directory)"
    echo ""
    echo "This script runs unit tests, mutation tests, and linting tests in Docker-in-Docker mode"
    echo "using the Makefile commands with proper Docker container setup."
    echo ""
    echo "Examples:"
    echo "  $0 test-unit"
    echo "  $0 ."
    echo "  $0 /path/to/website"
    echo ""
    echo "Environment Variables:"
    echo "  NETWORK_NAME           Docker network name (default: website-network)"
    echo "  WEBSITE_DOMAIN         Website domain (default: localhost)"
    echo "  DEV_PORT               Development port (default: 3000)"
    echo "  NEXT_PUBLIC_PROD_PORT  Production port (default: 3001)"
    echo "  PLAYWRIGHT_TEST_PORT   Playwright test port (default: 9323)"
    echo "  UI_HOST                UI host binding (default: 0.0.0.0)"
    echo "  PROD_CONTAINER_NAME    Production container name (default: $PROD_CONTAINER_NAME)"
echo "  PLAYWRIGHT_CONTAINER_NAME Playwright container name (default: $PLAYWRIGHT_CONTAINER_NAME)"
echo "  DEV_CONTAINER_NAME     Development container name (default: $DEV_CONTAINER_NAME)"
}

case "${1:-help}" in
    help|--help|-h)
        show_usage
        exit 0
        ;;
    test-unit)
        echo "🧪 Running unit tests only..."
        run_unit_tests_dind "."
        ;;
    test-mutation)
        echo "🧬 Running mutation tests only..."
        run_mutation_tests_dind "."
        ;;
    test-lint)
        echo "🔍 Running lint tests only..."
        run_all_lint_dind "."
        ;;
    *)
        main "$@"
        ;;
esac 