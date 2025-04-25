include .env
export

DOCKER_COMPOSE      = docker compose


BIN_DIR             = ./node_modules/.bin

NEXT_BIN            = $(BIN_DIR)/next
IMG_OPTIMIZE        = $(BIN_DIR)/next-export-optimize-images
TS_BIN              = $(BIN_DIR)/tsc
STORYBOOK_BIN       = $(BIN_DIR)/storybook
JEST_BIN            = $(BIN_DIR)/jest
SERVE_BIN           = $(BIN_DIR)/serve
PLAYWRIGHT_BIN      = /app/node_modules/.bin/playwright

NEXT_BUILD          = $(NEXT_BIN) build
NEXT_BUILD_CMD      = $(NEXT_BUILD) && $(IMG_OPTIMIZE)
STORYBOOK_BUILD_CMD = $(STORYBOOK_BIN) build


TEST_DIR_BASE = ./src/test

TEST_DIR_APOLLO     = $(TEST_DIR_BASE)/apollo-server
TEST_DIR_E2E        = $(TEST_DIR_BASE)/e2e
TEST_DIR_VISUAL     = $(TEST_DIR_BASE)/visual

STRYKER_CMD         = pnpm stryker run

SERVE_CMD           = --collect.startServerCommand="$(SERVE_BIN) out"
LHCI                = pnpm lhci autorun
LHCI_CONFIG_DESKTOP = --config=lighthouserc.desktop.js
LHCI_CONFIG_MOBILE  = --config=lighthouserc.mobile.js
LHCI_DESKTOP_SERVE  = $(LHCI_CONFIG_DESKTOP) $(SERVE_CMD)
LHCI_MOBILE_SERVE   = $(LHCI_CONFIG_MOBILE) $(SERVE_CMD)

DOCKER_COMPOSE_TEST_FILE = -f docker-compose.test.yml
EXEC_DEV_TTYLESS    = $(DOCKER_COMPOSE) exec -T dev
NEXT_DEV_CMD        = $(DOCKER_COMPOSE) up -d && make wait-for-dev
PLAYWRIGHT_TEST     = $(DOCKER_COMPOSE) $(DOCKER_COMPOSE_TEST_FILE) exec playwright sh -c


K6_TEST_SCRIPT      ?= /loadTests/homepage.js
K6_RESULTS_FILE     ?= /loadTests/results/homepage.html
K6                  = $(DOCKER_COMPOSE) $(DOCKER_COMPOSE_TEST_FILE) --profile load run --rm k6
LOAD_TESTS_RUN      = $(K6) run --summary-trend-stats="avg,min,med,max,p(95),p(99)" --out "web-dashboard=period=1s&export=$(K6_RESULTS_FILE)" $(K6_TEST_SCRIPT)

UI_FLAGS            = --ui-port=$(UI_TEST_PORT) --ui-host=$(UI_HOST)
UI_MODE_URL         = http://localhost:$(UI_TEST_PORT)

# Markdown linter ignore patterns (-i means "ignore")
MD_LINT_ARGS        = -i CHANGELOG.md -i "test-results/**/*.md" -i "playwright-report/data/**/*.md"

JEST_FLAGS          = --verbose

# CI variable
CI                  ?= 0

# Conditional PNPM_EXEC based on CI
ifeq ($(CI), 1)
    PNPM_EXEC       = pnpm
    NEXT_DEV_CMD    = $(NEXT_BIN) dev
    UNIT_TESTS      = env

    STORYBOOK_START = $(STORYBOOK_BIN) dev -p $(STORYBOOK_PORT)

    LHCI_BUILD_CMD  = $(NEXT_BUILD_CMD) && $(LHCI)
    LHCI_DESKTOP    = $(LHCI_BUILD_CMD) $(LHCI_DESKTOP_SERVE)
    LHCI_MOBILE     = $(LHCI_BUILD_CMD) $(LHCI_MOBILE_SERVE)
else
    PNPM_EXEC       = $(EXEC_DEV_TTYLESS)
    STRYKER_CMD     = make start && $(EXEC_DEV_TTYLESS) pnpm stryker run
    UNIT_TESTS      = make start && $(EXEC_DEV_TTYLESS) env

    STORYBOOK_START = exec $(STORYBOOK_BIN) dev -p $(STORYBOOK_PORT) --host 0.0.0.0

    LHCI_BUILD_CMD  = make start-prod && $(LHCI)
    LHCI_DESKTOP    = $(LHCI_BUILD_CMD) $(LHCI_CONFIG_DESKTOP)
    LHCI_MOBILE     = $(LHCI_BUILD_CMD) $(LHCI_CONFIG_MOBILE)
endif

PRETTIER_BIN        = $(PNPM_EXEC) ./node_modules/.bin/prettier
MARKDOWNLINT_BIN    = $(PNPM_EXEC) ./node_modules/.bin/markdownlint

# To Run in CI mode specify CI variable. Example: make lint-md CI=1

# Misc
.DEFAULT_GOAL       = help
.RECIPEPREFIX       +=
.PHONY: $(filter-out node_modules,$(MAKECMDGOALS))

# Variables
run-visual          = $(PLAYWRIGHT_TEST) "$(PLAYWRIGHT_BIN) test $(TEST_DIR_VISUAL)"
run-e2e             = $(PLAYWRIGHT_TEST) "$(PLAYWRIGHT_BIN) test $(TEST_DIR_E2E)"

