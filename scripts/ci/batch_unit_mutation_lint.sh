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
DEV_CONTAINER_NAME=${DEV_CONTAINER_NAME:-"website-dev"}

DOCKER_COMPOSE_DEV_FILE=${DOCKER_COMPOSE_DEV_FILE:-"docker-compose.yml"}
DOCKER_COMPOSE_TEST_FILE=${DOCKER_COMPOSE_TEST_FILE:-"docker-compose.test.yml"}
COMMON_HEALTHCHECKS_FILE=${COMMON_HEALTHCHECKS_FILE:-"common-healthchecks.yml"}

echo "🐳 DIND Environment Setup Script"
echo "================================"



setup_docker_network() {
    echo "📡 Ensuring Docker network via Make..."
    make create-network
}

wait_for_dev_dind() {
    echo "🐳 Waiting for dev service to be ready via Docker network..."
    echo "⏳ Ensuring dev service is up and healthy..."
    docker compose -f "$DOCKER_COMPOSE_DEV_FILE" up -d --wait dev || true
    if ! docker compose -f "$DOCKER_COMPOSE_DEV_FILE" ps dev | grep -q Up; then
        echo "❌ Service dev is not running"
        docker compose -f "$DOCKER_COMPOSE_DEV_FILE" ps
        exit 1
    fi
    echo "✅ Container $DEV_CONTAINER_NAME is running"
    echo "🔍 Verifying readiness on port $DEV_PORT (best-effort)..."
    make wait-for-dev || true
}



start_dev_dind() {
    echo "🐳 Starting development environment via Make..."
    make start
    wait_for_dev_dind
    echo "🎉 Development environment started successfully!"
}

start_prod_dind() {
    echo "🐳 Starting production environment via Make"
    make start-prod
    echo "🎉 Production environment started successfully!"
}

run_make_with_dind() {
    local target=$1
    local description=$2
    local website_dir=$3

    echo "🔧 Ensuring network and dev service via Make"
    setup_docker_network
    # Use compose health, not host wait-on, by overriding NEXT_DEV_CMD
    export WEBSITE_DOMAIN="${WEBSITE_DOMAIN:-localhost}"
    export DEV_PORT="${DEV_PORT:-3000}"
    if ! make start NEXT_DEV_CMD='$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) up -d --wait --remove-orphans dev'; then
        echo "❌ Failed to start dev service"
        exit 1
    fi

    echo "📦 Installing dependencies inside dev (Make)"
    if ! make install CI=0; then
        echo "❌ Dependency installation failed"
        exit 1
    fi

    export DIND=1
    echo "🚀 Running: $description"
    echo "[INFO] Target: $target"
    echo "[INFO] Website directory: $website_dir"
    echo "[INFO] Makefile path: $website_dir/Makefile"

    if [ "$target" = "test-unit-all" ]; then
        if make test-unit-all CI=0 NEXT_DEV_CMD='$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) up -d --wait --remove-orphans dev'; then
            echo "✅ $description completed successfully"
        else
            echo "❌ $description failed"
            exit 1
        fi
    elif [ "$target" = "test-mutation" ]; then
        if make test-mutation CI=0 NEXT_DEV_CMD='$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) up -d --wait --remove-orphans dev'; then
            echo "✅ $description completed successfully"
        else
            echo "❌ $description failed"
            exit 1
        fi
    else
        if [ "$target" = "lint" ] || [ "$target" = "lint-next" ] || [ "$target" = "lint-tsc" ] || [ "$target" = "lint-md" ]; then
            if (cd "$website_dir" && make "$target" CI=1); then
                echo "✅ $description completed successfully"
            else
                echo "❌ $description failed"
                exit 1
            fi
        else
            if make "$target" CI=0 NEXT_DEV_CMD='$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) up -d --wait --remove-orphans dev'; then
                echo "✅ $description completed successfully"
            else
                echo "❌ $description failed"
                exit 1
            fi
        fi
    fi
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
    if (cd "$website_dir" && make lint-next CI=1) > "$website_dir/lint-logs/eslint.log" 2>&1; then
        echo "✅ ESLint PASSED" | tee -a "$website_dir/lint-logs/summary.log"
    else
        echo "❌ ESLint FAILED" | tee -a "$website_dir/lint-logs/summary.log"
        echo "ESLint failed, but continuing with other checks..."
    fi
    
    echo "🔍 Running TypeScript check with log capture..."
    if (cd "$website_dir" && make lint-tsc CI=1) > "$website_dir/lint-logs/typescript.log" 2>&1; then
        echo "✅ TypeScript check PASSED" | tee -a "$website_dir/lint-logs/summary.log"
    else
        echo "❌ TypeScript check FAILED" | tee -a "$website_dir/lint-logs/summary.log"
        echo "TypeScript check failed, but continuing with other checks..."
    fi
    
    echo "🔍 Running Markdown linting with log capture..."
    if (cd "$website_dir" && make lint-md CI=1) > "$website_dir/lint-logs/markdown.log" 2>&1; then
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

    # Run sequentially; rely on set -e to stop on failure
    run_unit_tests_dind "$website_dir"
    run_mutation_tests_dind "$website_dir"
    run_all_lint_dind "$website_dir"
}

case "${1:-all}" in
    test-unit)
        run_unit_tests_dind "."
        ;;
    test-mutation)
        run_mutation_tests_dind "."
        ;;
    test-lint)
        run_all_lint_dind "."
        ;;
    all|*)
        main "$@"
        ;;
esac