include .env
-include .env.local
-include .env.production
-include .env.production.local
-include .env.development
-include .env.development.local
-include .env.ci

export

WEBSITE_DOMAIN              ?= localhost
NEXT_PUBLIC_PROD_PORT       ?= 3001

DOCKER_COMPOSE              = docker compose

BIN_DIR                     = ./node_modules/.bin
NEXT_BIN                    = $(BIN_DIR)/next
ESLINT_BIN                  = $(BIN_DIR)/eslint
IMG_OPTIMIZE                = $(BIN_DIR)/next-export-optimize-images
TS_BIN                      = $(BIN_DIR)/tsc
STORYBOOK_BIN               = $(BIN_DIR)/storybook
JEST_BIN                    = $(BIN_DIR)/jest
SERVE_BIN                   = $(BIN_DIR)/serve
PLAYWRIGHT_BIN              = $(BIN_DIR)/playwright
BATS_BIN                    = bun x bats
DEPCRUISE_BIN               = $(BIN_DIR)/depcruise

# rust-code-analysis is a host-installed Rust binary (release tarball / cargo),
# NOT an npm dep under $(BIN_DIR); pin the version for reproducibility and install
# it to the gitignored ./bin so local and CI share one provisioning path.
# RCA_BIN is intentionally NOT a $(BIN_DIR)/... entry.
RCA_VERSION                 = 0.0.25
RCA_BIN                     = ./bin/rust-code-analysis-cli
RCA_SCOPE                   = src
RCA_INCLUDES                = *.ts *.tsx
RCA_EXCLUDES                = */test/* *.d.ts */assets/* */config/*
METRICS_POLICY_PATH         = config/metrics-policy.json
RCA_SHA256_LINUX            = 9ec2a217b8ff191e02dab5d5f2eee6158b63fd975c532b2c5d67c2e6c7249894

# oasdiff is a host-installed Go binary provisioned exactly like RCA above: pinned
# version + pinned digest, installed to the gitignored ./bin. Never resolve it as
# "latest" at install time — that would silently defeat the checksum pin. The
# digest is the one oasdiff publishes in the release's checksums.txt for
# oasdiff_$(OASDIFF_VERSION)_linux_amd64.tar.gz (note: the asset name carries no
# leading "v"; only the tag does).
OASDIFF_VERSION             = 1.27.0
OASDIFF_BIN                 = ./bin/oasdiff
OASDIFF_SHA256_LINUX        = 335de79be8df706735f7ab3edc35186e853c8add93d489d67e4e7fd70a07d08a
# The upstream repo whose newest release the nightly leg compares the committed
# baseline against. The pin the repo actually consumes stays USER_SERVICE_VERSION
# in .env — this is only the moving target the drift report is written about.
USER_SERVICE_REPO           = VilnaCRM-Org/user-service
USER_SERVICE_SPEC_PATH      = .github/openapi-spec/spec.yaml
OPENAPI_BASELINE            = contracts/user-service/openapi.json

NEXT_BUILD                  = $(NEXT_BIN) build --webpack
NEXT_BUILD_CMD              = $(NEXT_BUILD) && $(IMG_OPTIMIZE)
STORYBOOK_BUILD_CMD         = $(STORYBOOK_BIN) build --output-dir storybook-static-ci

TEST_DIR_BASE               = ./src/test
TEST_DIR_APOLLO             = $(TEST_DIR_BASE)/apollo-server
TEST_DIR_EDGE               = $(TEST_DIR_BASE)/edge
TEST_DIR_E2E                = $(TEST_DIR_BASE)/e2e
TEST_DIR_VISUAL             = $(TEST_DIR_BASE)/visual

# STRYKER_CMD is assembled with the executor prefix below, next to EXEC_MODE.
STRYKER_SHARD_CONFIG        = stryker.shard.config.mjs
MUTATION_SHARD_TOTAL        ?= 1
MUTATION_SHARD_INDEX        ?= 0
# Bun executes .ts directly (issue #397); no tsx/ts-node transpiler runner.
MERGE_MUTATION_REPORTS_CMD  = bun scripts/ci/merge-mutation-reports.ts

# E2E flake detection (#359). The burn-in re-runs the specs a PR changed with retries off, so
# nondeterminism shows up as some-but-not-all failures instead of being absorbed by the
# blanket `retries: 2` the CI Playwright config sets.
E2E_BURNIN_SPECS            ?= $(TEST_DIR_E2E)
E2E_BURNIN_REPEATS          ?= 5
# The burn-in report deliberately sits OUTSIDE test-results: the grader walks its report
# directory recursively, so nesting it would make a local `make check-e2e-flakes` parse the
# shard report and the burn-in report together as one cohort under a single FLAKE_MODE.
E2E_BURNIN_REPORT_DIR       ?= burn-in-results
FLAKE_MODE                  ?= retry-pass
FLAKE_REPORT_DIR            ?= test-results
FLAKE_CHANGED_SPECS         ?=
FLAKE_THRESHOLD             ?= 2
# Bun executes .ts directly (issue #397); no tsx/ts-node transpiler runner.
CHECK_FLAKY_REPORT_CMD      = bun scripts/ci/check-flaky-report.ts

SERVE_CMD                   = --collect.startServerCommand="$(SERVE_BIN) -l $(NEXT_PUBLIC_PROD_PORT) out" \
                              --collect.startServerReadyPattern="Accepting connections"
LHCI                        = bun x lhci autorun
LHCI_CONFIG_DESKTOP         = --config=lighthouserc.desktop.js
LHCI_CONFIG_MOBILE          = --config=lighthouserc.mobile.js
LHCI_DESKTOP_SERVE          = $(LHCI_CONFIG_DESKTOP) $(SERVE_CMD)
LHCI_MOBILE_SERVE           = $(LHCI_CONFIG_MOBILE) $(SERVE_CMD)

# ===== DRY helpers (macros/vars) =====
# Chrome/LHCI DIND common pieces
CHROMIUM_BIN_PATH           = /usr/bin/chromium-browser
LHCI_DIND_CHROME_FLAGS      = --no-sandbox --disable-dev-shm-usage --disable-extensions --disable-gpu --headless --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-software-rasterizer --disable-setuid-sandbox --single-process --no-zygote --js-flags=--max-old-space-size=4096
LHCI_DIND_BIN               = $(DOCKER_COMPOSE) $(DOCKER_COMPOSE_TEST_FILE) exec -T -w /app prod lhci autorun
LHCI_DIND_COMMON            = --collect.url="http://localhost:$(NEXT_PUBLIC_PROD_PORT)" \
                              --collect.chromePath=$(CHROMIUM_BIN_PATH) \
                              --collect.chromeFlags="$(LHCI_DIND_CHROME_FLAGS)"

# Exec helpers
EXEC_PROD_TTYLESS           = $(DOCKER_COMPOSE) $(DOCKER_COMPOSE_TEST_FILE) exec -T prod

# Macro: require env var with example usage value
define REQUIRE_ENV_VAR
	@if [ -z "$($(1))" ]; then \
		echo "Error: $(1) is required. Usage: make $(MAKECMDGOALS) $(1)=$(2)"; \
		exit 1; \
	fi
endef

# Macro: exec a command inside named container env var (e.g., TEMP_CONTAINER_NAME)
define EXEC_IN_CONTAINER
	docker exec "$($(1))" sh -lc "$(2)"
endef

# Must match `image:` on the dev service in docker-compose.yml and the tag the
# .github/actions/dev-container step builds.
DEV_IMAGE                   = website-dev:latest

DOCKER_COMPOSE_TEST_FILE    = -f docker-compose.test.yml
DOCKER_COMPOSE_DEV_FILE     = -f docker-compose.yml
# The dev compose file plus the CI overlay that runs the container idle. Only
# ci-setup uses it; every exec still resolves the service by project + name, so
# no other recipe needs to know the overlay exists.
DOCKER_COMPOSE_CI_DEV_FILE  = -f docker-compose.yml -f docker-compose.ci.yml
COMMON_HEALTHCHECKS_FILE    = -f common-healthchecks.yml
EXEC_DEV_TTYLESS            = $(DOCKER_COMPOSE) exec -T dev
NEXT_DEV_CMD                = $(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) up -d dev && $(MAKE) wait-for-dev
PLAYWRIGHT_DOCKER_CMD       = $(DOCKER_COMPOSE) $(DOCKER_COMPOSE_TEST_FILE) exec playwright
PLAYWRIGHT_TEST             = $(PLAYWRIGHT_DOCKER_CMD) sh -c

MEMLEAK_SERVICE             = memory-leak
DOCKER_COMPOSE_MEMLEAK_FILE = -f docker-compose.memory-leak.yml
MEMLEAK_BASE_PATH           = ./src/test/memory-leak
MEMLEAK_RESULTS_DIR         = $(MEMLEAK_BASE_PATH)/results
MEMLEAK_TEST_SCRIPT         = $(MEMLEAK_BASE_PATH)/runMemlabTests.js

K6_TEST_SCRIPT              ?= /loadTests/homepage.js
K6_RESULTS_FILE             ?= /loadTests/results/homepage.html
K6_SWAGGER_TEST_SCRIPT      ?= /loadTests/swagger.js
K6_SWAGGER_RESULTS_FILE     ?= /loadTests/results/swagger.html
K6                          = $(DOCKER_COMPOSE) $(DOCKER_COMPOSE_TEST_FILE) --profile load run --rm k6
LOAD_TESTS_RUN              = $(K6) run --summary-trend-stats="avg,min,med,max,p(95),p(99)" --out "web-dashboard=period=1s&export=$(K6_RESULTS_FILE)" $(K6_TEST_SCRIPT)
LOAD_TESTS_RUN_SWAGGER      = $(K6) run --summary-trend-stats="avg,min,med,max,p(95),p(99)" --out "web-dashboard=period=1s&export=$(K6_SWAGGER_RESULTS_FILE)" $(K6_SWAGGER_TEST_SCRIPT)

UI_FLAGS                    = --ui-port=$(PLAYWRIGHT_TEST_PORT) --ui-host=$(UI_HOST)
UI_MODE_URL                 = http://$(WEBSITE_DOMAIN):$(PLAYWRIGHT_TEST_PORT)

MD_LINT_ARGS                = -i CHANGELOG.md -i "test-results/**/*.md" -i "playwright-report/data/**/*.md" -i "node_modules/**/*.md" -i "specs/**" -i "_bmad/**" -i "_bmad-output/**" -i "bmalph/**" -i "CLAUDE.md"

JEST_FLAGS                  = --verbose
BATS_FORMATTER              ?= pretty

NETWORK_NAME                = website-network

# ===== CI orchestration (issue #305 — CRM command-surface parity) =====
# Dev-side lint and test phases are grouped so local developers and agents can
# run the same CI stages as the pipeline. The parallel runners execute each
# target concurrently, group their output, and aggregate exit codes.
CI_LINT_TARGETS             = lint-next lint-tsc lint-md lint-headers
CI_TEST_TARGETS             = ci-test-unit-client ci-test-unit-server ci-test-integration ci-test-contract
CI_LINT_RUNNER              = ./scripts/ci/run-parallel.sh ci-lint
CI_TEST_RUNNER              = ./scripts/ci/run-parallel.sh ci-test

# Arguments for the pr-comments helper (PR=<num> FORMAT=<text|json|markdown>).
PR                          ?=
FORMAT                      ?=

# ===== Executor selection (issue #399 — CRM container-always model) =====
# Every npm-tool gate runs INSIDE the dev container by default, on a laptop and
# on a CI runner alike, so `make lint-tsc` here and `make lint-tsc` there are
# the same command against the same toolchain. The image is the single source of
# truth for the runtime; there is no host Node / .nvmrc / node_modules-cache
# coupling left to drift.
#
# EXEC_MODE is deliberately NOT derived from $(CI). GitHub Actions exports
# CI=true into every step, so the previous `ifeq ($(CI),1)` switch silently
# routed 100% of CI to the host path — the very bug this issue exists to fix.
# Nothing under .github/workflows/ may set EXEC_MODE for a migrated gate.
#
#   container (default) — run the tool through `docker compose exec -T dev`.
#   host                — run the tool straight from $(BIN_DIR). Three supported
#                         callers, all of which have no compose to exec into:
#                           * .husky/pre-commit and .husky/pre-push, so the hooks
#                             work with no Docker daemon running;
#                           * the run-*-dind targets, which already exec into a
#                             temp container — inside it, "host" IS the container;
#                           * the Lighthouse targets in performance-testing.yml,
#                             which need a real Chrome the dev image does not ship
#                             (see the lighthouse-* targets).
#
# The value is an enum, not a boolean, and an unknown value is a hard error: an
# escape hatch that can be mistyped into silence is the same defect class as
# CI=true silently selecting the host path.
EXEC_MODE                   ?= container

ifeq ($(EXEC_MODE),container)
    PM_EXEC                 = $(EXEC_DEV_TTYLESS)
    # `env` rather than `docker compose exec -e`, so a recipe that injects
    # variables is spelled identically in both modes (`env VAR=v cmd` is valid
    # on the host too). A `VAR=v $(PM_EXEC) cmd` prefix would instead bind the
    # variable to the host docker CLI and never reach the container.
    PM_EXEC_ENV             = $(EXEC_DEV_TTYLESS) env
    # Prefix for targets a developer may invoke cold, before any `make start`.
    DEV_READY               = $(MAKE) ensure-dev &&
    # Prerequisite form of the above, for targets that reconcile before their
    # recipe rather than inside it. Empty in host mode so `EXEC_MODE=host` really
    # does bypass Docker — otherwise the escape hatch would still need a daemon.
    DEV_PREREQ              = ensure-dev
    STORYBOOK_START         = $(STORYBOOK_BIN) dev -p $(STORYBOOK_PORT) --host 0.0.0.0
    LHCI_RUN                = $(MAKE) start-prod && $(LHCI)
    LHCI_DESKTOP            = $(LHCI_RUN) $(LHCI_CONFIG_DESKTOP)
    LHCI_MOBILE             = $(LHCI_RUN) $(LHCI_CONFIG_MOBILE)
else ifeq ($(EXEC_MODE),host)
    PM_EXEC                 =
    PM_EXEC_ENV             = env
    DEV_READY               =
    DEV_PREREQ              =
    NEXT_DEV_CMD            = $(NEXT_BIN) dev
    STORYBOOK_START         = $(STORYBOOK_BIN) dev -p $(STORYBOOK_PORT)
    LHCI_RUN                = $(NEXT_BUILD_CMD) && $(LHCI)
    LHCI_DESKTOP            = $(LHCI_RUN) $(LHCI_DESKTOP_SERVE)
    LHCI_MOBILE             = $(LHCI_RUN) $(LHCI_MOBILE_SERVE)
else
    $(error EXEC_MODE must be 'container' or 'host' (got '$(EXEC_MODE)'))
endif

# Dev-side suites. UNIT_TESTS reconciles the dev container first because a
# developer may call it cold; the ci-test-* entrypoints assume `make ci-setup`
# already did (that is what the dev-container action runs), so the parallel
# runner does not re-probe compose once per target.
UNIT_TESTS                  = $(DEV_READY) $(PM_EXEC_ENV)
CI_TESTS                    = $(PM_EXEC_ENV)
STRYKER_CMD                 = $(DEV_READY) $(PM_EXEC) bun x stryker run

PRETTIER_BIN                = $(PM_EXEC) $(BIN_DIR)/prettier
MARKDOWNLINT_BIN            = $(PM_EXEC) $(BIN_DIR)/markdownlint

# No `--build`, and nothing here keyed on the ambient CI variable: the Makefile
# is now completely independent of it, so there is no value GitHub Actions can
# export that changes what a target does. Image freshness is owned by whoever
# builds the image — the .github/actions/dev-container step on a runner (through
# the BuildKit layer cache), `make build` on a laptop. Forcing a rebuild here
# would throw that cached image away and pay a cold build in every job.
CI_SETUP_UP_FLAGS           = -d --no-recreate

.DEFAULT_GOAL               = help
.RECIPEPREFIX               +=
.PHONY: $(filter-out node_modules,$(MAKECMDGOALS))

run-visual                  = $(PLAYWRIGHT_TEST) "$(PLAYWRIGHT_BIN) test $(TEST_DIR_VISUAL)"
run-e2e                     = $(PLAYWRIGHT_TEST) "$(PLAYWRIGHT_BIN) test $(TEST_DIR_E2E)"
# E2E sharding: the e2e workflow matrix runs one shard per runner via Playwright
# --shard=<index>/<total>. Defaults to 1/1 (the whole suite), so a bare
# `make test-e2e-shard` behaves exactly like `make test-e2e`.
E2E_SHARD_INDEX             ?= 1
E2E_SHARD_TOTAL             ?= 1
run-e2e-shard               = $(PLAYWRIGHT_TEST) "$(PLAYWRIGHT_BIN) test $(TEST_DIR_E2E) --shard=$(E2E_SHARD_INDEX)/$(E2E_SHARD_TOTAL)"
# Burn-in: repeat each spec with retries off so a flake surfaces as a partial failure. The
# JSON report goes to its own top-level directory so it neither overwrites the shard run's
# report nor gets swept up by a recursive walk of test-results.
run-e2e-burnin              = $(PLAYWRIGHT_TEST) "PLAYWRIGHT_JSON_REPORT=$(E2E_BURNIN_REPORT_DIR)/results.json \
                              $(PLAYWRIGHT_BIN) test $(E2E_BURNIN_SPECS) --repeat-each=$(E2E_BURNIN_REPEATS) --retries=0"
playwright-test             = $(PLAYWRIGHT_DOCKER_CMD) $(PLAYWRIGHT_BIN) test

help:
	@printf "\033[33mUsage:\033[0m make [target] [arg=\"val\"...]\n"
	@printf "\033[33mTargets:\033[0m\n"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' Makefile | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[32m%-20s\033[0m %s\n", $$1, $$2}'

start: ## Start the application
	$(NEXT_DEV_CMD)

# Reconciles the CONTAINER, not the dev server. A gate only needs something to
# `docker compose exec` into; none of them fetches a page from port 3000. Calling
# `make start` here would instead block on wait-for-dev until Next finishes its
# first full compile — up to WAIT_FOR_DEV_MAX_TRIES × WAIT_FOR_DEV_SLEEP — before
# a single lint rule ran. Use `make start` when you actually want the dev server.
# Builds first when the tag is missing, rather than relying on Compose to fall
# back from `pull_policy: never` to `build:`. Compose v5 does fall back (verified:
# with no local image, `up -d dev` reports "Image website-dev:latest Built"), but
# that behaviour has varied across versions and this repo has already been bitten
# once by a Compose version difference. An explicit build makes a fresh clone
# work on any of them, and costs one `image inspect` when the tag is present.
# `--no-recreate` is load-bearing, not an optimisation. This target is invoked
# with the BASE compose file only, while `ci-setup` creates the container from
# base + docker-compose.ci.yml — a different config hash. Without it, the first
# gate in every CI job would tear down the idle container ci-setup just started
# and replace it with a Next dev server under `restart: unless-stopped`,
# discarding both the overlay's whole purpose and its fail-fast restart policy.
# It still creates or starts the container when it is missing or stopped.
#
# check-dev-container-bind.sh runs on BOTH sides of `up` (#399). The pre-`up`
# call keeps a foreign checkout's container from being started at all; the
# post-`up` call is the one that actually holds, because the pre-`up` check
# passes in BOTH checkouts when neither has created the container yet — two
# concurrent starts would otherwise leave the loser running every gate against
# the winner's /app bind. After `up` the container exists and the answer is
# decidable.
ensure-dev: ## Reconcile the dev container (builds the image if absent; does not wait for the dev server)
	@bash ./scripts/ci/check-dev-container-bind.sh
	@docker image inspect $(DEV_IMAGE) >/dev/null 2>&1 || \
		$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) build dev
	@$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) up -d --no-recreate dev
	@bash ./scripts/ci/check-dev-container-bind.sh

# Bounded on purpose. Every migrated workflow calls `make start` first, so an
# unbounded wait here would turn any dev-service boot failure into a job that
# prints dots until it hits its `timeout-minutes` — with the container's own
# logs, the actual cause, never shown. Fail fast and dump them instead.
WAIT_FOR_DEV_MAX_TRIES      ?= 150
WAIT_FOR_DEV_SLEEP          ?= 2

wait-for-dev: ## Wait for the dev service to be ready on port $(DEV_PORT).
	@echo "Waiting for dev service to be ready on port $(DEV_PORT)..."
	@i=0; \
	while [ $$i -lt $(WAIT_FOR_DEV_MAX_TRIES) ]; do \
		if curl -fsS http://$(WEBSITE_DOMAIN):$(DEV_PORT) >/dev/null 2>&1; then \
			printf '\n✅ Dev service is up and running!\n'; \
			exit 0; \
		fi; \
		printf "."; \
		sleep $(WAIT_FOR_DEV_SLEEP); \
		i=$$((i+1)); \
	done; \
	printf '\n❌ Timed out waiting for the dev service after %s seconds\n' \
		"$$(($(WAIT_FOR_DEV_MAX_TRIES) * $(WAIT_FOR_DEV_SLEEP)))"; \
	$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) logs --tail=50 dev || true; \
	exit 1

create-temp-dev-container-dind: ## Create a temporary dev container for DIND testing (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🧹 Cleaning old temp container $(TEMP_CONTAINER_NAME)..."
	@docker rm -f "$(TEMP_CONTAINER_NAME)" 2>/dev/null || true
	@echo "🚀 Starting temp dev container $(TEMP_CONTAINER_NAME)..."
	$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) run -d --name "$(TEMP_CONTAINER_NAME)" --entrypoint sh dev -lc 'sleep infinity'

copy-source-to-container-dind: ## Copy source code to container for DIND testing (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "📂 Copying source into temp container $(TEMP_CONTAINER_NAME)..."
	# Use tar streaming with excludes to avoid docker cp EOF/tar issues on macOS
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,mkdir -p /app)
	@echo "   ↪️  Creating archive stream (excluding heavy/transient dirs)..."
	@tar -cf - \
		--exclude="./.git" \
		--exclude="./node_modules" \
		--exclude="./.next" \
		--exclude="./out" \
		--exclude="./coverage" \
		--exclude="./playwright-report" \
		--exclude="./test-results" \
		./ \
		| docker exec -i "$(TEMP_CONTAINER_NAME)" sh -lc 'tar -xf - -C /app'

install-deps-in-container-dind: ## Install dependencies in container for DIND testing (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "📦 Installing deps in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && npm install -g bun@1.3.5 && bun install --frozen-lockfile)

run-unit-tests-dind: ## Run unit tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🧪 Running client-side tests in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make test-unit-client EXEC_MODE=host)
	@echo "🧪 Running server-side tests in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make test-unit-server EXEC_MODE=host)

run-mutation-tests-dind: ## Run mutation tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🧬 Running Stryker mutation tests in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && bun x stryker run)

run-eslint-tests-dind: ## Run ESLint tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🔍 Running ESLint in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make lint-next EXEC_MODE=host)

run-typescript-tests-dind: ## Run TypeScript tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🔍 Running TypeScript check in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make lint-tsc EXEC_MODE=host)

run-markdown-lint-tests-dind: ## Run Markdown linting tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🔍 Running Markdown linting in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make lint-md EXEC_MODE=host)

run-deps-lint-tests-dind: ## Run dependency-cruiser tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🔍 Running dependency-cruiser in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make lint-deps EXEC_MODE=host)

create-k6-helper-container-dind: ## Create a detached K6 helper container for DIND testing (K6_HELPER_NAME required)
	$(call REQUIRE_ENV_VAR,K6_HELPER_NAME,my-k6-helper)
	@echo "🧹 Cleaning old K6 helper container $(K6_HELPER_NAME)..."
	@docker rm -f "$(K6_HELPER_NAME)" 2>/dev/null || true
	@echo "🚀 Starting K6 helper container $(K6_HELPER_NAME)..."
	$(DOCKER_COMPOSE) $(COMMON_HEALTHCHECKS_FILE) $(DOCKER_COMPOSE_TEST_FILE) --profile load run -d \
		--name "$(K6_HELPER_NAME)" --entrypoint sh k6 -lc 'tail -f /dev/null'

build-k6: ## Build K6 load testing container
	@echo "🔨 Building K6 container image..."
	$(DOCKER_COMPOSE) $(COMMON_HEALTHCHECKS_FILE) $(DOCKER_COMPOSE_TEST_FILE) --profile load build k6

run-load-tests-dind: ## Run K6 load tests in DIND container without starting services (K6_HELPER_NAME required)
	$(call REQUIRE_ENV_VAR,K6_HELPER_NAME,my-k6-helper)
	@echo "⚡ Running K6 load tests in container $(K6_HELPER_NAME)..."
	docker exec -w /loadTests "$(K6_HELPER_NAME)" k6 run \
		--summary-trend-stats="avg,min,med,max,p(95),p(99)" \
		--out "web-dashboard=period=1s&export=/loadTests/results/homepage.html" /loadTests/homepage.js


build: ## A tool build the project
	$(DOCKER_COMPOSE) build

# Wrapped in `sh -c` because NEXT_BUILD_CMD is a compound `a && b`: without it the
# executor would take only the first command and run the second on the host.
build-analyze: ## Build production bundle and launch bundle-analyzer report (ANALYZE=true)
	$(DEV_READY) $(PM_EXEC) sh -c 'ANALYZE=true $(NEXT_BUILD_CMD)'

build-out: ## Build production artifacts to ./out directory
	@echo "🏗️ Building production Docker image..."
	docker build -t next-build -f Dockerfile --target production .
	@container_id=$$(docker create next-build) && \
	rm -rf ./out && \
	docker cp $$container_id:/app/out ./ && \
	docker rm $$container_id && \
	echo "✅ Build artifacts extracted to ./out directory"

format: ## This command executes Prettier formatting
	$(DEV_READY) $(PRETTIER_BIN) "**/*.{js,jsx,ts,tsx,json,css,scss,md}" --write --ignore-path .prettierignore

