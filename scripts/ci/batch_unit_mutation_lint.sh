#!/bin/bash
set -e

NETWORK_NAME=${NETWORK_NAME:-"website-network"}
WEBSITE_DOMAIN=${WEBSITE_DOMAIN:-"localhost"}
DEV_PORT=${DEV_PORT:-"3000"}

echo "🐳 DIND Environment Setup Script"
echo "================================"

setup_docker_network() {
    echo "📡 Setting up Docker network..."
    docker network create "$NETWORK_NAME" 2>/dev/null || echo "Network $NETWORK_NAME already exists"
    echo "✅ Docker network configured"
}

run_unit_tests_dind() {
    echo "🧪 Running unit tests using Makefile approach"
    setup_docker_network
    
    # Use Makefile target for complete unit testing workflow
    echo "🚀 Running unit tests..."
    if make test-unit-all; then
        echo "✅ Unit tests PASSED"
    else
        echo "❌ Unit tests FAILED"
        exit 1
    fi
    
    echo "🎉 Unit tests completed successfully!"
}

run_mutation_tests_dind() {
    echo "🧬 Running mutation tests using Makefile approach"
    setup_docker_network
    
    # Use Makefile target for complete mutation testing workflow
    echo "🚀 Running mutation tests..."
    if make test-mutation; then
        echo "✅ Mutation tests PASSED"
    else
        echo "❌ Mutation tests FAILED"
        exit 1
    fi
    
    echo "🎉 Mutation tests completed successfully!"
}

run_lint_tests_dind() {
    echo "🔍 Running linting tests using Makefile approach"
    setup_docker_network
    
    # Use Makefile target for complete linting workflow
    echo "🚀 Running all linting tests..."
    if make lint; then
        echo "✅ All linting tests PASSED"
    else
        echo "❌ Some linting tests FAILED"
        exit 1
    fi
    
    echo "🎉 Linting tests completed successfully!"
}

run_eslint_dind() {
    echo "🔍 Running ESLint using Makefile approach"
    setup_docker_network
    
    echo "🚀 Running ESLint..."
    if make lint-next; then
        echo "✅ ESLint PASSED"
    else
        echo "❌ ESLint FAILED"
        exit 1
    fi
    
    echo "🎉 ESLint completed successfully!"
}

run_typescript_check_dind() {
    echo "🔍 Running TypeScript check using Makefile approach"
    setup_docker_network
    
    echo "🚀 Running TypeScript check..."
    if make lint-tsc; then
        echo "✅ TypeScript check PASSED"
    else
        echo "❌ TypeScript check FAILED"
        exit 1
    fi
    
    echo "🎉 TypeScript check completed successfully!"
}

run_markdown_lint_dind() {
    echo "🔍 Running Markdown linting using Makefile approach"
    setup_docker_network
    
    echo "🚀 Running Markdown linting..."
    if make lint-md; then
        echo "✅ Markdown linting PASSED"
    else
        echo "❌ Markdown linting FAILED"
        exit 1
    fi
    
    echo "🎉 Markdown linting completed successfully!"
}

run_all_lint_dind() {
    local website_dir="${1:-.}"
    echo "🧹 Running all lint checks using Makefile approach..."
    mkdir -p "$website_dir/lint-logs"
    
    # Run make lint and capture output for CI artifacts
    echo "🔍 Running all linting tests with log capture..."
    if make lint > "$website_dir/lint-logs/all-lint.log" 2>&1; then
        echo "✅ All lint checks PASSED" | tee "$website_dir/lint-logs/summary.log"
        echo "🎉 All lint checks completed successfully!"
    else
        echo "❌ Some lint checks FAILED" | tee "$website_dir/lint-logs/summary.log"
        echo "❌ Lint failures detected. Check $website_dir/lint-logs/ for details."
        exit 1
    fi
}

main() {
    website_dir="${1:-.}"
    
    if [ ! -d "$website_dir" ]; then
        echo "❌ Website directory not found: $website_dir"
        exit 1
    fi
    
    echo "📁 Working directory: $(pwd)"
    echo "🌐 Website directory: $website_dir"
    
    # Run sequentially; stop on first failure via set -e
    run_unit_tests_dind "$website_dir"
    run_mutation_tests_dind "$website_dir"
    run_all_lint_dind "$website_dir"
}

case "${1:-all}" in
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
    lint-eslint)
        echo "🔍 Running ESLint only..."
        run_eslint_dind "."
        ;;
    lint-typescript)
        echo "🔍 Running TypeScript check only..."
        run_typescript_check_dind "."
        ;;
    lint-markdown)
        echo "🔍 Running Markdown linting only..."
        run_markdown_lint_dind "."
        ;;
    *)
        main "$@"
        ;;
esac