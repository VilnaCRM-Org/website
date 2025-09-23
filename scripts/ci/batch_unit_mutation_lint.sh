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

run_make_target_dind() {
    local target="$1"
    local description="$2"
    local log_file="$3"
    
    echo "🚀 Running $description using Makefile approach"
    echo "🔧 Executing: make $target CI=0"
    
    if [ -n "$log_file" ]; then
        if make "$target" CI=0 > "$log_file" 2>&1; then
            echo "✅ $description PASSED"
        else
            echo "❌ $description FAILED. Check $log_file for details."
            exit 1
        fi
    else
        if make "$target" CI=0; then
            echo "✅ $description PASSED"
        else
            echo "❌ $description FAILED"
            exit 1
        fi
    fi
    
    echo "🎉 $description completed successfully!"
}

# Simplified wrapper functions
run_unit_tests_dind() {
    run_make_target_dind "test-unit-all" "Unit tests (client + server)"
}

run_mutation_tests_dind() {
    run_make_target_dind "test-mutation" "Mutation tests"
}

run_lint_tests_dind() {
    run_make_target_dind "lint" "All linting tests"
}

run_eslint_dind() {
    run_make_target_dind "lint-next" "ESLint check"
}

run_typescript_check_dind() {
    run_make_target_dind "lint-tsc" "TypeScript check"
}

run_markdown_lint_dind() {
    run_make_target_dind "lint-md" "Markdown linting"
}

run_all_lint_dind() {
    local website_dir="${1:-.}"
    mkdir -p "$website_dir/lint-logs"
    run_make_target_dind "lint" "All lint checks" "$website_dir/lint-logs/all-lint.log"
    
    # Additional summary log for CI artifacts
    echo "✅ All lint checks PASSED" > "$website_dir/lint-logs/summary.log" || {
        echo "❌ Some lint checks FAILED" > "$website_dir/lint-logs/summary.log"
        echo "❌ Lint failures detected. Check $website_dir/lint-logs/ for details."
        exit 1
    }
}

main() {
    website_dir="${1:-.}"
    
    if [ ! -d "$website_dir" ]; then
        echo "❌ Website directory not found: $website_dir"
        exit 1
    fi
    
    echo "📁 Working directory: $(pwd)"
    echo "🌐 Website directory: $website_dir"
    
    # Setup network once at the beginning
    setup_docker_network
    
    # Run sequentially; stop on first failure via set -e
    run_unit_tests_dind "$website_dir"
    run_mutation_tests_dind "$website_dir"
    run_all_lint_dind "$website_dir"
}

case "${1:-all}" in
    test-unit)
        echo "🧪 Running unit tests only..."
        setup_docker_network
        run_unit_tests_dind "."
        ;;
    test-mutation)
        echo "🧬 Running mutation tests only..."
        setup_docker_network
        run_mutation_tests_dind "."
        ;;
    test-lint)
        echo "🔍 Running lint tests only..."
        setup_docker_network
        run_all_lint_dind "."
        ;;
    lint-eslint)
        echo "🔍 Running ESLint only..."
        setup_docker_network
        run_eslint_dind "."
        ;;
    lint-typescript)
        echo "🔍 Running TypeScript check only..."
        setup_docker_network
        run_typescript_check_dind "."
        ;;
    lint-markdown)
        echo "🔍 Running Markdown linting only..."
        setup_docker_network
        run_markdown_lint_dind "."
        ;;
    *)
        main "$@"
        ;;
esac