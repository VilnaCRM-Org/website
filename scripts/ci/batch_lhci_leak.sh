#!/bin/bash

# Batch script for Lighthouse and Memory Leak tests using Makefile
# This script provides a unified interface for local, GitHub, and AWS CI environments

set -e

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MAKEFILE_PATH="$PROJECT_ROOT/Makefile"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if we're in a CI environment
is_ci_environment() {
    [ "$CI" = "1" ] || [ "$GITHUB_ACTIONS" = "true" ] || [ "$CODEBUILD_BUILD_ID" != "" ]
}

# Function to run make command with proper error handling
run_make() {
    local target="$1"
    local description="$2"
    
    print_status "Running: $description"
    
    if cd "$PROJECT_ROOT" && make "$target"; then
        print_success "$description completed successfully"
    else
        print_error "$description failed"
        exit 1
    fi
}

# Function to run memory leak tests
run_memory_leak_tests() {
    print_status "🐳 Running memory leak tests in Docker-in-Docker mode"
    
    run_make "test-memory-leak" "Memory leak tests"
    
    print_success "🎉 Memory leak tests completed successfully!"
}

# Function to run Lighthouse desktop tests
run_lighthouse_desktop_tests() {
    print_status "🐳 Running Lighthouse desktop tests in Docker-in-Docker mode"
    
    run_make "lighthouse-desktop" "Lighthouse desktop audit"
    
    print_success "🎉 Lighthouse desktop tests completed successfully!"
}

# Function to run Lighthouse mobile tests
run_lighthouse_mobile_tests() {
    print_status "🐳 Running Lighthouse mobile tests in Docker-in-Docker mode"
    
    run_make "lighthouse-mobile" "Lighthouse mobile audit"
    
    print_success "🎉 Lighthouse mobile tests completed successfully!"
}

# Function to run all tests in batch
run_batch_tests() {
    print_status "🚀 Starting batch execution: Memory Leak and Lighthouse tests"
    
    # Run memory leak tests
    run_memory_leak_tests
    
    # Run Lighthouse desktop tests
    run_lighthouse_desktop_tests
    
    # Run Lighthouse mobile tests
    run_lighthouse_mobile_tests
    
    print_success "🎉 All batch tests completed successfully!"
}

# Function to cleanup resources
cleanup() {
    print_status "🧹 Cleaning up resources..."
    
    if cd "$PROJECT_ROOT"; then
        make down 2>/dev/null || true
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Function to show help
show_help() {
    echo "Batch Lighthouse and Memory Leak Tests Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  test-memory-leak        Run memory leak tests"
    echo "  test-lighthouse-desktop Run Lighthouse desktop audit"
    echo "  test-lighthouse-mobile  Run Lighthouse mobile audit"
    echo "  test-all                Run all tests in batch"
    echo "  setup-network           Setup Docker network for DIND"
    echo "  configure-compose       Configure Docker Compose files for DIND"
    echo "  cleanup                 Clean up Docker resources"
    echo "  help                    Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  CI                      Set to 1 for CI environment"
    echo "  GITHUB_ACTIONS          Set to true for GitHub Actions"
    echo "  CODEBUILD_BUILD_ID      Set for AWS CodeBuild"
    echo ""
    echo "Examples:"
    echo "  $0 test-memory-leak     # Run only memory leak tests"
    echo "  $0 test-all             # Run all tests"
    echo "  $0 cleanup              # Clean up resources"
}

# Main command dispatcher
case "${1:-help}" in
    test-memory-leak)
        run_memory_leak_tests
        ;;
    test-lighthouse-desktop)
        run_lighthouse_desktop_tests
        ;;
    test-lighthouse-mobile)
        run_lighthouse_mobile_tests
        ;;
    test-all)
        run_batch_tests
        ;;
    setup-network)
        run_make "create-network" "Docker network setup"
        ;;
    configure-compose)
        print_status "Docker Compose configuration is handled automatically by the existing Makefile"
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac 