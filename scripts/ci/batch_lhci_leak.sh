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

# Infra buildspecs source this file into CodeBuild's sh, so the compose file
# list is passed through a function rather than a bash array or a word-split
# string: every file name stays one quoted argument under any POSIX shell.
HEALTHCHECKS_COMPOSE_FILE=""
if [ -n "$COMMON_HEALTHCHECKS_FILE" ] && [ -s "$COMMON_HEALTHCHECKS_FILE" ]; then
    HEALTHCHECKS_COMPOSE_FILE=$COMMON_HEALTHCHECKS_FILE
fi

compose_test_stack() {
    if [ -n "$HEALTHCHECKS_COMPOSE_FILE" ]; then
        docker compose -f "$HEALTHCHECKS_COMPOSE_FILE" -f "$DOCKER_COMPOSE_TEST_FILE" "$@"
    else
        docker compose -f "$DOCKER_COMPOSE_TEST_FILE" "$@"
    fi
}

setup_docker_network() {
    docker network create "$NETWORK_NAME" 2>/dev/null || :
}
run_memory_leak_tests_dind() {
    # TODO: Remove CodeBuild skip once Chrome/CDP timeout issues are resolved
    if [ -n "$CODEBUILD_BUILD_ID" ] || [ -n "$AWS_REGION" ]; then
        echo "🚧 CodeBuild detected - skipping memory leak tests due to known Chrome/CDP issues"
        echo "📝 TODO: Re-enable once CodeBuild container constraints are resolved"
        echo "✅ Memory leak tests: SKIPPED (would run in other CI environments)"
        mkdir -p memory-leak-logs
        echo "Memory leak tests skipped in CodeBuild environment" > memory-leak-logs/test-execution.log
        return 0
    fi

    make start-prod

    export NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=no-aws-header-name
    export NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=no-aws-header-value

    if ! make memory-leak-dind; then
        docker compose -p memleak -f docker-compose.memory-leak.yml logs --tail=30 memory-leak || true
        exit 1
    fi

    mkdir -p "memory-leak-logs"
    docker compose -p memleak -f docker-compose.memory-leak.yml cp "memory-leak:/app/src/test/memory-leak/results/." "memory-leak-logs/" 2>/dev/null || :
    docker compose -p memleak -f docker-compose.memory-leak.yml logs memory-leak > "memory-leak-logs/test-execution.log" 2>&1 || true
}

run_lighthouse_desktop_dind() {
    setup_docker_network

    exit_code=0
    if (
        set -e
        make start-prod
        make install-chromium-lhci
        compose_test_stack cp "lighthouserc.desktop.js" "prod:/app/"
        make test-chromium
        make lighthouse-desktop-dind
        mkdir -p lhci-reports-desktop
        compose_test_stack cp "prod:/app/lhci-reports-desktop/." "lhci-reports-desktop/" 2>/dev/null || :
    ); then
        :
    else
        exit_code=$?
    fi

    compose_test_stack exec -T prod sh -lc 'rm -rf /app/lhci-reports-mobile /app/lhci-reports-desktop /app/lighthouserc.mobile.js /app/lighthouserc.desktop.js' 2>/dev/null || :
    compose_test_stack down --volumes --remove-orphans || true
    docker network rm "$NETWORK_NAME" 2>/dev/null || :

    if [ "$exit_code" -ne 0 ]; then
        exit "$exit_code"
    fi
}

run_lighthouse_mobile_dind() {
    setup_docker_network

    exit_code=0
    if (
        set -e
        make start-prod
        make install-chromium-lhci
        compose_test_stack cp "lighthouserc.mobile.js" "prod:/app/"
        make test-chromium
        make lighthouse-mobile-dind
        mkdir -p lhci-reports-mobile
        compose_test_stack cp "prod:/app/lhci-reports-mobile/." "lhci-reports-mobile/" 2>/dev/null || :
    ); then
        :
    else
        exit_code=$?
    fi

    compose_test_stack exec -T prod sh -lc 'rm -rf /app/lhci-reports-mobile /app/lhci-reports-desktop /app/lighthouserc.mobile.js /app/lighthouserc.desktop.js' 2>/dev/null || :
    compose_test_stack down --volumes --remove-orphans || true
    docker network rm "$NETWORK_NAME" 2>/dev/null || :
    if [ "$exit_code" -ne 0 ]; then
        exit "$exit_code"
    fi
}

main() {
    website_dir="${1:-.}"
    if [ ! -d "$website_dir" ]; then
        exit 1
    fi
    run_memory_leak_tests_dind "$website_dir"
    run_lighthouse_desktop_dind "$website_dir"
    run_lighthouse_mobile_dind "$website_dir"
}

case "${1:-all}" in
    test-memory-leak)
        run_memory_leak_tests_dind
        ;;
    test-lighthouse-desktop)
        run_lighthouse_desktop_dind
        ;;
    test-lighthouse-mobile)
        run_lighthouse_mobile_dind
        ;;
    *)
        main "$@"
        ;;
	esac