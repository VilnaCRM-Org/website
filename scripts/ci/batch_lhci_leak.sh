#!/bin/bash
set -e
NETWORK_NAME=${NETWORK_NAME:-"website-network"}
WEBSITE_DOMAIN=${WEBSITE_DOMAIN:-"localhost"}
DEV_PORT=${DEV_PORT:-"3000"}
NEXT_PUBLIC_PROD_PORT=${NEXT_PUBLIC_PROD_PORT:-"3001"}
PLAYWRIGHT_TEST_PORT=${PLAYWRIGHT_TEST_PORT:-"9323"}
UI_HOST=${UI_HOST:-"0.0.0.0"}
PROD_CONTAINER_NAME=${PROD_CONTAINER_NAME:-"website-prod"}
DOCKER_COMPOSE_DEV_FILE=${DOCKER_COMPOSE_DEV_FILE:-"docker-compose.yml"}
DOCKER_COMPOSE_TEST_FILE=${DOCKER_COMPOSE_TEST_FILE:-"docker-compose.test.yml"}
COMMON_HEALTHCHECKS_FILE=${COMMON_HEALTHCHECKS_FILE:-"common-healthchecks.yml"}

# Build guarded docker compose args array shared by all compose calls
COMPOSE_ARGS=( -f "$DOCKER_COMPOSE_TEST_FILE" )
if [ -n "$COMMON_HEALTHCHECKS_FILE" ] && [ -s "$COMMON_HEALTHCHECKS_FILE" ]; then
    COMPOSE_ARGS+=( -f "$COMMON_HEALTHCHECKS_FILE" )
fi
setup_docker_network() {
    docker network create "$NETWORK_NAME" 2>/dev/null || :
}
run_memory_leak_tests_dind() {
    make start-prod

    export NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name
    export NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value

    if ! make test-memory-leak; then
        docker compose -f docker-compose.memory-leak.yml logs --tail=30 memory-leak || true
        exit 1
    fi

    mkdir -p memory-leak-logs
    docker compose -f docker-compose.memory-leak.yml cp memory-leak:/app/src/test/memory-leak/results/. memory-leak-logs/ 2>/dev/null || :
    docker compose -f docker-compose.memory-leak.yml logs memory-leak > memory-leak-logs/test-execution.log 2>&1 || true
}

run_lighthouse_desktop_dind() {
    setup_docker_network

    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"

    make start-prod
    make install-chromium-lhci
    docker compose "${COMPOSE_ARGS[@]}" cp lighthouserc.desktop.js prod:/app/
    make test-chromium
    make lighthouse-desktop-dind
    mkdir -p lhci-reports-desktop
    docker compose "${COMPOSE_ARGS[@]}" cp prod:/app/lhci-reports-desktop/. lhci-reports-desktop/ 2>/dev/null || :
}

run_lighthouse_mobile_dind() {
    setup_docker_network

    export WEBSITE_DOMAIN="localhost"
    export NEXT_PUBLIC_PROD_PORT="3001"
    export DIND_MODE="1"
    export SHM_SIZE="2g"

    make start-prod
    make install-chromium-lhci
    docker compose "${COMPOSE_ARGS[@]}" cp lighthouserc.mobile.js prod:/app/
    make test-chromium
    make lighthouse-mobile-dind    
    mkdir -p lhci-reports-mobile
    docker compose "${COMPOSE_ARGS[@]}" cp prod:/app/lhci-reports-mobile/. lhci-reports-mobile/ 2>/dev/null || :
}

main() {
    local website_dir="${1:-.}"
    if [ ! -d "$website_dir" ]; then
        exit 1
    fi
    run_memory_leak_tests_dind "$website_dir"
    run_lighthouse_desktop_dind "$website_dir"
    run_lighthouse_mobile_dind "$website_dir"
}

case "${1:-all}" in
    test-memory-leak)
        run_memory_leak_tests_dind "."
        ;;
    test-lighthouse-desktop)
        run_lighthouse_desktop_dind "."
        ;;
    test-lighthouse-mobile)
        run_lighthouse_mobile_dind "."
        ;;
    *)
        main "$@"
        ;;
	esac