lint-next: ## This command executes ESLint
	$(DEV_READY) $(PM_EXEC) $(ESLINT_BIN)

lint-tsc: ## This command executes Typescript linter
	$(DEV_READY) $(PM_EXEC) $(TS_BIN)

lint-md: ## This command executes Markdown linter
	$(DEV_READY) $(MARKDOWNLINT_BIN) $(MD_LINT_ARGS) "**/*.md"

# DELIBERATELY HOST-ONLY — no $(PM_EXEC), in either EXEC_MODE.
# The container runs as root, and writing this gitignored file from inside it
# creates it root-owned in the bind-mounted worktree. `start-prod` regenerates
# the same file on the host (the e2e/visual/memory-leak/load stacks have no dev
# container to reach into), and a host `node` then fails with EACCES on the
# root-owned file — breaking every prod-stack suite for that developer until
# they sudo-remove it. The generator imports nothing outside node:fs/node:path,
# so running it on the host needs no node_modules and no package manager.
generate-localization: ## Regenerate the gitignored pages/i18n/localization.json bundle (#328) — host-only
	node scripts/generateLocalization.mjs

.PHONY: lint lint-headers lint-docker-policy

lint-deps: generate-localization ## Validate architecture/import boundaries with dependency-cruiser
	$(DEV_READY) $(PM_EXEC) $(DEPCRUISE_BIN) src pages tests --config .dependency-cruiser.js

