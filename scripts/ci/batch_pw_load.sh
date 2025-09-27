#!/bin/bash

set -eu
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

# Build docker compose args safely for POSIX sh
COMPOSE_ARGS=""
if [ -n "$COMMON_HEALTHCHECKS_FILE" ] && [ -s "$COMMON_HEALTHCHECKS_FILE" ]; then
    COMPOSE_ARGS="$COMPOSE_ARGS -f $COMMON_HEALTHCHECKS_FILE"
fi
COMPOSE_ARGS="$COMPOSE_ARGS -f $DOCKER_COMPOSE_TEST_FILE"

# Ensure required compose env vars have sane defaults for healthchecks
NEXT_PUBLIC_MOCKOON_PORT=${NEXT_PUBLIC_MOCKOON_PORT:-"8080"}
GRAPHQL_PORT=${GRAPHQL_PORT:-"4000"}
GRAPHQL_API_PATH=${GRAPHQL_API_PATH:-"graphql"}
export NEXT_PUBLIC_MOCKOON_PORT GRAPHQL_PORT GRAPHQL_API_PATH NEXT_PUBLIC_PROD_PORT

:

PLAYWRIGHT_ENV_FLAGS="\
    -e NEXT_PUBLIC_MAIN_LANGUAGE=uk \
    -e NEXT_PUBLIC_FALLBACK_LANGUAGE=en \
    -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name \
    -e NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value \
    -e NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL=https://github.com/VilnaCRM-Org/ \
    -e NEXT_PUBLIC_GRAPHQL_API_URL=http://apollo:4000/graphql"

setup_docker_network() {
    docker network create "$NETWORK_NAME" 2>/dev/null || :
}

start_prod_dind() {
    setup_docker_network
    make build-prod
    docker compose ${COMPOSE_ARGS} up -d --wait prod
}
run_make_with_prod_dind() {
    target=$1
    description=$2
    website_dir=$3
    start_prod_dind
    export DIND=1
    if ! cd "$website_dir" || ! make "$target" CI=0; then
        exit 1
    fi
}

run_e2e_tests_dind() {
    setup_docker_network
    make start-prod
    if ! docker compose ${COMPOSE_ARGS} cp "." "playwright:/app/"; then
        exit 1
    fi
    PROD_URL="http://prod:3001"
    make test-e2e
    mkdir -p playwright-report test-results
    docker compose ${COMPOSE_ARGS} cp "playwright:/app/playwright-report/." "playwright-report/" 2>/dev/null || :
    docker compose ${COMPOSE_ARGS} cp "playwright:/app/test-results/." "test-results/" 2>/dev/null || :
}

run_visual_tests_dind() {
    setup_docker_network
    make start-prod
    docker compose ${COMPOSE_ARGS} exec -T playwright mkdir -p /app/src/test /app/src/config /app/pages/i18n
    if ! docker compose ${COMPOSE_ARGS} cp "." "playwright:/app/"; then
        exit 1
    fi
    PROD_URL="http://prod:3001"
    make test-visual
    mkdir -p playwright-report test-results
    docker compose ${COMPOSE_ARGS} cp "playwright:/app/playwright-report/." "playwright-report/" 2>/dev/null || :
    docker compose ${COMPOSE_ARGS} cp "playwright:/app/test-results/." "test-results/" 2>/dev/null || :
}

run_load_tests_dind() {
    setup_docker_network
    make start-prod
    make build-k6
    k6_helper_container="website-k6-helper"
    make create-k6-helper-container-dind K6_HELPER_NAME="$k6_helper_container"
    docker exec "$k6_helper_container" mkdir -p /loadTests/results
    docker cp "src/test/load/." "$k6_helper_container:/loadTests/"
    if ! make run-load-tests-dind K6_HELPER_NAME="$k6_helper_container"; then
        exit 1
    fi
    mkdir -p src/test/load/reports
    docker cp "$k6_helper_container:/loadTests/results/." "src/test/load/reports/" 2>/dev/null || :
}

main() {
    website_dir="${1:-.}"
    if [ ! -d "$website_dir" ]; then
        exit 1
    fi
    run_e2e_tests_dind "$website_dir"
    run_visual_tests_dind "$website_dir"
    run_load_tests_dind "$website_dir"
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
    *)
        main "$@"
        ;;
    esac