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

# zizmor is the GitHub Actions security linter (issue #360). Like gitleaks and
# lychee it ships as a CLI container pinned BY DIGEST, so a repointed tag can
# never change what the security gate enforces. Digest is zizmor 1.28.0.
# The gate blocks on medium-and-above findings that zizmor reports with high
# confidence; see scripts/ci/lint-workflows.sh and the workflow-security.yml
# job comment for what that deliberately leaves out and why.
ZIZMOR_IMAGE                = ghcr.io/zizmorcore/zizmor@sha256:8e6b3e4fb74d1aa5d23e83ea369f386c66eced0d1fb944d32cd8b2aac100b00d
ZIZMOR_MIN_SEVERITY         = medium
ZIZMOR_MIN_CONFIDENCE       = high

NEXT_BUILD                  = $(NEXT_BIN) build --webpack
NEXT_BUILD_CMD              = $(NEXT_BUILD) && $(IMG_OPTIMIZE)
STORYBOOK_BUILD_CMD         = $(STORYBOOK_BIN) build --output-dir storybook-static-ci

TEST_DIR_BASE               = ./src/test
TEST_DIR_APOLLO             = $(TEST_DIR_BASE)/apollo-server
TEST_DIR_EDGE               = $(TEST_DIR_BASE)/edge
TEST_DIR_E2E                = $(TEST_DIR_BASE)/e2e
TEST_DIR_VISUAL             = $(TEST_DIR_BASE)/visual
# Route-level accessibility scans (issue #317). A peer of e2e/visual rather than
# a subfolder of e2e, so `make test-e2e` does not run the axe suite a second
# time on every browser and shard.
TEST_DIR_A11Y               = $(TEST_DIR_BASE)/a11y
# The component-level half of the gate lives in the client Jest suite, so it
# already runs under test-unit-client; this pattern lets `make test-a11y` run
# just that spec.
TEST_A11Y_COMPONENT_SPEC    = $(TEST_DIR_BASE)/testing-library/A11yComponents.test.tsx

STRYKER_CMD                 = bun x stryker run
STRYKER_SHARD_CONFIG        = stryker.shard.config.mjs
MUTATION_SHARD_TOTAL        ?= 1
MUTATION_SHARD_INDEX        ?= 0
# Which slice of the tree a mutation run covers (#345): curated (the fixed list
# in stryker.config.mjs), changed (only the mutable files a PR touches), or full
# (every mutable file — the nightly census). See config/mutation-policy.json.
MUTATION_SCOPE              ?= curated
MUTATION_BASE_REF           ?= origin/main
MERGE_MUTATION_REPORTS_CMD  = bun x tsx scripts/ci/merge-mutation-reports.ts
MUTATION_FILE_LIST_CMD      = bun x tsx scripts/ci/mutation-file-list.ts

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
CHECK_FLAKY_REPORT_CMD      = bun x tsx scripts/ci/check-flaky-report.ts

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

DOCKER_COMPOSE_TEST_FILE    = -f docker-compose.test.yml
DOCKER_COMPOSE_DEV_FILE     = -f docker-compose.yml
COMMON_HEALTHCHECKS_FILE    = -f common-healthchecks.yml
EXEC_DEV_TTYLESS            = $(DOCKER_COMPOSE) exec -T dev
NEXT_DEV_CMD                = $(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) up -d dev && make wait-for-dev
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
CI_LINT_TARGETS             = lint-next lint-tsc lint-md lint-api-versions lint-headers lint-prod-guardrails
CI_TEST_TARGETS             = ci-test-unit-client ci-test-unit-server ci-test-integration ci-test-contract
CI_LINT_RUNNER              = ./scripts/ci/run-parallel.sh ci-lint
CI_TEST_RUNNER              = ./scripts/ci/run-parallel.sh ci-test

# Arguments for the pr-comments helper (PR=<num> FORMAT=<text|json|markdown>).
PR                          ?=
FORMAT                      ?=