# Runs through the package manager like the other node gates, so it obeys
# EXEC_MODE: in container mode it executes inside the dev image the rest of the
# lint lane already uses, rather than needing a host node_modules.
lint-headers: ## Verify the edge security-header policy (config/security-headers.json) reaches every production response
	$(DEV_READY) $(PM_EXEC) node scripts/ci/lint-headers.mjs

# Host-only by nature, in either EXEC_MODE: it is a self-contained shell script
# that reads the Dockerfiles from the worktree, needs no node_modules, and the
# dev image it would exec into is itself one of the things it audits.
lint-docker-policy: ## Enforce the registry (no Docker Hub) + digest-pin policy on every Dockerfile
	./scripts/ci/lint-dockerfile-policy.sh

# generate-localization leads so the gitignored i18n bundle exists before the
# first linter reads it. It is also a prerequisite of lint-deps, but that is
# the LAST sub-target, which on a clean checkout left eslint and tsc resolving
# a module that had not been written yet.
lint: generate-localization lint-next lint-tsc lint-md lint-deps lint-docker-policy lint-headers ## Runs all linters: ESLint, TypeScript, Markdown, dependency-cruiser, the Dockerfile registry/digest policy, and the security-header gate in sequence.

# DELIBERATE DIVERGENCE FROM THE npm-tool LINT GATES (lint-next/tsc/md/deps),
# for the same reason as lint-metrics below:
#   * NOT in the `lint` aggregate (line above) and NOT in CI_LINT_TARGETS. The
#     drift check re-fetches the pinned tag from raw.githubusercontent.com, and
#     static-testing.yml is otherwise hermetic — a GitHub raw outage must not
#     turn the whole static lane red.
#   * Its CI surface is .github/workflows/contract-testing.yml, which runs it on
#     every PR with the network available.
# This target deliberately runs the full check, drift included. To validate the
# GraphQL operations and the spectral baseline without touching the network,
# invoke the script directly:
#   node scripts/contracts/lint-contracts.mjs --offline
lint-contracts: ## Validate the pinned user-service contracts: client GraphQL operations, the OpenAPI spectral baseline, and artifact drift
	$(DEV_READY) $(PM_EXEC) node scripts/contracts/lint-contracts.mjs

