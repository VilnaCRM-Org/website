# Parameters
PROJECT	= frontend-ssr-template
K6 = $(DOCKER) run -v ./src/test/load:/loadTests --net=host --rm k6 run --summary-trend-stats="avg,min,med,max,p(95),p(99)"
K6_BIN = ./k6

# Executables: local only
PNPM_BIN		= pnpm
DOCKER			= docker
DOCKER_COMPOSE	= docker compose
MAKE 			= make

NEXT_BIN = ./node_modules/.bin/next
NEXT_BUILD = $(NEXT_BIN) build
IMG_OPTIMIZE = ./node_modules/.bin/next-export-optimize-images
NEXT_BUILD_CMD = $(NEXT_BUILD) && $(IMG_OPTIMIZE)
TS_BIN = ./node_modules/.bin/tsc

SERVE_CMD = --collect.startServerCommand="npx serve out"
LHCI = pnpm lhci autorun

DEV_ENV     = $(DOCKER_COMPOSE) up -d
EXEC_DEV	= $(DOCKER_COMPOSE) exec dev
PNPM_CMD    = $(PNPM_BIN)
BUILD       = $(NEXT_BUILD)
EXEC_DEV_TTYLESS =
UNIT_TESTS =
PLAYWRIGHT_TEST = $(DOCKER_COMPOSE) -f docker-compose.test.yml exec playwright pnpm exec playwright test

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
	LHCI_DESKTOP = $(NEXT_BUILD_CMD) && $(LHCI) --config=lighthouserc.desktop.js $(SERVE_CMD)
    LHCI_MOBILE = $(NEXT_BUILD_CMD) && $(LHCI) --config=lighthouserc.mobile.js $(SERVE_CMD)
	LOAD_TESTS_RUN = $(K6_BIN) run --summary-trend-stats="avg,min,med,max,p(95),p(99)" --out "web-dashboard=period=1s&export=./src/test/load/results/index.html" ./src/test/load/homepage.js
	BUILD_K6_DOCKER =
	DEV_ENV = $(NEXT_BIN) dev
else
    PNPM_EXEC = $(EXEC_DEV)
	PLAYWRIGHT_EXEC = $(DOCKER) exec website-playwright-1 pnpm run
	LHCI_DESKTOP = make start-prod && make wait-for-prod && $(LHCI) --config=lighthouserc.desktop.js
    LHCI_MOBILE = make start-prod && make wait-for-prod && $(LHCI) --config=lighthouserc.mobile.js
	LOAD_TESTS_RUN = $(K6) --out 'web-dashboard=period=1s&export=/loadTests/results/homepage.html' /loadTests/homepage.js
	BUILD_K6_DOCKER = $(MAKE) build-k6-docker
	BUILD = $(EXEC_DEV) $(NEXT_BUILD)
	EXEC_DEV_TTYLESS = $(DOCKER_COMPOSE) exec -T dev
	PNPM_CMD = $(DOCKER_COMPOSE) exec -T dev
	UNIT_TESTS = $(EXEC_DEV) env
endif

# To Run in CI mode specify CI variable. Example: make lint-md CI=1

# Misc
.DEFAULT_GOAL = help
.RECIPEPREFIX +=
.PHONY: $(filter-out node_modules,$(MAKECMDGOALS))

# Variables
REPORT_FILENAME ?= default_value
TSC_FLAGS ?= --newLine LF --strict

help:
	@printf "\033[33mUsage:\033[0m\n  make [target] [arg=\"val\"...]\n\n\033[33mTargets:\033[0m\n"
	@grep -E '^[-a-zA-Z0-9_\.\/]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[32m%-15s\033[0m %s\n", $$1, $$2}'

start: ## Start the application
	$(DEV_ENV)

build: ## A tool build the project
	${BUILD}

build-analyze:
	ANALYZE=true $(NEXT_BUILD_CMD)

format: ## This command executes Prettier Formating
	$(PNPM_CMD) ./node_modules/.bin/prettier "**/*.{js,jsx,ts,tsx,json,css,scss,md}" --write --ignore-path .prettierignore

lint-next: ## This command executes ESLint
	$(EXEC_DEV_TTYLESS) $(NEXT_BIN) lint