help:
	@printf "\033[33mUsage:\033[0m\n  make [target] [arg=\"val\"...]\n\n\033[33mTargets:\033[0m\n"
	@grep -E '^[-a-zA-Z0-9_\.\/]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[32m%-15s\033[0m %s\n", $$1, $$2}'

start: ## Start the application
	$(NEXT_DEV_CMD)

wait-for-dev: ## Wait for the dev service to be ready on port $(DEV_PORT).
	@echo "Waiting for dev service to be ready on port $(DEV_PORT).."
	npx wait-on -v http://localhost:$(DEV_PORT)
	@echo "Dev service is up and running!"

build: ## A tool build the project
	$(DOCKER_COMPOSE) build

build-analyze: ## Build production bundle and launch bundle-analyzer report (ANALYZE=true)
	ANALYZE=true $(NEXT_BUILD_CMD)

format: ## This command executes Prettier formatting
	$(PRETTIER_BIN) "**/*.{js,jsx,ts,tsx,json,css,scss,md}" --write --ignore-path .prettierignore

lint-next: ## This command executes ESLint
	$(PNPM_EXEC) $(NEXT_BIN) lint

lint-tsc: ## This command executes Typescript linter
	$(PNPM_EXEC) $(TS_BIN)

lint-md: ## This command executes Markdown linter
	$(MARKDOWNLINT_BIN) $(MD_LINT_ARGS) "**/*.md"

lint: lint-next lint-tsc lint-md ## Runs all linters: ESLint, TypeScript, and Markdown linters in sequence.

husky: ## One-time Husky setup to enable Git hooks (deprecated if already set)
	pnpm husky install

storybook-start: ## Start Storybook UI and open in browser
	$(PNPM_EXEC) $(STORYBOOK_START)

storybook-build: ## Build Storybook UI.
	$(PNPM_EXEC) $(STORYBOOK_BUILD_CMD)

test-e2e: start-prod  ## Start production and run E2E tests (Playwright)
	$(run-e2e)

test-e2e-ui: start-prod ## Start the production environment and run E2E tests with the UI available at $(UI_MODE_URL)
	@echo "🚀 Starting Playwright UI tests..."
	@echo "Test will be run on: $(UI_MODE_URL)"
	$(run-e2e) $(UI_FLAGS)

test-visual: start-prod  ## Start production and run visual tests (Playwright)
	$(run-visual)

test-visual-ui: start-prod ## Start the production environment and run visual tests with the UI available at $(UI_MODE_URL)
	@echo "🚀 Starting Playwright UI tests..."
	@echo "Test will be run on: $(UI_MODE_URL)"
	$(run-visual) $(UI_FLAGS)

test-visual-update: start-prod ## Update Playwright visual snapshots
	$(PLAYWRIGHT_TEST) $(TEST_DIR_VISUAL) --update-snapshots

start-prod: ## Build image and start container in production mode
	$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_TEST_FILE) up -d && make wait-for-prod

wait-for-prod: ## Wait for the prod service to be ready on port $(NEXT_PUBLIC_PROD_PORT).
	@echo "Waiting for prod service to be ready on port $(NEXT_PUBLIC_PROD_PORT)..."
	npx wait-on -v http://localhost:$(NEXT_PUBLIC_PROD_PORT)
	@echo "Prod service is up and running!"

test-unit-all: test-unit-client test-unit-server ## This command executes unit tests for both client and server environments.

test-unit-client: ## Run all client-side unit tests using Jest (Next.js env, TEST_ENV=client)
	$(UNIT_TESTS) TEST_ENV=client $(JEST_BIN) $(JEST_FLAGS)

test-unit-server: ## Run server-side unit tests for Apollo using Jest (Node.js env, TEST_ENV=server, target: $(TEST_DIR_APOLLO))
	$(UNIT_TESTS) TEST_ENV=server $(JEST_BIN) $(JEST_FLAGS) $(TEST_DIR_APOLLO)

test-memory-leak: start-prod ## This command executes memory leaks tests using Memlab library.
	@echo "🧪 Starting memory leak test environment..."
	$(DOCKER_COMPOSE) -f docker-compose.memory-leak.yml up -d || (echo "Failed to start memory leak container" && exit 1)

test-mutation: build ## Run mutation tests using Stryker after building the app
	$(STRYKER_CMD)

load-tests: start-prod ## This command executes load tests using K6 library. Note: The target host is determined by the service URL
                       ## using $(NEXT_PUBLIC_PROD_PORT), which maps to the production service in Docker Compose.
	$(LOAD_TESTS_RUN)

lighthouse-desktop: ## Run a Lighthouse audit using desktop viewport settings to evaluate performance and best practices
	$(LHCI_DESKTOP)

lighthouse-mobile: ## Run a Lighthouse audit using mobile viewport settings to evaluate mobile UX and performance
	$(LHCI_MOBILE)

install: ## Install node modules using pnpm (CI=1 runs locally, default runs in container) — uses frozen lockfile and affects node_modules via volumes
	$(PNPM_EXEC) pnpm install --frozen-lockfile

update: ## Update node modules to latest allowed versions — always runs locally, updates lockfile (run before committing dependency changes)
	pnpm update

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
	$(PNPM_EXEC) node checkNodeVersion.js