# DELIBERATE DIVERGENCE FROM THE npm-tool LINT GATES, for both of the reasons
# lint-contracts and lint-metrics each cite one of:
#   * Host-only: oasdiff is a Go binary absent from the node:*-alpine dev image,
#     so this target does NOT use $(PM_EXEC) and runs on the host in both modes.
#   * Network: it resolves the newest upstream release and downloads that spec.
#   * Therefore NOT in the `lint` aggregate and NOT in CI_LINT_TARGETS — both
#     route through the dev container / run-parallel.sh, and static-testing.yml
#     is hermetic by design. Its CI surface is .github/workflows/openapi-drift.yml.
# ADVISORY BY DESIGN: upstream moving on is not a PR author's fault, so the
# nightly turns breaking drift into a tracking issue rather than a red check.
# The BLOCKING contract gate is `make test-contract`.
# This target is the HUMAN-FACING surface. GNU make collapses every recipe
# failure to its own exit 2, so it cannot distinguish "breaking drift" (1) from
# "the check could not run" (2) — openapi-drift.yml therefore calls the script
# directly. Both paths run the identical script; only the exit-code fidelity
# differs. The script provisions the pinned binary itself.
lint-openapi: ## Report breaking changes between the committed OpenAPI baseline and the newest upstream release (host-only, network; advisory)
	@OASDIFF_BIN="$(OASDIFF_BIN)" OASDIFF_VERSION="$(OASDIFF_VERSION)" \
	 OASDIFF_SHA256_LINUX="$(OASDIFF_SHA256_LINUX)" \
	 OPENAPI_BASELINE="$(OPENAPI_BASELINE)" \
	 USER_SERVICE_REPO="$(USER_SERVICE_REPO)" \
	 USER_SERVICE_SPEC_PATH="$(USER_SERVICE_SPEC_PATH)" \
	 bash scripts/ci/openapi-drift.sh