# Arguments for the release-audit dry run (AUDIT_EVENT=release|push|sweep, AUDIT_REF=<tag|sha>).
AUDIT_REF                   ?=

CI                          ?= 0

# Treat common truthy CI values the same (e.g., CI=true from GitHub Actions/act)
ifneq (,$(filter 1 true TRUE,$(CI)))
    CI := 1
endif

ifeq ($(CI), 1)
    # Host CI mode: bins carry a Node shebang and run directly (Bun is the
    # package manager, not the runtime). No executor prefix is needed.
    PM_EXEC                 =
    NEXT_DEV_CMD            = $(NEXT_BIN) dev
    UNIT_TESTS              = env
    CI_SETUP_UP_FLAGS       = -d --build

    STORYBOOK_START         = $(STORYBOOK_BIN) dev -p $(STORYBOOK_PORT)

    LHCI_BUILD_CMD          = $(NEXT_BUILD_CMD) && $(LHCI)
    LHCI_DESKTOP            = $(LHCI_BUILD_CMD) $(LHCI_DESKTOP_SERVE)
    LHCI_MOBILE             = $(LHCI_BUILD_CMD) $(LHCI_MOBILE_SERVE)
else
    PM_EXEC                 = $(EXEC_DEV_TTYLESS)
    STRYKER_CMD             = make start && $(EXEC_DEV_TTYLESS) bun x stryker run
    UNIT_TESTS              = make start && $(EXEC_DEV_TTYLESS) env
    CI_SETUP_UP_FLAGS       = -d --no-recreate

    STORYBOOK_START         = $(STORYBOOK_BIN) dev -p $(STORYBOOK_PORT) --host 0.0.0.0

    LHCI_BUILD_CMD          = make start-prod && $(LHCI)
    LHCI_DESKTOP            = $(LHCI_BUILD_CMD) $(LHCI_CONFIG_DESKTOP)
    LHCI_MOBILE             = $(LHCI_BUILD_CMD) $(LHCI_CONFIG_MOBILE)
endif

PRETTIER_BIN                = $(PM_EXEC) $(BIN_DIR)/prettier
MARKDOWNLINT_BIN            = $(PM_EXEC) $(BIN_DIR)/markdownlint

# To Run in CI mode specify CI variable. Example: make lint-md CI=1

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
run-a11y                    = $(PLAYWRIGHT_TEST) "$(PLAYWRIGHT_BIN) test $(TEST_DIR_A11Y)"
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

ensure-dev: ## Start the dev service only when it is not already running
	@if $(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) ps --status running --services 2>/dev/null | grep -qx dev; then \
		echo "✅ Dev service is already running."; \
	else \
		$(MAKE) start; \
	fi

wait-for-dev: ## Wait for the dev service to be ready on port $(DEV_PORT).
	@echo "Waiting for dev service to be ready on port $(DEV_PORT)..."
	@while ! curl -s -f http://$(WEBSITE_DOMAIN):$(DEV_PORT) >/dev/null 2>&1; do printf "."; sleep 1; done
	@printf '\nDev service is up and running!\n'

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
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make test-unit-client CI=1)
	@echo "🧪 Running server-side tests in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make test-unit-server CI=1)

run-mutation-tests-dind: ## Run mutation tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🧬 Running Stryker mutation tests in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && bun x stryker run)

run-eslint-tests-dind: ## Run ESLint tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🔍 Running ESLint in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make lint-next CI=1)

run-typescript-tests-dind: ## Run TypeScript tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🔍 Running TypeScript check in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make lint-tsc CI=1)

run-markdown-lint-tests-dind: ## Run Markdown linting tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🔍 Running Markdown linting in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make lint-md CI=1)

