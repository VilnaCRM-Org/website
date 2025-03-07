# Parameters
PROJECT	= frontend-ssr-template
K6 = $(DOCKER) run -v ./src/test/load:/loadTests --net=host --rm k6 run --summary-trend-stats="avg,min,med,max,p(95),p(99)"
K6_BIN = ./k6

# Executables: local only
PNPM_BIN		= pnpm
DOCKER			= docker
DOCKER_COMPOSE	= docker compose
MAKE 			= make

# Executables
EXEC_NODEJS	= $(DOCKER_COMPOSE) exec prod
PNPM      	= $(EXEC_NODEJS) pnpm
PNPM_RUN    = $(PNPM) run
GIT         = git

# CI variable
CI ?= 0

# Conditional PNPM_EXEC based on CI
ifeq ($(CI), 1)
    PNPM_EXEC = $(PNPM_BIN)
	LHCI_DESKTOP = lighthouse:desktop-autorun
	LHCI_MOBILE = lighthouse:mobile-autorun
	PLAYWRIGHT_EXEC = $(PNPM_EXEC)
	LOAD_TESTS_RUN = $(K6_BIN) run --summary-trend-stats="avg,min,med,max,p(95),p(99)" --out "web-dashboard=period=1s&export=./src/test/load/results/index.html" ./src/test/load/homepage.js
	BUILD_K6_DOCKER =
else
    PNPM_EXEC = $(PNPM_RUN)
	LHCI_DESKTOP = lighthouse:desktop
	LHCI_MOBILE = lighthouse:mobile
	PLAYWRIGHT_EXEC = $(DOCKER) exec website-playwright-1 pnpm run
	LOAD_TESTS_RUN = $(K6) --out 'web-dashboard=period=1s&export=/loadTests/results/homepage.html' /loadTests/homepage.js
	BUILD_K6_DOCKER = $(MAKE) build-k6-docker
endif

# To Run in CI mode specify CI variable. Example: make lint-md CI=1

# Misc
.DEFAULT_GOAL = help
.RECIPEPREFIX +=
.PHONY: $(filter-out node_modules,$(MAKECMDGOALS))

# Variables
REPORT_FILENAME ?= default_value

help:
	@printf "\033[33mUsage:\033[0m\n  make [target] [arg=\"val\"...]\n\n\033[33mTargets:\033[0m\n"
	@grep -E '^[-a-zA-Z0-9_\.\/]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[32m%-15s\033[0m %s\n", $$1, $$2}'

build: ## A tool build the project
	$(PNPM_EXEC) build

format: ## This command executes Prettier Formating
	$(PNPM_EXEC) format

lint-next: ## This command executes ESLint
	$(PNPM_EXEC) lint:next

lint-tsc: ## This command executes Typescript linter
	$(PNPM_EXEC) lint:tsc

lint-md: ## This command executes Markdown linter
	$(PNPM_EXEC) lint:md

git-hooks-install: ## Install git hooks
	$(PNPM_EXEC) prepare

storybook-start: ## Start Storybook UI. Storybook is a frontend workshop for building UI components and pages in isolation.
	$(PNPM_EXEC) storybook

storybook-build: ## Build Storybook UI. Storybook is a frontend workshop for building UI components and pages in isolation.
	$(PNPM_EXEC) build-storybook

generate-ts-doc: ## This command generates documentation from the typescript files.
	$(PNPM_EXEC) doc

test-e2e: start-prod diagnose-prod wait-for-prod  ## Start production and run E2E tests
	$(DOCKER_COMPOSE) -f docker-compose.test.yml exec playwright pnpm run test:e2e

test-visual: start-prod wait-for-prod  ## Start production and run visual tests
	$(DOCKER_COMPOSE) -f docker-compose.test.yml exec playwright pnpm run test:visual

start-prod: ## Build image and start container in production mode
	$(DOCKER_COMPOSE) -f docker-compose.test.yml up -d

wait-for-prod: ## Wait for the prod service to be ready on port 3001.
	@echo "Waiting for prod service to be ready on port 3001..."
	npx wait-on -v http://localhost:3001
	@echo "Prod service is up and running!"

diagnose-prod: ## Run diagnostics on the prod container
	@echo "Checking prod container logs..."
	docker logs website-prod-1
	@echo "\nChecking container status..."
	docker ps -a | grep website-prod-1
	@echo "\nChecking if process is listening on port 3001..."
	docker exec website-prod-1 netstat -tulpn | grep 3001 || echo "No process found listening on port 3001"
	@echo "\nChecking resource usage..."
	docker stats website-prod-1 --no-stream

test-unit: ## This command executes unit tests using Jest library.
	$(PNPM_EXEC) test:unit

test-all: start-prod wait-for-prod  ## Start production and run all tests
	$(DOCKER_COMPOSE) -f docker-compose.test.yml exec playwright sh -c 'pnpm run test:e2e & pnpm run test:visual & wait'

test-memory-leak: start-prod wait-for-prod ## This command executes memory leaks tests using Memlab library.
	$(DOCKER_COMPOSE) -f docker-compose.memory-leak.yml up -d || (echo "Failed to start memory leak container" && exit 1)

test-mutation:
	$(PNPM_EXEC) test:mutation

build-k6-docker: ## This command build K6 image
	$(DOCKER) build -t k6 -f ./src/test/load/Dockerfile .

load-tests: start-prod wait-for-prod ## This command executes load tests using K6 library.
	$(BUILD_K6_DOCKER)
	$(LOAD_TESTS_RUN)

lighthouse-desktop: ## This command executes Lighthouse tests for desktop.
	$(PNPM_EXEC) $(LHCI_DESKTOP)

lighthouse-mobile: ## This command executes Lighthouse tests for mobile.
	$(PNPM_EXEC) $(LHCI_MOBILE)

install: ## Install node modules according to the current pnpm-lock.yaml file
	$(PNPM_BIN) install --frozen-lockfile

update: ## Update node modules according to the current package.json file
	$(PNPM_EXEC) update

up: ## Start the docker hub (Nodejs)
	$(DOCKER_COMPOSE) up -d

down: ## Stop the docker hub
	$(DOCKER_COMPOSE) down --remove-orphans

sh: ## Log to the docker container
	@$(EXEC_NODEJS) sh

ps: ## Log to the docker container
	@$(DOCKER_COMPOSE) ps

logs: ## Show all logs
	@$(DOCKER_COMPOSE) logs --follow

new-logs: ## Show live logs
	@$(DOCKER_COMPOSE) logs --tail=0 --follow

start: up ## Start docker

stop: ## Stop docker
	$(DOCKER_COMPOSE) stop