update-contracts: $(DEV_PREREQ) ## Re-fetch the user-service contracts for the pinned USER_SERVICE_VERSION and refresh the spectral baseline
	$(PM_EXEC) node scripts/fetchSwaggerSchema.mjs
	$(PM_EXEC) node scripts/fetchGraphqlSchema.mjs
	$(PM_EXEC) node scripts/contracts/lint-contracts.mjs --update-baseline
	$(PRETTIER_BIN) "contracts/**/*.json" --write --ignore-path .prettierignore

# DELIBERATE DIVERGENCE FROM THE npm-tool LINT GATES (lint-next/tsc/md/deps):
#   * Host-only: rust-code-analysis is a Rust binary absent from the dev image,
#     so this target does NOT use $(PM_EXEC) and runs on the host in both modes.
#   * NOT in the `lint` aggregate (line above) and NOT in CI_LINT_TARGETS (both
#     route through the dev container / run-parallel.sh, which cannot run the
#     binary). Its only CI surface is .github/workflows/rust-code-analysis.yml.
#   * NO run-metrics-lint-tests-dind wrapper (it would have to install Rust into
#     the temp container, defeating the purpose).
# rust-code-analysis-cli only EMITS metrics; scripts/ci/lint-metrics.sh parses
# them against config/metrics-policy.json and owns the non-zero exit on hard
# breaches (collect-all-then-fail). ensure-rca.sh provisions the pinned, verified
# binary to ./bin if it is missing.
lint-metrics: ## Run rust-code-analysis complexity gate on src (host-only; auto-installs the pinned CLI to ./bin)
	@scripts/ci/ensure-rca.sh
	@RCA_BIN="$(RCA_BIN)" RCA_VERSION="$(RCA_VERSION)" RCA_SCOPE="$(RCA_SCOPE)" \
	 RCA_INCLUDES="$(RCA_INCLUDES)" RCA_EXCLUDES="$(RCA_EXCLUDES)" \
	 RCA_SHA256_LINUX="$(RCA_SHA256_LINUX)" \
	 METRICS_POLICY="$(METRICS_POLICY_PATH)" \
	 sh scripts/ci/lint-metrics.sh

husky: ## One-time Husky setup to enable Git hooks (deprecated if already set)
	bun x husky install

storybook-start: ## Start Storybook UI and open in browser
	$(DEV_READY) $(PM_EXEC) $(STORYBOOK_START)

# The stories import the i18n stack, which requires the generated bundle, so the
# target produces it itself rather than relying on a caller to remember.
storybook-build: generate-localization ## Build Storybook UI.
	$(DEV_READY) $(PM_EXEC) $(STORYBOOK_BUILD_CMD)

test-e2e: start-prod  ## Start production and run E2E tests (Playwright)
	$(run-e2e)

test-e2e-shard: start-prod ## Start production and run one E2E shard (E2E_SHARD_INDEX of E2E_SHARD_TOTAL; used by the e2e workflow matrix)
	$(run-e2e-shard)

test-e2e-burnin: start-prod ## Re-run E2E_BURNIN_SPECS E2E_BURNIN_REPEATS times with retries off to expose flaky specs (#359)
	$(run-e2e-burnin)

check-e2e-flakes: ## Grade a Playwright JSON report for flakes, host-only (FLAKE_MODE=retry-pass|burn-in|census, FLAKE_CHANGED_SPECS=<specs>)
	FLAKE_MODE="$(FLAKE_MODE)" FLAKE_REPORT_DIR="$(FLAKE_REPORT_DIR)" \
	FLAKE_CHANGED_SPECS="$(FLAKE_CHANGED_SPECS)" FLAKE_THRESHOLD="$(FLAKE_THRESHOLD)" \
	$(CHECK_FLAKY_REPORT_CMD)

test-e2e-ui: start-prod ## Start the production environment and run E2E tests with the UI available at $(UI_MODE_URL)
	@echo "🚀 Starting Playwright UI tests..."
	@echo "Test will be run on: $(UI_MODE_URL)"
	$(playwright-test) $(TEST_DIR_E2E) $(UI_FLAGS)

test-visual: start-prod  ## Start production and run visual tests (Playwright)
	$(run-visual)