run-deps-lint-tests-dind: ## Run dependency-cruiser tests in DIND container (TEMP_CONTAINER_NAME required)
	$(call REQUIRE_ENV_VAR,TEMP_CONTAINER_NAME,my-container)
	@echo "🔍 Running dependency-cruiser in container $(TEMP_CONTAINER_NAME)..."
	$(call EXEC_IN_CONTAINER,TEMP_CONTAINER_NAME,cd /app && make lint-deps CI=1)

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

build-analyze: ## Build production bundle and launch bundle-analyzer report (ANALYZE=true)
	ANALYZE=true $(NEXT_BUILD_CMD)

build-out: ## Build production artifacts to ./out directory
	@echo "🏗️ Building production Docker image..."
	docker build -t next-build -f Dockerfile --target production .
	@container_id=$$(docker create next-build) && \
	rm -rf ./out && \
	docker cp $$container_id:/app/out ./ && \
	docker rm $$container_id && \
	echo "✅ Build artifacts extracted to ./out directory"

# `mjs` is in the glob deliberately: the Node CLI helpers under scripts/ are
# excluded from qlty (see .qlty/qlty.toml — they sit outside eslint.config.mjs's
# scope), so without this nothing would check their formatting and they would
# have to be hand-run through Prettier. Every tracked .mjs is already clean, so
# this adds coverage without churn.
format: ## This command executes Prettier formatting
	$(PRETTIER_BIN) "**/*.{js,jsx,mjs,ts,tsx,json,css,scss,md}" --write --ignore-path .prettierignore

lint-next: ## This command executes ESLint
	$(PM_EXEC) $(ESLINT_BIN)

lint-tsc: ## This command executes Typescript linter
	$(PM_EXEC) $(TS_BIN)

lint-md: ## This command executes Markdown linter
	$(MARKDOWNLINT_BIN) $(MD_LINT_ARGS) "**/*.md"

lint-deps: ## Validate architecture/import boundaries with dependency-cruiser
	node scripts/generateLocalization.mjs
	$(PM_EXEC) $(DEPCRUISE_BIN) src pages tests --config .dependency-cruiser.js

.PHONY: lint lint-api-versions lint-headers lint-docker-policy lint-security-txt lint-prod-guardrails

# The user-service inventory invariant (issue #381, F4): every consumer of the
# upstream contracts — the GraphQL schema behind the Apollo mock and the OpenAPI
# spec behind /swagger — must derive from the single USER_SERVICE_VERSION pin.
# Unlike lint-contracts this check is HERMETIC (no network, no Docker), so it
# belongs in the `lint` aggregate and in CI_LINT_TARGETS: the drift that produced
# the defect (docs on v2.6.0, GraphQL on v2.4.1) is caught on every PR.
lint-api-versions: ## Verify OpenAPI and GraphQL reference the same pinned user-service release
	$(PM_EXEC) node scripts/contracts/check-api-versions.mjs

lint-headers: ## Verify the edge security-header policy (config/security-headers.json) reaches every production response
	$(PM_EXEC) node scripts/ci/lint-headers.mjs

lint-docker-policy: ## Enforce the registry (no Docker Hub) + digest-pin policy on every Dockerfile
	./scripts/ci/lint-dockerfile-policy.sh

lint-security-txt: ## Validate the published RFC 9116 security.txt (fields + Expires runway)
	@bash scripts/ci/check-security-txt.sh

lint-prod-guardrails: ## Enforce the production-safety invariants (privileged-workflow alerting, fail-closed edge routing, no source maps)
	$(PM_EXEC) node scripts/ci/lint-prod-guardrails.mjs

