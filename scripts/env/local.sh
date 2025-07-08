#!/bin/bash

# Local Development Environment Script
# This script contains local development operations that don't need to be in the Makefile

set -e

WEBSITE_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${WEBSITE_SCRIPT_DIR}/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites for local development
check_prerequisites() {
    log_info "Checking local development prerequisites"
    
    local missing_deps=()
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing_deps+=("docker-compose")
    fi
    
    # Check Node.js (optional for local since we use Docker)
    if ! command -v node &> /dev/null; then
        log_warning "Node.js not found locally, will use Docker containers"
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_error "Please install the missing dependencies before continuing"
        return 1
    fi
    
    log_success "All prerequisites met"
}

# Setup local development environment
setup_local_env() {
    log_info "Setting up local development environment"
    
    cd "${PROJECT_ROOT}"
    
    # Create .env.local if it doesn't exist
    if [ ! -f .env.local ]; then
        log_info "Creating .env.local file"
        cat > .env.local << EOF
# Local development environment variables
ENVIRONMENT=local
NEXT_PUBLIC_ENV=development
WEBSITE_DOMAIN=localhost
DEV_PORT=3000
NEXT_PUBLIC_PROD_PORT=3001
PLAYWRIGHT_TEST_PORT=9323
UI_HOST=0.0.0.0
EOF
        log_success ".env.local created"
    else
        log_info ".env.local already exists"
    fi
    
    # Create network
    if ! docker network ls | grep -q website-network; then
        log_info "Creating Docker network"
        docker network create website-network
    fi
    
    log_success "Local environment setup complete"
}

# Clean local development environment
clean_local_env() {
    log_info "Cleaning local development environment"
    
    cd "${PROJECT_ROOT}"
    
    # Stop and remove containers
    docker compose down --remove-orphans 2>/dev/null || true
    
    # Remove Docker images (optional)
    read -p "Do you want to remove Docker images? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose down --rmi all --volumes 2>/dev/null || true
        log_success "Docker images removed"
    fi
    
    # Clean build artifacts
    rm -rf .next out build node_modules/.cache 2>/dev/null || true
    
    # Clean test artifacts
    rm -rf test-results playwright-report coverage reports 2>/dev/null || true
    
    log_success "Local environment cleaned"
}

# Install development tools locally
install_dev_tools() {
    log_info "Installing development tools"
    
    # Check if pnpm is available locally
    if ! command -v pnpm &> /dev/null; then
        log_info "Installing pnpm globally"
        npm install -g pnpm
    fi
    
    # Install Husky for git hooks
    if [ -f package.json ] && grep -q '"husky"' package.json; then
        log_info "Setting up Husky git hooks"
        pnpm husky install
    fi
    
    log_success "Development tools installed"
}

# Run development server with hot reload
dev_server() {
    log_info "Starting development server with hot reload"
    
    cd "${PROJECT_ROOT}"
    
    # Start containers
    docker compose -f docker-compose.yml up -d dev
    
    # Wait for server to be ready
    log_info "Waiting for dev server to be ready on port 3000..."
    for i in {1..30}; do
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            log_success "Dev server is ready!"
            log_info "🚀 Development server running at http://localhost:3000"
            break
        fi
        sleep 2
        if [ $i -eq 30 ]; then
            log_error "Dev server failed to start"
            docker compose logs dev
            return 1
        fi
    done
    
    # Show logs
    log_info "Following development server logs (Ctrl+C to stop)..."
    docker compose logs -f dev
}

# Quick test runner for local development
quick_test() {
    local test_type="${1:-unit}"
    
    log_info "Running quick ${test_type} tests locally"
    
    cd "${PROJECT_ROOT}"
    
    case "$test_type" in
        "unit")
            docker compose exec -T dev env TEST_ENV=client ./node_modules/.bin/jest --watch=false --maxWorkers=2
            ;;
        "lint")
            docker compose exec -T dev pnpm next lint
            docker compose exec -T dev pnpm tsc --noEmit
            ;;
        "format")
            docker compose exec -T dev pnpm prettier "**/*.{js,jsx,ts,tsx,json,css,scss,md}" --write --ignore-path .prettierignore
            ;;
        *)
            log_error "Unknown test type: $test_type"
            log_info "Available types: unit, lint, format"
            return 1
            ;;
    esac
}

# Debug container issues
debug_containers() {
    log_info "Debugging container issues"
    
    cd "${PROJECT_ROOT}"
    
    echo "=== Container Status ==="
    docker compose ps
    
    echo -e "\n=== Network Status ==="
    docker network ls | grep website || echo "Network not found"
    
    echo -e "\n=== Recent Logs ==="
    docker compose logs --tail=20 dev 2>/dev/null || echo "No dev container logs"
    
    echo -e "\n=== System Resources ==="
    docker system df
    
    echo -e "\n=== Port Usage ==="
    ss -tulpn | grep -E ":300[0-9]" || echo "No ports 3000-3009 in use"
}

# Open development URLs
open_urls() {
    log_info "Opening development URLs"
    
    local urls=(
        "http://localhost:3000" # Main app
        "http://localhost:6006" # Storybook (if running)
        "http://localhost:9323" # Playwright UI (if running)
    )
    
    for url in "${urls[@]}"; do
        if curl -f "$url" >/dev/null 2>&1; then
            log_success "Opening $url"
            # Try different browsers/commands
            if command -v xdg-open &> /dev/null; then
                xdg-open "$url" 2>/dev/null &
            elif command -v open &> /dev/null; then
                open "$url" 2>/dev/null &
            else
                log_info "Please open $url manually"
            fi
        else
            log_warning "$url is not available"
        fi
    done
}

# Main function
main() {
    case "${1:-help}" in
        "check")
            check_prerequisites
            ;;
        "setup")
            check_prerequisites
            setup_local_env
            install_dev_tools
            ;;
        "clean")
            clean_local_env
            ;;
        "dev")
            dev_server
            ;;
        "test")
            quick_test "${2:-unit}"
            ;;
        "debug")
            debug_containers
            ;;
        "open")
            open_urls
            ;;
        "help"|*)
            echo "Usage: $0 {check|setup|clean|dev|test|debug|open}"
            echo ""
            echo "Commands:"
            echo "  check          - Check development prerequisites"
            echo "  setup          - Setup local development environment"
            echo "  clean          - Clean local environment and artifacts"
            echo "  dev            - Start development server with hot reload"
            echo "  test [type]    - Run quick tests (unit|lint|format)"
            echo "  debug          - Debug container and network issues"
            echo "  open           - Open development URLs in browser"
            echo ""
            echo "Examples:"
            echo "  $0 setup              # Initial setup"
            echo "  $0 dev                # Start development"
            echo "  $0 test unit          # Run unit tests"
            echo "  $0 test lint          # Run linting"
            ;;
    esac
}

main "$@" 