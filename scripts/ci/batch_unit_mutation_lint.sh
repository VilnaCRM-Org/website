#!/bin/bash
set -e

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
    echo "📡 Setting up Docker network..."
    docker network create "$NETWORK_NAME" 2>/dev/null || echo "Network $NETWORK_NAME already exists"
    echo "✅ Docker network configured"
}

start_dev_dind() {
    echo "🐳 Starting development environment in DIND mode..."
    make start
    echo "🎉 Development environment started successfully!"
}


run_unit_tests_dind() {
    echo "🧪 Running Unit tests using Makefile approach"

    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network

    echo "Building container image..."
    make build
 
    temp_dev_container="website-dev-test"
    
    make create-temp-dev-container-dind TEMP_CONTAINER_NAME="$temp_dev_container"
    make copy-source-to-container-dind TEMP_CONTAINER_NAME="$temp_dev_container"
    make install-deps-in-container-dind TEMP_CONTAINER_NAME="$temp_dev_container"
    
    if make run-unit-tests-dind TEMP_CONTAINER_NAME="$temp_dev_container"; then
        echo "✅ Unit tests PASSED"
    else
        echo "❌ Unit tests FAILED"
        exit 1
    fi

    echo "🎉 Unit tests completed successfully!"
}

run_mutation_tests_dind() {
    echo "🧬 Running Mutation tests using Makefile approach"

    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network

    echo "Building container image..."
    make build

    temp_dev_container="website-dev-test"
    
    make create-temp-dev-container-dind TEMP_CONTAINER_NAME="$temp_dev_container"
    make copy-source-to-container-dind TEMP_CONTAINER_NAME="$temp_dev_container"
    make install-deps-in-container-dind TEMP_CONTAINER_NAME="$temp_dev_container"
    
    if make run-mutation-tests-dind TEMP_CONTAINER_NAME="$temp_dev_container"; then
        echo "✅ Mutation tests PASSED"
    else
        echo "❌ Mutation tests FAILED"
        exit 1
    fi

    echo "🎉 Mutation tests completed successfully!"
}

run_lint_tests_dind() {
    echo "🔍 Running All linting tests using Makefile approach"

    echo "🔧 Setting up Docker network for DIND"
    setup_docker_network

    echo "Building container image..."
    make build
  
    temp_dev_container="website-dev-lint"
    
    make create-temp-dev-container-dind TEMP_CONTAINER_NAME="$temp_dev_container"
    make copy-source-to-container-dind TEMP_CONTAINER_NAME="$temp_dev_container"
    make install-deps-in-container-dind TEMP_CONTAINER_NAME="$temp_dev_container"
    
    mkdir -p "lint-logs"
    : > "lint-logs/summary.log"
    
    if make run-eslint-tests-dind TEMP_CONTAINER_NAME="$temp_dev_container"; then
        echo "✅ ESLint PASSED" | tee -a "lint-logs/summary.log"
    else
        echo "❌ ESLint FAILED" | tee -a "lint-logs/summary.log"
        echo "ESLint failed, but continuing with other checks..."
    fi
    
    if make run-typescript-tests-dind TEMP_CONTAINER_NAME="$temp_dev_container"; then
        echo "✅ TypeScript check PASSED" | tee -a "lint-logs/summary.log"
    else
        echo "❌ TypeScript check FAILED" | tee -a "lint-logs/summary.log"
        echo "TypeScript check failed, but continuing with other checks..."
    fi
    
    if make run-markdown-lint-tests-dind TEMP_CONTAINER_NAME="$temp_dev_container"; then
        echo "✅ Markdown linting PASSED" | tee -a "lint-logs/summary.log"
    else
        echo "❌ Markdown linting FAILED" | tee -a "lint-logs/summary.log"
        echo "Markdown linting failed, but continuing..."
    fi

    failed_count=$(grep -c "FAILED" "lint-logs/summary.log" 2>/dev/null || echo "0")
    if [ "$failed_count" -gt 0 ]; then
        echo "❌ $failed_count lint check(s) failed. Check lint-logs/ for details."
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

    # Run sequentially; stop on first failure via set -e
    run_unit_tests_dind
    run_mutation_tests_dind
    run_lint_tests_dind
}

case "${1:-all}" in
    test-unit)
        echo "🧪 Running unit tests only..."
        run_unit_tests_dind
        ;;
    test-mutation)
        echo "🧬 Running mutation tests only..."
        run_mutation_tests_dind
        ;;
    test-lint)
        echo "🔍 Running lint tests only..."
        run_lint_tests_dind
        ;;
    *)
        main "$@"
        ;;
esac 