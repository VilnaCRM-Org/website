# Parameters
PROJECT	= frontend-ssr-template
K6 = $(DOCKER) run -v ./src/test/load:/loadTests --net=host --rm k6 run --summary-trend-stats="avg,min,med,max,p(95),p(99)"
K6_BIN = ./k6

# Executables: local only
PNPM_BIN		= pnpm
DOCKER			= docker
DOCKER_COMPOSE	= docker compose
MAKE 			= make

NEXT_BIN = ./node_modules/.bin/next     # Path to Next.js binary for direct command execution
NEXT_BUILD = $(NEXT_BIN) build          # Command to build Next.js application
IMG_OPTIMIZE = ./node_modules/.bin/next-export-optimize-images   # Tool for optimizing exported images
NEXT_BUILD_CMD = $(NEXT_BUILD) && $(IMG_OPTIMIZE)  # Full build command including image optimization
TS_BIN = ./node_modules/.bin/tsc        # Path to TypeScript compiler binary

SERVE_CMD = --collect.startServerCommand="npx serve out"           # Command for serving the built application during testing
LHCI = pnpm lhci autorun                                           # Lighthouse CI command for performance testing

# Executables
EXEC_NODEJS	=
PNPM      	= $(EXEC_NODEJS) pnpm
PNPM_RUN    = $(PNPM) run
GIT         = git

# CI variable
CI ?= 0

# Conditional PNPM_EXEC based on CI
ifeq ($(CI), 1)
    PNPM_EXEC = $(PNPM_BIN)
	EXEC_NODEJS	= $(DOCKER_COMPOSE) exec prod
	PLAYWRIGHT_EXEC = $(PNPM_EXEC)
	LOAD_TESTS_RUN = $(K6_BIN) run --summary-trend-stats="avg,min,med,max,p(95),p(99)" --out "web-dashboard=period=1s&export=./src/test/load/results/index.html" ./src/test/load/homepage.js
	BUILD_K6_DOCKER =
else
    PNPM_EXEC = $(PNPM_RUN)
	PLAYWRIGHT_EXEC = $(DOCKER) exec website-playwright-1 pnpm run
	LOAD_TESTS_RUN = $(K6) --out 'web-dashboard=period=1s&export=/loadTests/results/homepage.html' /loadTests/homepage.js
	BUILD_K6_DOCKER = $(MAKE) build-k6-docker
	EXEC_NODEJS	= $(DOCKER_COMPOSE) exec dev
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

build: ## A tool build the project
	$(PNPM_EXEC) $(NEXT_BUILD)

build-analyze:
	ANALYZE=true $(NEXT_BUILD_CMD)

format: ## This command executes Prettier Formating
	$(PNPM_EXEC) ./node_modules/.bin/prettier "**/*.{js,jsx,ts,tsx,json,css,scss,md}" --write --ignore-path .prettierignore

lint-next: ## This command executes ESLint
	$(NEXT_BIN) lint

lint-tsc: ## This command executes Typescript linter
	$(PNPM_EXEC) $(TS_BIN) $(TSC_FLAGS)

lint-md: ## This command executes Markdown linter
	$(PNPM_EXEC) ./node_modules/.bin/markdownlint -i CHANGELOG.md **/*.md

git-hooks-install: ## Install git hooks
	$(PNPM_EXEC) husky install

storybook-start: ## Start Storybook UI. Storybook is a frontend workshop for building UI components and pages in isolation.
	$(PNPM_EXEC) ./node_modules/.bin/storybook dev -p 6006

storybook-build: ## Build Storybook UI. Storybook is a frontend workshop for building UI components and pages in isolation.
	$(PNPM_EXEC) ./node_modules/.bin/storybook build

test-e2e: start-prod wait-for-prod  ## Start production and run E2E tests
	$(DOCKER_COMPOSE) -f docker-compose.test.yml exec playwright pnpm exec playwright test ./src/test/e2e

test-visual: start-prod wait-for-prod  ## Start production and run visual tests
	$(DOCKER_COMPOSE) -f docker-compose.test.yml exec playwright pnpm exec playwright test ./src/test/visual

test-visual-update:
	$(DOCKER_COMPOSE) -f docker-compose.test.yml exec playwright pnpm exec playwright test ./src/test/visual --update-snapshots

start-prod: ## Build image and start container in production mode
	$(DOCKER_COMPOSE) -f docker-compose.test.yml up -d

wait-for-prod: ## Wait for the prod service to be ready on port 3001.
	@echo "Waiting for prod service to be ready on port 3001..."
	npx wait-on -v http://localhost:3001
	@echo "Prod service is up and running!"

test-unit: ## This command executes unit tests using Jest library.
	TEST_ENV=client ./node_modules/.bin/jest --verbose

test-unit-all: ## This command executes unit tests for both client and server environments.
	TEST_ENV=client ./node_modules/.bin/jest --verbose && TEST_ENV=server ./node_modules/.bin/jest --verbose

test-memory-leak: start-prod wait-for-prod ## This command executes memory leaks tests using Memlab library.
	$(DOCKER_COMPOSE) -f docker-compose.memory-leak.yml up -d || (echo "Failed to start memory leak container" && exit 1)

test-mutation:
	./node_modules/.bin/stryker run

build-k6-docker: ## This command build K6 image
	$(DOCKER) build -t k6 -f ./src/test/load/Dockerfile .

load-tests: start-prod wait-for-prod ## This command executes load tests using K6 library.
	$(BUILD_K6_DOCKER)
	$(LOAD_TESTS_RUN)

lighthouse-desktop:  ## Full desktop audit (build + optimize + serve + lhci)
	$(NEXT_BUILD_CMD) && $(LHCI) --config=lighthouserc.desktop.js $(SERVE_CMD)

lighthouse-mobile: start-prod wait-for-prod ## Full mobile audit (build + optimize + serve + lhci)
	rm -rf .next && $(NEXT_BUILD_CMD) && $(LHCI) --config=lighthouserc.mobile.js $(SERVE_CMD)

lighthouse-desktop-autorun: ## Run LHCI against running app (desktop config)
	$(LHCI) --config=lighthouserc.desktop.js

lighthouse-mobile-autorun: ## Run LHCI against running app (mobile config)
	$(LHCI) --config=lighthouserc.mobile.js

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

dev: ## Launch the app in development mode with hot-reloading and debug support
	$(NEXT_BIN) dev

app-serve: ## Serve the app on port 3001
	npx serve -s out -p 3001

app-start: ## Build and serve the production version
	$(NEXT_BUILD_CMD) && make app-serve

check-node-version: ## Check if the correct Node.js version is installed
	$(EXEC_NODEJS) node checkNodeVersion.js
