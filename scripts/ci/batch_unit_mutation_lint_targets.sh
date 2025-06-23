#!/bin/bash

# Unit, Mutation, and Lint Test Targets Batch Script
# Adds unit-test-all, test-mutation, lint-next, lint-tsc, and lint-md targets to Makefile

set -e

echo "#### Adding unit, mutation, and lint test targets to Makefile"

# Add all targets to Makefile using grouped redirects
{
cat << 'UNIT_TEST_TARGET'
test-unit-all: ## Execute all unit tests in true DinD mode
ifeq ($(DIND), 1)
	@echo "🐳 Running unit tests in true Docker-in-Docker mode"
	@echo "Setting up Docker network..."
	make setup-dind-network
	@echo "Building container image..."
	$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) build dev
	@echo "🧹 Cleaning up any existing temporary containers..."
	@docker rm -f website-dev-temp 2>/dev/null || true
	@echo "🛠️ Starting container in background for file operations..."
	docker run -d --name website-dev-temp --network website-network website-dev tail -f /dev/null
	@echo "📂 Copying source files into container..."
	@if docker cp . website-dev-temp:/app/; then \
		echo "✅ Source files copied successfully"; \
	else \
		echo "❌ Failed to copy source files"; \
		docker rm -f website-dev-temp; \
		exit 1; \
	fi
	@echo "📦 Installing dependencies inside container..."
	@if docker exec website-dev-temp sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then \
		echo "✅ Dependencies installed successfully"; \
	else \
		echo "❌ Failed to install dependencies"; \
		docker logs website-dev-temp --tail 20; \
		docker rm -f website-dev-temp; \
		exit 1; \
	fi
	@echo "🧪 Running client-side tests..."
	@if docker exec website-dev-temp sh -c "cd /app && env TEST_ENV=client ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2"; then \
		echo "✅ Client-side tests PASSED"; \
	else \
		echo "❌ Client-side tests FAILED"; \
		docker logs website-dev-temp --tail 30; \
		docker rm -f website-dev-temp; \
		exit 1; \
	fi
	@echo "🧪 Running server-side tests..."
	@if docker exec website-dev-temp sh -c "cd /app && env TEST_ENV=server ./node_modules/.bin/jest --verbose --passWithNoTests --maxWorkers=2"; then \
		echo "✅ Server-side tests PASSED"; \
	else \
		echo "❌ Server-side tests FAILED"; \
		docker logs website-dev-temp --tail 30; \
		docker rm -f website-dev-temp; \
		exit 1; \
	fi
	@echo "🧹 Cleaning up temporary container..."
	@docker rm -f website-dev-temp
	@echo "🎉 All unit tests completed successfully in true DinD mode!"
	@echo "📊 Summary: Both client and server tests passed in containerized environment"
else
	@echo "🐳 Running unit tests with standard Docker Compose"
	$(UNIT_TESTS) TEST_ENV=client $(JEST_BIN) $(JEST_FLAGS)
	$(UNIT_TESTS) TEST_ENV=server $(JEST_BIN) $(JEST_FLAGS) $(TEST_DIR_APOLLO)
endif
UNIT_TEST_TARGET