# lint-security-txt and lint-prod-guardrails DO belong in the aggregate below,
# unlike lint-contracts and lint-metrics: both read only committed files (no
# network, no host binary, no Docker), so they are hermetic and cannot make the
# static lane flaky. lint-prod-guardrails additionally joins CI_LINT_TARGETS
# because it needs `node` + js-yaml, which the parallel ci-lint runner provides
# — the same reason main's lint-headers is in that list; lint-security-txt is
# pure bash and needs no package manager, mirroring how lint-deps stays out.
lint: lint-next lint-tsc lint-md lint-deps lint-api-versions lint-docker-policy lint-headers lint-security-txt lint-prod-guardrails ## Runs all linters: ESLint, TypeScript, Markdown, dependency-cruiser, the API version invariant, the Dockerfile registry/digest policy, the security-header gate, the RFC 9116 security.txt gate, and the production-safety guardrails in sequence.

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
	$(PM_EXEC) node scripts/contracts/lint-contracts.mjs

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

update-contracts: ## Re-fetch the user-service contracts for the pinned USER_SERVICE_VERSION and refresh the spectral baseline
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

# Host-only, and deliberately OUTSIDE `lint` and CI_LINT_TARGETS for the same
# reason as lint-metrics above: it drives `gh` against the live GitHub API, so it
# is neither hermetic nor offline-safe. AUDIT_DRY_RUN is forced to 1 here — this
# target exists to exercise the audit pipeline end to end against a real past
# release or commit, and must never write a ledger comment from a developer's
# machine. Override the target with AUDIT_EVENT=release|push|sweep and AUDIT_REF.
release-audit-dry-run: ## Dry-run the release audit against the live repo (host-only, writes nothing)
	@if [ "$${AUDIT_EVENT:-sweep}" != "sweep" ] && [ -z "$(AUDIT_REF)" ]; then \
		echo "Error: AUDIT_REF is required. Usage: make release-audit-dry-run AUDIT_EVENT=$${AUDIT_EVENT} AUDIT_REF=<tag|sha>"; \
		exit 1; \
	fi
	@AUDIT_EVENT="$${AUDIT_EVENT:-sweep}" \
	 AUDIT_RELEASE_TAG="$(AUDIT_REF)" \
	 AUDIT_AFTER="$(AUDIT_REF)" \
	 AUDIT_DRY_RUN=1 \
	 bash scripts/ci/release-audit.sh

# DELIBERATE DIVERGENCE FROM THE npm-tool LINT GATES (lint-next/tsc/md/deps),
# for the same reasons as lint-contracts and lint-metrics above:
#   * Host-only: zizmor is a Rust CLI shipped as a container image, absent from
#     the dev image, so this target does NOT use $(PM_EXEC) and runs docker on
#     the host in both modes.
#   * NOT in the `lint` aggregate and NOT in CI_LINT_TARGETS (both route through
#     the dev container / run-parallel.sh, which cannot run docker).
#   * Its online audits reach the GitHub API to resolve tags, so a GitHub
#     outage must not turn the whole static lane red.
#   * Its CI surface is .github/workflows/workflow-security.yml, which runs it
#     on every PR to main -- deliberately NOT path-filtered, because a skipped
#     check cannot be a meaningful required status check (#343).
# The script degrades to --offline when no GitHub token is available, so a
# local run without `gh auth login` still works (offline is a strict subset).
lint-workflows: ## Audit the GitHub Actions workflows for security defects with zizmor (host-only, Docker)
	@ZIZMOR_IMAGE="$(ZIZMOR_IMAGE)" \
	 ZIZMOR_MIN_SEVERITY="$(ZIZMOR_MIN_SEVERITY)" \
	 ZIZMOR_MIN_CONFIDENCE="$(ZIZMOR_MIN_CONFIDENCE)" \
	 bash scripts/ci/lint-workflows.sh

husky: ## One-time Husky setup to enable Git hooks (deprecated if already set)
	bun x husky install

storybook-start: ## Start Storybook UI and open in browser
	$(PM_EXEC) $(STORYBOOK_START)

storybook-build: ## Build Storybook UI.
	$(PM_EXEC) $(STORYBOOK_BUILD_CMD)

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

