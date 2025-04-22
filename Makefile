# Parameters
PROJECT	= frontend-ssr-template

K6 = $(DOCKER) run -v ./src/test/load:/loadTests --net=host --rm k6 run --summary-trend-stats="avg,min,med,max,p(95),p(99)"

K6_TEST_SCRIPT ?= /loadTests/homepage.js
K6_RESULTS_DIR ?= /loadTests/results
K6_RESULTS_FILE ?= $(K6_RESULTS_DIR)/homepage.html

# Executables: local only
PNPM_BIN		= pnpm
DOCKER			= docker
DOCKER_COMPOSE	= docker compose
MAKE 			= make

NEXT_BIN = ./node_modules/.bin/next
IMG_OPTIMIZE = ./node_modules/.bin/next-export-optimize-images
TS_BIN = ./node_modules/.bin/tsc
DOCKER_COMPOSE_TEST_FILE = docker-compose.test.yml
STORYBOOK_BIN = ./node_modules/.bin/storybook
MD_LINT_IGNORE_PATTERN = -i CHANGELOG.md **/*.md
JEST_BIN = ./node_modules/.bin/jest
DOCKER_COMPOSE_FILE = docker-compose.test.yml
JEST_FLAGS = --verbose

NEXT_BUILD = $(NEXT_BIN) build
NEXT_BUILD_CMD = $(NEXT_BUILD) && $(IMG_OPTIMIZE)
PRETTIER_BIN = $(PNPM_EXEC) ./node_modules/.bin/prettier
MARKDOWNLINT_BIN = $(PNPM_EXEC) ./node_modules/.bin/markdownlint
TEST_DIR_APOLLO = ./src/test/apollo-server
TEST_DIR_E2E = ./src/test/e2e
TEST_DIR_VISUAL = ./src/test/visual
STRYKER_CMD = $(PNPM_BIN) stryker run

SERVE_CMD = --collect.startServerCommand="npx serve out"
LHCI = $(PNPM_BIN) lhci autorun

NEXT_DEV_CMD     = $(DOCKER_COMPOSE) up -d && make wait-for-dev
EXEC_DEV	= $(DOCKER_COMPOSE) exec -T dev
PLAYWRIGHT_BASE_CMD = pnpm exec playwright test
PLAYWRIGHT_TEST = $(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) exec playwright $(PLAYWRIGHT_BASE_CMD)
BUILD_K6_DOCKER = $(MAKE) build-k6-docker
LOAD_TESTS_RUN = $(K6) --out "web-dashboard=period=1s&export=$(K6_RESULTS_FILE)" $(K6_TEST_SCRIPT)

PROD_PORT = 3001
STORYBOOK_PORT = 6006
DEV_PORT = 3000
UI_PORT = 9324
UI_HOST = 0.0.0.0
UI_FLAGS = --ui-port=$(UI_PORT) --ui-host=$(UI_HOST)
UI_MODE_URL = http://localhost:$(UI_PORT)

# Executables
PNPM      	= $(EXEC_DEV) pnpm
PNPM_RUN    = $(PNPM) run
GIT         = git

# CI variable
CI ?= 0

# Conditional PNPM_EXEC based on CI
ifeq ($(CI), 1)
    PNPM_EXEC = $(PNPM_BIN)
	PLAYWRIGHT_EXEC = $(PNPM_EXEC)
	NEXT_DEV_CMD = $(NEXT_BIN) dev

    STORYBOOK_START = $(STORYBOOK_BIN) dev -p $(STORYBOOK_PORT)

    LHCI_BUILD_CMD = $(NEXT_BUILD_CMD) && $(LHCI)
	LHCI_DESKTOP = $(LHCI_BUILD_CMD) --config=lighthouserc.desktop.js $(SERVE_CMD)
    LHCI_MOBILE = $(LHCI_BUILD_CMD) --config=lighthouserc.mobile.js $(SERVE_CMD)
else
    PNPM_EXEC = $(EXEC_DEV)
	PLAYWRIGHT_EXEC = $(DOCKER) exec website-playwright-1 pnpm run
	EXEC_DEV_TTYLESS = $(DOCKER_COMPOSE) exec -T dev
	STRYKER_CMD = make start && $(EXEC_DEV) pnpm stryker run
	UNIT_TESTS =  make start && $(DOCKER_COMPOSE) exec -T dev env

	STORYBOOK_START = exec $(STORYBOOK_BIN) dev -p $(STORYBOOK_PORT) --host 0.0.0.0

    LHCI_BUILD_CMD = make start-prod && $(LHCI)
	LHCI_DESKTOP = $(LHCI_BUILD_CMD) --config=lighthouserc.desktop.js
    LHCI_MOBILE = $(LHCI_BUILD_CMD) --config=lighthouserc.mobile.js
endif

# To Run in CI mode specify CI variable. Example: make lint-md CI=1

# Misc
.DEFAULT_GOAL = help
.RECIPEPREFIX +=
.PHONY: $(filter-out node_modules,$(MAKECMDGOALS))

# Variables
REPORT_FILENAME ?= default_value
TSC_FLAGS ?= --newLine LF --strict --noUnusedLocals --noUnusedParameters

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

build-analyze: ## Build with bundle analyzer enabled (ANALYZE=true)
	ANALYZE=true $(NEXT_BUILD_CMD)

format: ## This command executes Prettier formatting
	$(PRETTIER_BIN) "**/*.{js,jsx,ts,tsx,json,css,scss,md}" --write --ignore-path .prettierignore