test-visual-ui: start-prod ## Start the production environment and run visual tests with the UI available at $(UI_MODE_URL)
	@echo "🚀 Starting Playwright UI tests..."
	@echo "Test will be run on: $(UI_MODE_URL)"
	$(playwright-test) $(TEST_DIR_VISUAL) $(UI_FLAGS)

test-visual-update: start-prod ## Update Playwright visual snapshots
	$(playwright-test) $(TEST_DIR_VISUAL) --update-snapshots

create-network: ## Create the external Docker network if it doesn't exist
	@docker network ls | grep -q $(NETWORK_NAME) || docker network create $(NETWORK_NAME)

start-prod: create-network ## Build image and start container in production mode
	node scripts/generateLocalization.mjs
	$(DOCKER_COMPOSE) $(COMMON_HEALTHCHECKS_FILE) $(DOCKER_COMPOSE_TEST_FILE) up -d && make wait-for-prod-health

start-prod-clean: create-network ## Force rebuild and recreate all test containers, then wait for health
	$(DOCKER_COMPOSE) $(COMMON_HEALTHCHECKS_FILE) $(DOCKER_COMPOSE_TEST_FILE) up -d --force-recreate --build && $(MAKE) wait-for-prod-health

wait-for-prod: ## Wait for the prod service to be ready on port $(NEXT_PUBLIC_PROD_PORT).
	@echo "Waiting for prod service to be ready on port $(NEXT_PUBLIC_PROD_PORT)..."
	@while ! curl -s -f http://$(WEBSITE_DOMAIN):$(NEXT_PUBLIC_PROD_PORT) >/dev/null 2>&1; do printf "."; sleep 1; done
	@printf '\nProd service is up and running!\n'

test-unit-all: test-unit-client test-unit-server test-unit-edge ## This command executes unit tests for the client, server, and edge environments.

test-unit-client: ## Run all client-side unit tests using Jest (Next.js env, TEST_ENV=client)
	$(UNIT_TESTS) TEST_ENV=client $(JEST_BIN) $(JEST_FLAGS)

test-unit-server: ## Run server-side unit tests for Apollo using Jest (Node.js env, TEST_ENV=server, target: $(TEST_DIR_APOLLO))
	$(UNIT_TESTS) TEST_ENV=server $(JEST_BIN) $(JEST_FLAGS) $(TEST_DIR_APOLLO)

test-unit-edge: ## Run edge-script unit tests using Jest (Node.js env, TEST_ENV=edge, target: $(TEST_DIR_EDGE))
	$(UNIT_TESTS) TEST_ENV=edge $(JEST_BIN) $(JEST_FLAGS) $(TEST_DIR_EDGE)

test-fuzz: ## Run the client unit suite with the property suites at high fast-check run counts (FC_NUM_RUNS, default 100000) — the nightly fuzz leg of #347
	# Runs the full client suite so Jest coverage and its thresholds stay
	# enforced; FC_NUM_RUNS raises only the fast-check property suites' iteration
	# count (other suites ignore it), turning this into the deep fuzz pass.
	$(UNIT_TESTS) TEST_ENV=client FC_NUM_RUNS=$${FC_NUM_RUNS:-100000} $(JEST_BIN) $(JEST_FLAGS)

test-integration: ## Run the integration layer using Jest (TEST_ENV=integration, target: tests/integration)
	$(UNIT_TESTS) TEST_ENV=integration $(JEST_BIN) $(JEST_FLAGS)

test-integration-watch: ## Run integration tests in watch mode (TEST_ENV=integration)
	$(UNIT_TESTS) TEST_ENV=integration $(JEST_BIN) --watch

ci-test-integration: ## Run integration tests assuming ci-setup already started the dev environment (CI entrypoint)
	$(CI_TESTS) TEST_ENV=integration $(JEST_BIN) $(JEST_FLAGS)

# The contract layer (#350) boots the Mockoon mock e2e runs against — in-process,
# via @mockoon/commons-server, the same libraries Mockoon.Dockerfile's CLI wraps —
# and holds every response against the committed user-service OpenAPI document.
# It is hermetic: no network, no Docker, no compose stack, so it runs identically
# on a bare CI runner and inside the dev container. Kept OUT of the integration
# layer because that layer's charter is a global 100% coverage sweep over src/**,
# which a spec about an HTTP mock's wire format contributes nothing to.
test-contract: ## Run the mock-vs-OpenAPI contract parity layer using Jest (TEST_ENV=contract, target: tests/contract)
	$(UNIT_TESTS) TEST_ENV=contract $(JEST_BIN) $(JEST_FLAGS)

# DELIBERATELY host-side -- the only CI_TEST_TARGETS entry that does not go
# through $(CI_TESTS). contract-parity-testing.yml provisions the HOST toolchain
# (setup-node + `bun install`) and never starts the dev container, because this
# layer boots Mockoon in-process from the committed OpenAPI document and needs
# no container at all. Routing it through $(CI_TESTS) would exec into a
# container that workflow never created. Convert the workflow first if this
# should move.
ci-test-contract: ## Run contract parity tests directly assuming deps are installed (CI entrypoint)
	env TEST_ENV=contract $(JEST_BIN) $(JEST_FLAGS)

# ============================================================================
# CI orchestration (issue #305 — CRM command-surface parity)
# ----------------------------------------------------------------------------
# These targets give local developers and agents the same grouped CI phases the
# pipeline runs, adapted to website's Bun + Next.js toolchain.
#
# Intentionally NOT ported from crm/Makefile (rationale):
#   * lint-dup (jscpd), fmt-qlty / qlty: not configured in this repo; website's
#     lint stack is ESLint + tsc + markdownlint + dependency-cruiser (exposed as
#     lint-deps). Adopting the remaining tools needs new tooling/config and
#     belongs in a dedicated issue, not a naming-parity change.
#   * lint-metrics (rust-code-analysis): now ported (issue #224), but adapted —
#     the analyzer is a Rust binary absent from the node:*-alpine dev image, so
#     the target runs host-only, stays OUT of the `lint` aggregate and
#     CI_LINT_TARGETS, and ships no DinD wrapper. See the lint-metrics target
#     below for the full rationale.
#   * mockoon wait in ci-setup: website's dev service has no mockoon dependency
#     (mockoon lives in the prod/test compose stack), so ci-setup brings up dev
#     only.
#   * ensure-chromium / build-dev-chromium (apk into dev): website installs
#     Chromium + LHCI into the prod container via install-chromium-lhci, which
#     ci-prod-setup reuses.
#   * test-load-signup: website has no signup load scenario; its second K6
#     profile targets the Swagger page and is exposed as test-load-swagger.
# ============================================================================

.PHONY: ci ci-setup ci-lint ci-test ci-test-unit-client ci-test-unit-server \
	ci-test-mutation ci-mutation ci-prod-setup ci-test-e2e ci-test-visual \
	ci-test-memory-leak ci-test-load ci-test-lighthouse-desktop \
	ci-test-lighthouse-mobile ci-test-prod ensure-dev start-prod-clean \
	test-load test-load-swagger test-mutation-shard merge-mutation-reports \
	test-e2e-burnin check-e2e-flakes pr-comments generate-localization

