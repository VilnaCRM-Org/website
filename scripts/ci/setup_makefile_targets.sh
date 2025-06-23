#!/bin/bash

# Makefile Targets Setup Script
# Removes existing test targets and adds DinD-aware targets

set -e

echo "#### Setting up Makefile targets for DinD environment"

# Add DIND variable if not present
if ! grep -q "^DIND" Makefile; then
    echo "📝 Adding DIND variable to Makefile..."
    sed -i '/^CI[[:space:]]*?= 0$/a DIND                        ?= 0' Makefile
    echo "✅ DIND variable added"
else
    echo "ℹ️  DIND variable already exists"
fi

# Add missing variables for DIND mode if not present
echo "📝 Adding missing variables for DIND mode..."
if ! grep -q "^WEBSITE_DOMAIN" Makefile; then
    sed -i '/^NETWORK_NAME.*= website-network$/a WEBSITE_DOMAIN              ?= localhost' Makefile
fi
if ! grep -q "^DEV_PORT" Makefile; then
    sed -i '/^WEBSITE_DOMAIN.*?= localhost$/a DEV_PORT                    ?= 3000' Makefile
fi
if ! grep -q "^NEXT_PUBLIC_PROD_PORT" Makefile; then
    sed -i '/^DEV_PORT.*?= 3000$/a NEXT_PUBLIC_PROD_PORT       ?= 3001' Makefile
fi
if ! grep -q "^PLAYWRIGHT_TEST_PORT" Makefile; then
    sed -i '/^NEXT_PUBLIC_PROD_PORT.*?= 3001$/a PLAYWRIGHT_TEST_PORT        ?= 9323' Makefile
fi
if ! grep -q "^UI_HOST" Makefile; then
    sed -i '/^PLAYWRIGHT_TEST_PORT.*?= 9323$/a UI_HOST                     ?= 0.0.0.0' Makefile
fi
echo "✅ Variables added successfully"

# Remove existing tests targets
for t in test-unit-all test-mutation lint-next lint-tsc lint-md test-e2e start-prod wait-for-prod test-visual test-visual-ui test-visual-update load-tests setup-dind-network; do
  sed -i "/^${t}:/,/^[a-zA-Z][a-zA-Z-]*:/d" Makefile
done

# Add true DinD-aware targets - Part 1
cat >> Makefile << 'MAKEFILE_PART1'
setup-dind-network: ## Configure Docker Compose files and create network for DIND mode
ifeq ($(DIND), 1)
	@echo "🔧 Setting up DIND environment..."
	@./scripts/ci/configure-dind.sh
else
	@echo "ℹ️  DIND mode not enabled, skipping DIND setup"
endif
wait-for-dev-dind: ## Wait for dev service in DinD mode using container networking
	@echo "🐳 Waiting for dev service to be ready via Docker network..."
	@echo "Debug: Checking if container is running..."
	@for i in $$(seq 1 30); do \
		if docker ps --filter "name=website-dev" --filter "status=running" --format "{{.Names}}" | grep -q "website-dev"; then \
			echo "✅ Container website-dev is running"; \
			break; \
		fi; \
		echo "Attempt $$i: Container not running yet, waiting..."; \
		sleep 2; \
		if [ $$i -eq 30 ]; then \
			echo "❌ Container failed to start within 60 seconds"; \
			docker ps -a --filter "name=website-dev"; \
			exit 1; \
		fi; \
	done
	@echo "🔍 Testing container connectivity..."
	@for i in $$(seq 1 60); do \
		if docker exec website-dev sh -c "curl -f http://localhost:$(DEV_PORT)/api/health >/dev/null 2>&1 || curl -f http://127.0.0.1:$(DEV_PORT) >/dev/null 2>&1"; then \
			echo "✅ Dev service is responding on port $(DEV_PORT)!"; \
			break; \
		fi; \
		echo "Attempt $$i: Dev service not ready, checking container status..."; \
		if [ $$((i % 10)) -eq 0 ]; then \
			echo "Debug info at attempt $$i:"; \
			docker exec website-dev ps aux 2>/dev/null || echo "Cannot access container processes"; \
			docker exec website-dev netstat -tulpn 2>/dev/null | grep :$(DEV_PORT) || echo "Port $(DEV_PORT) not bound"; \
		fi; \
		sleep 3; \
		if [ $$i -eq 60 ]; then \
			echo "❌ Dev service failed to respond within 180 seconds"; \
			echo "Final container logs:"; \
			docker logs website-dev --tail 50; \
			exit 1; \
		fi; \
	done
start-dind: ## Start application in DinD mode with network setup
	@echo "🐳 Starting application in true DinD mode..."
	make setup-dind-network
	$(DOCKER_COMPOSE) $(DOCKER_COMPOSE_DEV_FILE) up -d dev
	make wait-for-dev-dind
MAKEFILE_PART1

echo "✅ Part 1 of Makefile targets added successfully" 