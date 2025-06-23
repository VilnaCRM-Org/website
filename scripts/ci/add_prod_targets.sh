#!/bin/bash

# Production Targets Setup Script
# Adds start-prod and wait-for-prod targets to Makefile

set -e

echo "#### Adding production targets to Makefile"

cat >> Makefile << 'PROD_TARGETS'

# Production container configuration
PROD_CONTAINER_NAME ?= website-prod

# Define shell helper functions for DinD operations
define DIND_HELPERS
retry_with_timeout() {
	local max_attempts=$$1
	local sleep_interval=$$2
	local timeout_message="$$3"
	local check_command="$$4"
	local debug_command="$${5:-""}"
	local debug_interval=$${6:-10}
	
	for i in $$(seq 1 $$max_attempts); do
		if eval "$$check_command"; then
			return 0
		fi
		echo "Attempt $$i: $$timeout_message, waiting..."
		
		# Show debug info at intervals
		if [ -n "$$debug_command" ] && [ $$((i % debug_interval)) -eq 0 ]; then
			echo "Debug info at attempt $$i:"
			eval "$$debug_command" || echo "Debug command failed"
		fi
		
		sleep $$sleep_interval
		
		if [ $$i -eq $$max_attempts ]; then
			echo "❌ Operation failed after $$((max_attempts * sleep_interval)) seconds"
			return 1
		fi
	done
}

wait_for_container_running() {
	local container_name=$$1
	echo "Checking if $$container_name container is running..."
	
	local check_cmd="docker ps --filter \"name=$$container_name\" --filter \"status=running\" --format \"{{.Names}}\" | grep -q \"$$container_name\""
	local fail_cmd="docker ps -a --filter \"name=$$container_name\""
	
	if retry_with_timeout 30 2 "Container not running yet" "$$check_cmd"; then
		echo "✅ Container $$container_name is running"
		return 0
	else
		echo "Container status:"
		eval "$$fail_cmd"
		return 1
	fi
}

wait_for_service_health() {
	local container_name=$$1
	local port=$$2
	echo "🔍 Testing $$container_name service connectivity on port $$port..."
	
	local check_cmd="docker exec $$container_name sh -c \"curl -f http://localhost:$$port >/dev/null 2>&1\""
	local debug_cmd="docker exec $$container_name ps aux 2>/dev/null; docker exec $$container_name netstat -tulpn 2>/dev/null | grep :$$port || echo \"Port $$port not bound\""
	local fail_cmd="docker logs $$container_name --tail 50"
	
	if retry_with_timeout 60 3 "Service not ready, checking container status" "$$check_cmd" "$$debug_cmd" 10; then
		echo "✅ Service is responding on port $$port!"
		return 0
	else
		echo "Final container logs:"
		eval "$$fail_cmd"
		return 1
	fi
}
endef

start-prod: ## Build image and start container in production mode
ifeq ($(DIND), 1)
	@echo "🐳 Starting production environment in true Docker-in-Docker mode"
	@echo "Setting up Docker network..."
	make setup-dind-network
	@echo "Building production container image..."
	$(DOCKER_COMPOSE) $(COMMON_HEALTHCHECKS_FILE) $(DOCKER_COMPOSE_TEST_FILE) build
	@echo "🚀 Starting production services..."
	$(DOCKER_COMPOSE) $(COMMON_HEALTHCHECKS_FILE) $(DOCKER_COMPOSE_TEST_FILE) up -d
	make wait-for-prod
else
	$(DOCKER_COMPOSE) $(COMMON_HEALTHCHECKS_FILE) $(DOCKER_COMPOSE_TEST_FILE) up -d && make wait-for-prod
endif

wait-for-prod: ## Wait for the prod service to be ready on port $(NEXT_PUBLIC_PROD_PORT).
ifeq ($(DIND), 1)
	@echo "🐳 Waiting for prod service in true DinD mode using container networking..."
	@bash -c '$$(DIND_HELPERS); wait_for_container_running $(PROD_CONTAINER_NAME)'
	@bash -c '$$(DIND_HELPERS); wait_for_service_health $(PROD_CONTAINER_NAME) $(NEXT_PUBLIC_PROD_PORT)'
else
	@echo "Waiting for prod service to be ready on port $(NEXT_PUBLIC_PROD_PORT)..."
	npx wait-on -v http://$(WEBSITE_DOMAIN):$(NEXT_PUBLIC_PROD_PORT)
	@echo "Prod service is up and running!"
endif

PROD_TARGETS

echo "✅ Production targets added successfully" 