lint-tsc: ## This command executes Typescript linter
	$(PNPM_CMD) $(TS_BIN) $(TSC_FLAGS)

lint-md: ## This command executes Markdown linter
	$(PNPM_CMD) ./node_modules/.bin/markdownlint -i CHANGELOG.md **/*.md

git-hooks-install: ## Install git hooks
	 $(PNPM_BIN) husky install

storybook-start: ## Start Storybook UI. Storybook is a frontend workshop for building UI components and pages in isolation.
	$(PNPM_EXEC) ./node_modules/.bin/storybook dev -p 6006

storybook-build: ## Build Storybook UI. Storybook is a frontend workshop for building UI components and pages in isolation.
	$(PNPM_EXEC) ./node_modules/.bin/storybook build

test-e2e: start-prod wait-for-prod  ## Start production and run E2E tests
	$(PLAYWRIGHT_TEST) ./src/test/e2e

test-e2e-ui: start-prod wait-for-prod  ## Start the production environment and run E2E tests with the UI available at http://localhost:9324
	$(PLAYWRIGHT_TEST) ./src/test/e2e --ui-port=9324 --ui-host=0.0.0.0

test-visual: start-prod wait-for-prod  ## Start production and run visual tests
	$(PLAYWRIGHT_TEST) ./src/test/visual

test-visual-ui: start-prod wait-for-prod  ## Start the production environment and run visual tests with the UI available at http://localhost:9324
	$(PLAYWRIGHT_TEST) ./src/test/visual --ui-port=9324 --ui-host=0.0.0.0

test-visual-update:
	$(PLAYWRIGHT_TEST) ./src/test/visual --update-snapshots

start-prod: ## Build image and start container in production mode
	$(DOCKER_COMPOSE) -f docker-compose.test.yml up -d

wait-for-prod: ## Wait for the prod service to be ready on port 3001.
	@echo "Waiting for prod service to be ready on port 3001..."
	npx wait-on -v http://localhost:3001
	@echo "Prod service is up and running!"

test-unit-all: test-unit-client test-unit-server ## This command executes unit tests for both client and server environments.

test-unit-client: ## This command executes unit tests using Jest library.
	$(UNIT_TESTS) TEST_ENV=client ./node_modules/.bin/jest --verbose

test-unit-server: ## This command executes unit tests using Jest library.
	$(UNIT_TESTS) TEST_ENV=server ./node_modules/.bin/jest --verbose ./src/test/apollo-server

test-memory-leak: start-prod wait-for-prod ## This command executes memory leaks tests using Memlab library.
	$(DOCKER_COMPOSE) -f docker-compose.memory-leak.yml up -d || (echo "Failed to start memory leak container" && exit 1)

test-mutation:
	./node_modules/.bin/stryker run

build-k6-docker: ## This command build K6 image
	$(DOCKER) build -t k6 -f ./src/test/load/Dockerfile .

load-tests: start-prod wait-for-prod ## This command executes load tests using K6 library.
	$(BUILD_K6_DOCKER)
	$(LOAD_TESTS_RUN)

lighthouse-desktop: ## Run a Lighthouse audit using the desktop configuration
	$(LHCI_DESKTOP)

lighthouse-mobile: ## Run a Lighthouse audit using the mobile configuration
	$(LHCI_MOBILE)

install: ## Install node modules according to the current pnpm-lock.yaml file
	$(PNPM_BIN) install --frozen-lockfile

update: ## Update node modules according to the current package.json file
	$(PNPM_BIN) update

down: ## Stop the docker hub
	$(DOCKER_COMPOSE) down --remove-orphans

sh: ## Log to the docker container
	@$(EXEC_DEV) sh

ps: ## Log to the docker container
	@$(DOCKER_COMPOSE) ps

logs: ## Show all logs
	@$(DOCKER_COMPOSE) logs --follow

new-logs: ## Show live logs of the dev container
	@$(DOCKER_COMPOSE) logs --tail=0 --follow

stop: ## Stop docker
	$(DOCKER_COMPOSE) stop


check-node-version: ## Check if the correct Node.js version is installed
	$(EXEC_DEV) node checkNodeVersion.js