# ============================================================================
# Accessibility gate (issue #317)
# ----------------------------------------------------------------------------
# The binding conformance target is WCAG 2.1 AA; the standard, the in-scope axe
# tags and the exception process live in docs/accessibility/acceptance-standard.md.
# Two layers, both enforced:
#   * components — jest-axe over rendered React in jsdom (semantics: roles,
#     names, states, relationships).
#   * routes     — @axe-core/playwright over every registered route in real
#     browsers (everything that needs layout or paint, plus keyboard operability).
# This is a per-rule contract; the Lighthouse accessibility score is a weighted
# category heuristic on two URLs and stays as defence in depth, not a substitute.
# ============================================================================

test-a11y: test-a11y-components test-a11y-routes ## Run both accessibility gates (jest-axe components + Playwright routes)

test-a11y-components: ## Run the jest-axe component accessibility scans (TEST_ENV=client)
	# --coverage=false: this target runs one spec, and the client suite carries a
	# global coverage floor that a single-spec run cannot meet. Coverage stays
	# enforced where it belongs, on the full test-unit-client run.
	$(UNIT_TESTS) TEST_ENV=client $(JEST_BIN) $(JEST_FLAGS) --coverage=false $(TEST_A11Y_COMPONENT_SPEC)

test-a11y-routes: start-prod ## Start production and run the axe route scans (Playwright)
	$(run-a11y)

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

ci-test-integration: ## Run integration tests directly assuming deps are installed (CI entrypoint)
	env TEST_ENV=integration $(JEST_BIN) $(JEST_FLAGS)

# The contract layer (#350) boots the Mockoon mock e2e runs against — in-process,
# via @mockoon/commons-server, the same libraries Mockoon.Dockerfile's CLI wraps —
# and holds every response against the committed user-service OpenAPI document.
# It is hermetic: no network, no Docker, no compose stack, so it runs identically
# on a bare CI runner and inside the dev container. Kept OUT of the integration
# layer because that layer's charter is a global 100% coverage sweep over src/**,
# which a spec about an HTTP mock's wire format contributes nothing to.
test-contract: ## Run the mock-vs-OpenAPI contract parity layer using Jest (TEST_ENV=contract, target: tests/contract)
	$(UNIT_TESTS) TEST_ENV=contract $(JEST_BIN) $(JEST_FLAGS)

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
	ci-test-a11y ci-test-memory-leak ci-test-load ci-test-lighthouse-desktop \
	ci-test-lighthouse-mobile ci-test-prod ensure-dev start-prod-clean \
	test-a11y test-a11y-components test-a11y-routes \
	test-load test-load-swagger test-mutation-shard merge-mutation-reports \
	mutation-file-list test-mutation-changed test-e2e-burnin check-e2e-flakes \
	pr-comments lint lint-api-versions \
	lint-security-txt lint-prod-guardrails release-audit-dry-run

ci-setup: create-network ## Prepare the shared dev environment for CI-oriented checks
	$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) up $(CI_SETUP_UP_FLAGS) dev && $(MAKE) wait-for-dev

ci-lint: ## Run the CI lint phase (ESLint, TypeScript, Markdown) with grouped, aggregated output
	$(CI_LINT_RUNNER) $(CI_LINT_TARGETS)

ci-test: ## Run the CI dev-side test phase (unit client/server, integration) in parallel
	$(CI_TEST_RUNNER) $(CI_TEST_TARGETS)

ci-test-unit-client: ## Run client-side unit tests directly assuming deps are installed (CI entrypoint)
	env TEST_ENV=client $(JEST_BIN) $(JEST_FLAGS)

ci-test-unit-server: ## Run server-side unit tests directly assuming deps are installed (CI entrypoint)
	env TEST_ENV=server $(JEST_BIN) $(JEST_FLAGS) $(TEST_DIR_APOLLO)

ci-test-mutation: ## Run mutation tests directly assuming deps are installed (CI entrypoint)
	node scripts/generateLocalization.mjs
	bun x stryker run

ci-mutation: ## Run mutation testing in isolation after the parallel dev-side tests (heavy; not parallelized)
	$(MAKE) ci-test-mutation