cat << 'MUTATION_TARGET'
test-mutation: build ## Run mutation tests using Stryker in true DinD mode
ifeq ($(DIND), 1)
	@echo "🐳 Running mutation tests in true Docker-in-Docker mode"
	@echo "Setting up Docker network..."
	make setup-dind-network
	@echo "Building container image..."
	$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) build dev
	@echo "🧹 Cleaning up any existing containers..."
	@docker rm -f website-dev-mutation 2>/dev/null || true
	@echo "🛠️ Starting container in background for file operations..."
	docker run -d --name website-dev-mutation --network website-network website-dev tail -f /dev/null
	@echo "📂 Copying source files into container..."
	@if docker cp . website-dev-mutation:/app/; then \
		echo "✅ Source files copied successfully"; \
	else \
		echo "❌ Failed to copy source files"; \
		docker rm -f website-dev-mutation; \
		exit 1; \
	fi
	@echo "📦 Installing dependencies inside container..."
	@if docker exec website-dev-mutation sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then \
		echo "✅ Dependencies installed successfully"; \
	else \
		echo "❌ Failed to install dependencies"; \
		docker logs website-dev-mutation --tail 20; \
		docker rm -f website-dev-mutation; \
		exit 1; \
	fi
	@echo "🚀 Starting dev server in background..."
	@docker exec -d website-dev-mutation sh -c "cd /app && ./node_modules/.bin/next dev"
	@echo "⏳ Waiting for dev server to be ready..."
	@for i in $$(seq 1 60); do \
		if docker exec website-dev-mutation sh -c "curl -f http://localhost:3000 >/dev/null 2>&1"; then \
			echo "✅ Dev server is responding on port 3000!"; \
			break; \
		fi; \
		echo "Attempt $$i: Dev server not ready yet..."; \
		if [ $$((i % 10)) -eq 0 ]; then \
			echo "Debug info at attempt $$i:"; \
			docker exec website-dev-mutation ps aux 2>/dev/null | grep -E "(next|node)" || echo "No Next.js processes found"; \
			docker exec website-dev-mutation netstat -tulpn 2>/dev/null | grep :3000 || echo "Port 3000 not bound"; \
			echo "Recent container logs:"; \
			docker logs website-dev-mutation --tail 10; \
		fi; \
		sleep 3; \
		if [ $$i -eq 60 ]; then \
			echo "❌ Dev server failed to respond within 180 seconds"; \
			docker logs website-dev-mutation --tail 50; \
			docker rm -f website-dev-mutation; \
			exit 1; \
		fi; \
	done
	@echo "🧬 Running Stryker mutation tests..."
	@if docker exec website-dev-mutation sh -c "cd /app && pnpm stryker run"; then \
		echo "✅ Mutation tests PASSED"; \
	else \
		echo "❌ Mutation tests FAILED"; \
		docker logs website-dev-mutation --tail 30; \
		docker rm -f website-dev-mutation; \
		exit 1; \
	fi
	@echo "📂 Copying mutation reports..."
	@mkdir -p reports/mutation
	@docker cp website-dev-mutation:/app/reports/mutation/. reports/mutation/ 2>/dev/null || echo "No mutation reports to copy"
	@echo "🧹 Cleaning up mutation container..."
	@docker rm -f website-dev-mutation
	@echo "🎉 Mutation tests completed successfully in true DinD mode!"
else
	@echo "🐳 Running mutation tests with standard Docker Compose"
	$(STRYKER_CMD)
endif
MUTATION_TARGET

cat << 'LINT_TARGETS'

# Helper function for DinD lint container operations
run_dind_lint_command() {
	local container_suffix=$1
	local command=$2
	local description=$3
	local container_name="website-dev-lint-$container_suffix"
	
	echo "🐳 Running $description in true Docker-in-Docker mode"
	echo "Setting up Docker network..."
	make setup-dind-network
	echo "Building container image..."
	$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) build dev
	echo "🧹 Cleaning up any existing containers..."
	docker rm -f $container_name 2>/dev/null || true
	echo "🛠️ Starting container for $description..."
	docker run -d --name $container_name --network website-network website-dev tail -f /dev/null
	
	echo "📂 Copying source files into container..."
	if docker cp . $container_name:/app/; then
		echo "✅ Source files copied successfully"
	else
		echo "❌ Failed to copy source files"
		docker rm -f $container_name
		return 1
	fi
	
	echo "📦 Installing dependencies inside container..."
	if docker exec $container_name sh -c "cd /app && npm install -g pnpm && pnpm install --frozen-lockfile"; then
		echo "✅ Dependencies installed successfully"
	else
		echo "❌ Failed to install dependencies"
		docker logs $container_name --tail 20
		docker rm -f $container_name
		return 1
	fi
	
	echo "🔍 Running $description..."
	if docker exec $container_name sh -c "cd /app && $command"; then
		echo "✅ $description PASSED"
	else
		echo "❌ $description FAILED"
		docker logs $container_name --tail 30
		docker rm -f $container_name
		return 1
	fi
	
	echo "🧹 Cleaning up $description container..."
	docker rm -f $container_name
	echo "🎉 $description completed successfully in true DinD mode!"
}

lint-next: ## This command executes ESLint
ifeq ($(DIND), 1)
	@run_dind_lint_command "next" "./node_modules/.bin/next lint" "ESLint check"
else
	$(PNPM_EXEC) $(NEXT_BIN) lint
endif
lint-tsc: ## This command executes Typescript linter
ifeq ($(DIND), 1)
	@run_dind_lint_command "tsc" "./node_modules/.bin/tsc --noEmit" "TypeScript check"
else
	$(TSC_CMD)
endif
lint-md: ## This command executes markdownlint for .md files
ifeq ($(DIND), 1)
	@run_dind_lint_command "md" "npx markdownlint-cli2 '**/*.md' '#node_modules' '#.next'" "Markdown linting"
else
	$(MARKDOWNLINT_CMD)
endif
LINT_TARGETS
} >> Makefile

echo "✅ Unit, mutation, and lint test targets added successfully" 