lint-next: ## This command executes ESLint
	$(EXEC_DEV_TTYLESS) $(NEXT_BIN) lint

lint-tsc: ## This command executes Typescript linter
	$(PNPM_EXEC) $(TS_BIN) $(TSC_FLAGS)

lint-md: ## This command executes Markdown linter
	$(MARKDOWNLINT_BIN) $(MD_LINT_IGNORE_PATTERN)

git-hooks-install: ## Install git hooks
	 $(PNPM_BIN) husky install

storybook-start: ## Start Storybook UI and open in browser
	$(PNPM_BIN) $(STORYBOOK_START)

storybook-build: ## Build Storybook UI.
	$(PNPM_EXEC) $(STORYBOOK_BIN) build

test-e2e: start-prod  ## Start production and run E2E tests
	$(PLAYWRIGHT_TEST) $(TEST_DIR_E2E)

test-e2e-ui: start-prod ## Start the production environment and run E2E tests with the UI available at http://localhost:9324
	@echo "🚀 Starting Playwright UI tests..."
	@echo "Test will be run on: $(UI_MODE_URL)"
	$(PLAYWRIGHT_TEST) $(TEST_DIR_E2E) $(UI_FLAGS)

test-visual: start-prod  ## Start production and run visual tests
	$(PLAYWRIGHT_TEST) $(TEST_DIR_VISUAL)

test-visual-ui: start-prod ## Start the production environment and run visual tests with the UI available at http://localhost:9324
	@echo "🚀 Starting Playwright UI tests..."
	@echo "Test will be run on: $(UI_MODE_URL)"
	$(PLAYWRIGHT_TEST) $(TEST_DIR_VISUAL) $(UI_FLAGS)

test-visual-update: ## Update Playwright visual snapshots
	$(PLAYWRIGHT_TEST) $(TEST_DIR_VISUAL) --update-snapshots

start-prod: ## Build image and start container in production mode
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_TEST_FILE) up -d && make wait-for-prod

wait-for-prod: ## Wait for the prod service to be ready on port $(PROD_PORT).
	@echo "Waiting for prod service to be ready on port $(PROD_PORT)..."
	npx wait-on -v http://localhost:$(PROD_PORT)
	@echo "Prod service is up and running!"

test-unit-all: test-unit-client test-unit-server ## This command executes unit tests for both client and server environments.

test-unit-client: ## This command executes unit tests using Jest library.
	$(UNIT_TESTS) TEST_ENV=client $(JEST_BIN) $(JEST_FLAGS)

test-unit-server: ## This command executes unit tests using Jest library.
	$(UNIT_TESTS) TEST_ENV=server $(JEST_BIN) $(JEST_FLAGS) $(TEST_DIR_APOLLO)

test-memory-leak: start-prod ## This command executes memory leaks tests using Memlab library.
	@echo "🧪 Starting memory leak test environment..."
	$(DOCKER_COMPOSE) -f docker-compose.memory-leak.yml up -d || (echo "Failed to start memory leak container" && exit 1)

test-mutation:  ## Run mutation tests using Stryker after building the app
	$(STRYKER_CMD)

build-k6-docker: ## This command build K6 image
	$(DOCKER) build -t k6 -f ./src/test/load/Dockerfile .

load-tests: start-prod ## This command executes load tests using K6 library.
	$(BUILD_K6_DOCKER)
	$(LOAD_TESTS_RUN)

lighthouse-desktop: ## Run a Lighthouse audit using the desktop configuration
	$(LHCI_DESKTOP)

lighthouse-mobile: ## Run a Lighthouse audit using the mobile configuration
	$(LHCI_MOBILE)

install: ## Install node modules (frozen lockfile)
	$(PNPM_EXEC) pnpm install --frozen-lockfile

update: ## Update node modules according to the current package.json file
	 pnpm update

down: ## Stop the docker hub
	$(DOCKER_COMPOSE) down --remove-orphans

sh: ## Log to the docker container
	$(DOCKER_COMPOSE) exec dev sh

ps: ## Log to the docker container
	@$(DOCKER_COMPOSE) ps

logs: ## Show all logs
	@$(DOCKER_COMPOSE) logs --follow dev

new-logs: ## Show live logs of the dev container
	@$(DOCKER_COMPOSE) logs --tail=0 --follow

stop: ## Stop docker
	$(DOCKER_COMPOSE) stop

check-node-version: ## Check if the correct Node.js version is installed
	$(EXEC_DEV_TTYLESS) node checkNodeVersion.js