ci-prod-setup: ## Prepare the prod + Chromium environment for prod-side CI tests
	$(MAKE) start-prod
	$(MAKE) install-chromium-lhci

ci-test-e2e: ## Run E2E tests assuming ci-prod-setup already started the prod environment
	$(run-e2e)

ci-test-visual: ## Run visual tests assuming ci-prod-setup already started the prod environment
	$(run-visual)

ci-test-a11y: ## Run the route accessibility scans assuming ci-prod-setup already started the prod environment
	$(run-a11y)

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

ci-test-prod: ## Run the CI prod-side test phase (e2e, visual, a11y, memory-leak, load, lighthouse) sequentially
	$(MAKE) ci-test-e2e
	$(MAKE) ci-test-visual
	$(MAKE) ci-test-a11y
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

test-mutation: build ## Run mutation tests using Stryker after building the app
	$(STRYKER_CMD)

mutation-file-list: ## Resolve the mutate list + gate decision for MUTATION_SCOPE (changed|full) into reports/mutation/
	MUTATION_SCOPE=$(MUTATION_SCOPE) MUTATION_BASE_REF=$(MUTATION_BASE_REF) $(MUTATION_FILE_LIST_CMD)

test-mutation-shard: ## Run mutation shard MUTATION_SHARD_INDEX of MUTATION_SHARD_TOTAL for MUTATION_SCOPE (host; assumes deps installed) — writes reports/mutation/mutation-shard-<index>.json with break disabled
	node scripts/generateLocalization.mjs
	MUTATION_SCOPE=$(MUTATION_SCOPE) \
		MUTATION_SHARD_INDEX=$(MUTATION_SHARD_INDEX) MUTATION_SHARD_TOTAL=$(MUTATION_SHARD_TOTAL) \
		$(STRYKER_CMD) $(STRYKER_SHARD_CONFIG)

merge-mutation-reports: ## Union the per-shard mutation reports and re-enforce MUTATION_SCOPE's break gate over the whole set (host; assumes deps installed)
	MUTATION_SCOPE=$(MUTATION_SCOPE) MUTATION_SHARD_TOTAL=$(MUTATION_SHARD_TOTAL) $(MERGE_MUTATION_REPORTS_CMD)

test-mutation-changed: ## Mutate only the files this branch changes against MUTATION_BASE_REF and gate on the changed-files threshold (host; assumes deps installed)
	@# Drop shard reports from an earlier run: the merge gate counts every
	@# mutation-shard-*.json in the directory, so a leftover shard 1 from a
	@# two-shard census makes this one-shard run fail as "found 2, expected 1".
	@# CI containers start clean; this keeps repeated local runs repeatable.
	rm -f reports/mutation/mutation-shard-*.json
	$(MAKE) mutation-file-list MUTATION_SCOPE=changed MUTATION_BASE_REF=$(MUTATION_BASE_REF)
	@# An empty mutate list is the `skip` decision: no mutable file changed, so
	@# there is nothing to mutate and nothing to gate on.
	@if [ ! -s reports/mutation/mutate-list.txt ]; then \
		echo "⏭️  No mutable files changed against $(MUTATION_BASE_REF); nothing to mutate."; \
	else \
		$(MAKE) test-mutation-shard MUTATION_SCOPE=changed MUTATION_SHARD_TOTAL=1 MUTATION_SHARD_INDEX=0 && \
		$(MAKE) merge-mutation-reports MUTATION_SCOPE=changed MUTATION_SHARD_TOTAL=1; \
	fi

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

install: check-node-version ## Install node modules using Bun (CI=1 runs locally, default runs in container) — uses frozen lockfile and affects node_modules via volumes
	$(PM_EXEC) bun install --frozen-lockfile

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

check-node-version: ## Check if the correct Node.js version is installed
	$(PM_EXEC) node checkNodeVersion.js

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