# Brings the dev container up IDLE (docker-compose.ci.yml overrides only the
# command), so a gate does not pay for a Next dev server it never calls. There
# is no HTTP endpoint to poll afterwards — `--wait` returns once the container
# is running — so this deliberately does not depend on wait-for-dev.
ci-setup: create-network ## Prepare the shared dev environment for CI-oriented checks (idle container, no dev server)
	$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_CI_DEV_FILE) up $(CI_SETUP_UP_FLAGS) --wait dev

ci-lint: $(DEV_PREREQ) ## Run the CI lint phase (ESLint, TypeScript, Markdown) with grouped, aggregated output
	$(CI_LINT_RUNNER) $(CI_LINT_TARGETS)

ci-test: $(DEV_PREREQ) ## Run the CI dev-side test phase (unit client/server, integration) in parallel
	$(CI_TEST_RUNNER) $(CI_TEST_TARGETS)

ci-test-unit-client: ## Run client-side unit tests assuming ci-setup already started the dev environment (CI entrypoint)
	$(CI_TESTS) TEST_ENV=client $(JEST_BIN) $(JEST_FLAGS)

ci-test-unit-server: ## Run server-side unit tests assuming ci-setup already started the dev environment (CI entrypoint)
	$(CI_TESTS) TEST_ENV=server $(JEST_BIN) $(JEST_FLAGS) $(TEST_DIR_APOLLO)

ci-test-mutation: generate-localization ## Run mutation tests assuming ci-setup already started the dev environment (CI entrypoint)
	$(PM_EXEC) bun x stryker run

ci-mutation: $(DEV_PREREQ) ## Run mutation testing in isolation after the parallel dev-side tests (heavy; not parallelized)
	$(MAKE) ci-test-mutation

ci-prod-setup: ## Prepare the prod + Chromium environment for prod-side CI tests
	$(MAKE) start-prod
	$(MAKE) install-chromium-lhci

ci-test-e2e: ## Run E2E tests assuming ci-prod-setup already started the prod environment
	$(run-e2e)

ci-test-visual: ## Run visual tests assuming ci-prod-setup already started the prod environment
	$(run-visual)

ci-test-memory-leak: ## Run Memlab memory leak tests against the dedicated compose stack (assumes prod is running)
	# Isolate the Memlab stack in its own Compose project (-p memleak) so the
	# teardown never removes the shared prod stack as an "orphan" — this target
	# runs mid-sequence in ci-test-prod, before load and lighthouse. The trap
	# guarantees teardown even on failure, --wait avoids racing the exec against
	# an unready container, and the captured rc keeps a failing run non-zero.
	@set -e; \
	cleanup() { \
		rc=$$?; \
		echo "🧹 Cleaning up memory leak test containers..."; \
		$(DOCKER_COMPOSE) -p memleak $(DOCKER_COMPOSE_MEMLEAK_FILE) down --remove-orphans || true; \
		exit $$rc; \
	}; \
	trap cleanup EXIT; \
	echo "🧪 Starting memory leak test environment..."; \
	$(DOCKER_COMPOSE) -p memleak $(DOCKER_COMPOSE_MEMLEAK_FILE) up -d --wait --build $(MEMLEAK_SERVICE); \
	echo "🧹 Cleaning up previous memory leak results..."; \
	$(DOCKER_COMPOSE) -p memleak $(DOCKER_COMPOSE_MEMLEAK_FILE) exec -T $(MEMLEAK_SERVICE) rm -rf $(MEMLEAK_RESULTS_DIR); \
	echo "🚀 Running memory leak tests..."; \
	$(DOCKER_COMPOSE) -p memleak $(DOCKER_COMPOSE_MEMLEAK_FILE) exec -T $(MEMLEAK_SERVICE) node $(MEMLEAK_TEST_SCRIPT)

ci-test-load: ## Run K6 load tests assuming ci-prod-setup already started the prod environment
	$(LOAD_TESTS_RUN)

ci-test-lighthouse-desktop: ## Run Lighthouse desktop audit assuming ci-prod-setup prepared prod + Chromium
	$(MAKE) lighthouse-desktop-dind

ci-test-lighthouse-mobile: ## Run Lighthouse mobile audit assuming ci-prod-setup prepared prod + Chromium
	$(MAKE) lighthouse-mobile-dind

ci-test-prod: ## Run the CI prod-side test phase (e2e, visual, memory-leak, load, lighthouse) sequentially
	$(MAKE) ci-test-e2e
	$(MAKE) ci-test-visual
	$(MAKE) ci-test-memory-leak
	$(MAKE) ci-test-load
	$(MAKE) ci-test-lighthouse-desktop
	$(MAKE) ci-test-lighthouse-mobile

ci: ## Run the full local CI flow: setup, lint, dev tests, mutation, prod setup, prod tests
	$(MAKE) ci-setup
	$(MAKE) ci-lint
	$(MAKE) ci-test
	$(MAKE) ci-mutation
	$(MAKE) ci-prod-setup
	$(MAKE) ci-test-prod

test-bats: ## Run Bats coverage for Makefile shell flows and CI helper scripts
	DOCKER_COMPOSE_TEST_FILE=docker-compose.test.yml \
	DOCKER_COMPOSE_DEV_FILE=docker-compose.yml \
	COMMON_HEALTHCHECKS_FILE=common-healthchecks.yml \
	DOCKER_COMPOSE_MEMLEAK_FILE=docker-compose.memory-leak.yml \
	$(BATS_BIN) --formatter $(BATS_FORMATTER) -r tests/bats

test-memory-leak: start-prod ## This command executes memory leaks tests using Memlab library.
	$(MAKE) ci-test-memory-leak

memory-leak-dind: start-prod ## Run Memlab tests in isolated compose project (DIND safe)
	@echo "🧪 Starting memory leak test environment (isolated project)..."
	$(DOCKER_COMPOSE) -p memleak $(DOCKER_COMPOSE_MEMLEAK_FILE) up -d --wait --build $(MEMLEAK_SERVICE)
	@echo "🧹 Cleaning up previous memory leak results..."
	$(DOCKER_COMPOSE) -p memleak $(DOCKER_COMPOSE_MEMLEAK_FILE) exec -T $(MEMLEAK_SERVICE) rm -rf $(MEMLEAK_RESULTS_DIR)
	@echo "🚀 Running memory leak tests..."
	$(DOCKER_COMPOSE) -p memleak $(DOCKER_COMPOSE_MEMLEAK_FILE) exec -T $(MEMLEAK_SERVICE) sh -lc "unset DISPLAY; \
    export PUPPETEER_PROTOCOL_TIMEOUT=240000; \
    export PUPPETEER_ARGS='--no-sandbox --disable-dev-shm-usage --disable-gpu --single-process --no-zygote --disable-setuid-sandbox'; \
    export CHROME_ARGS='--no-sandbox --disable-dev-shm-usage --disable-gpu --single-process --no-zygote --disable-setuid-sandbox'; \
    node $(MEMLEAK_TEST_SCRIPT)"
	@echo "🧹 Cleaning up memory leak test containers..."
	$(DOCKER_COMPOSE) -p memleak $(DOCKER_COMPOSE_MEMLEAK_FILE) down

# `build` refreshes the image, so the container has to be recreated FROM it.
# ensure-dev deliberately will not do that (see its comment), so this target
# reconciles explicitly — otherwise Stryker would run against a container still
# made from the pre-build image and miss a just-added dependency.
test-mutation: build ## Run mutation tests using Stryker after building the app
	$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) up -d --force-recreate --renew-anon-volumes dev
	$(PM_EXEC) bun x stryker run

# The shard variables are injected with `env` INSIDE the executor, not as a
# shell prefix in front of it. A `VAR=v $(PM_EXEC) cmd` prefix binds the variable
# to the host docker CLI process and never reaches the container, which would
# silently hand Stryker an unset MUTATION_SHARD_INDEX.
test-mutation-shard: generate-localization ## Run mutation shard MUTATION_SHARD_INDEX of MUTATION_SHARD_TOTAL — writes reports/mutation/mutation-shard-<index>.json with break disabled
	$(DEV_READY) $(PM_EXEC_ENV) \
		MUTATION_SHARD_INDEX=$(MUTATION_SHARD_INDEX) MUTATION_SHARD_TOTAL=$(MUTATION_SHARD_TOTAL) \
		bun x stryker run $(STRYKER_SHARD_CONFIG)

merge-mutation-reports: ## Union the per-shard mutation reports and re-enforce the exact Stryker break gate over the whole set
	$(DEV_READY) $(PM_EXEC_ENV) MUTATION_SHARD_TOTAL=$(MUTATION_SHARD_TOTAL) $(MERGE_MUTATION_REPORTS_CMD)

wait-for-prod-health: ## Wait for the prod container to reach a healthy state.
	@echo "Waiting for prod container to become healthy (timeout: 60s)..."
	@for i in $$(seq 1 30); do \
		if $(DOCKER_COMPOSE) $(DOCKER_COMPOSE_TEST_FILE) ps | grep -q "prod.*(healthy)"; then \
			echo "Prod container is healthy and ready!"; \
			break; \
		fi; \
		sleep 2; \
		if [ $$i -eq 30 ]; then \
			echo "❌ Timed out waiting for prod container to become healthy"; \
			exit 1; \
		fi; \
	done

.PHONY: visual-direct e2e-direct all clean
visual-direct: start-prod ## Start production and run visual tests directly (no shell wrapper)
	$(playwright-test) $(TEST_DIR_VISUAL)

e2e-direct: start-prod ## Start production and run E2E tests directly (no shell wrapper)
	$(playwright-test) $(TEST_DIR_E2E)

all: build ## Default aggregate target to build the project

clean: down ## Clean up running containers and artifacts

load-tests: start-prod wait-for-prod-health ## This command executes load tests using K6 library. Note: The target host is determined by the service URL
                       ## using $(NEXT_PUBLIC_PROD_PORT), which maps to the production service in Docker Compose.
	$(LOAD_TESTS_RUN)

load-tests-swagger: start-prod wait-for-prod-health ## Execute comprehensive load tests for the Swagger page. Use environment variables to run specific scenarios:
                       ## run_smoke=true, run_average=true, run_stress=true, run_spike=true. If none set, runs all scenarios.
	$(LOAD_TESTS_RUN_SWAGGER)

test-load: load-tests ## Alias for load-tests (CRM-style naming): run K6 homepage load tests

test-load-swagger: load-tests-swagger ## Alias for load-tests-swagger (CRM-style naming): run K6 Swagger load tests

lighthouse-desktop: ## Run a Lighthouse audit using desktop viewport settings to evaluate performance and best practices
	$(LHCI_DESKTOP)

lighthouse-desktop-dind: ## Run Lighthouse desktop audit in DIND mode using prod container with explicit Chrome configuration
	@echo "🔦 Running Lighthouse desktop tests in DIND mode..."
	$(LHCI_DIND_BIN) --config=lighthouserc.desktop.js $(LHCI_DIND_COMMON)
	@echo "✅ Lighthouse desktop DIND tests completed"

lighthouse-mobile: ## Run a Lighthouse audit using mobile viewport settings to evaluate mobile UX and performance
	$(LHCI_MOBILE)

lighthouse-mobile-dind: ## Run Lighthouse mobile audit in DIND mode using prod container with explicit Chrome configuration
	@echo "📱 Running Lighthouse mobile tests in DIND mode..."
	$(LHCI_DIND_BIN) --config=lighthouserc.mobile.js $(LHCI_DIND_COMMON)
	@echo "✅ Lighthouse mobile DIND tests completed"

# Installs into BOTH trees on purpose. The dev container keeps node_modules in
# its own volume (docker-compose.yml), which is what every gate execs into; the
# host copy is what `bun x lint-staged` in .husky/pre-commit, an editor's
# TypeScript server, and any EXEC_MODE=host run resolve against. Installing only
# one of them leaves a fresh clone with a broken commit hook or broken gates.
install: check-node-version ## Install node modules with Bun into the dev container and the host (frozen lockfile)
	$(DEV_READY) $(PM_EXEC) bun install --frozen-lockfile
ifeq ($(EXEC_MODE),container)
	bun install --frozen-lockfile
endif

install-chromium-lhci: ## Install Chromium and Lighthouse CLI in the prod container for DIND testing
	@echo "📦 Installing Chromium and Lighthouse CLI in prod container..."
	$(EXEC_PROD_TTYLESS) sh -lc "apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0"
	@echo "✅ Chromium and Lighthouse CLI installation completed"

test-chromium: ## Test Chromium browser installation and version in the prod container
	@echo "🧪 Testing Chromium browser installation..."
	@if $(EXEC_PROD_TTYLESS) $(CHROMIUM_BIN_PATH) --version; then \
		echo "✅ Chromium is installed and working"; \
	else \
		echo "❌ Chromium installation test failed"; \
		exit 1; \
	fi

update: ## Update node modules to latest allowed versions — always runs locally, updates lockfile (run before committing dependency changes)
	bun update

down: ## Stop the docker containers
	$(DOCKER_COMPOSE) down --remove-orphans

sh: ## Log to the docker container
	$(DOCKER_COMPOSE) exec dev sh

ps: ## Log to the docker container
	@$(DOCKER_COMPOSE) ps

logs: ## Show all logs
	@$(DOCKER_COMPOSE) logs --follow dev

new-logs: ## Show live logs of the dev container
	@$(DOCKER_COMPOSE) logs --tail=0 --follow dev

stop: ## Stop docker
	$(DOCKER_COMPOSE) stop

# Host-only on purpose: this asserts the Node the developer's own tooling uses —
# the Husky hooks and every EXEC_MODE=host run. Pointed at the container it would
# only re-check the version the Dockerfile already pins, and could never fail.
check-node-version: ## Check that the host Node.js version matches .nvmrc
	node checkNodeVersion.js

pr-comments: ## Retrieve unresolved PR review comments (PR=<num> FORMAT=<text|json|markdown>)
	@if [ -n "$(PR)" ] && [ -n "$(FORMAT)" ]; then \
		./scripts/get-pr-comments.sh "$(PR)" "$(FORMAT)"; \
	elif [ -n "$(PR)" ]; then \
		./scripts/get-pr-comments.sh "$(PR)"; \
	elif [ -n "$(FORMAT)" ]; then \
		./scripts/get-pr-comments.sh "$(FORMAT)"; \
	else \
		./scripts/get-pr-comments.sh; \
	fi
