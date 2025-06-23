#!/bin/bash
# Production Targets Setup Script
# Adds start-prod and wait-for-prod targets to Makefile
set -e
echo "#### Adding production targets to Makefile"
cat >> Makefile << 'PROD_TARGETS'
# Production container configuration
PROD_CONTAINER_NAME ?= website-prod
start-prod: ## Build image and start container in production mode
ifeq ($(DIND), 1)
	@echo "🐳 Starting production environment in true Docker-in-Docker mode"

    
        
          
    

        
        Expand All
    
    @@ -97,8 +29,40 @@ endif
  
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
	@echo "Checking if $(PROD_CONTAINER_NAME) container is running..."
	@for i in $$(seq 1 30); do \
		if docker ps --filter "name=$(PROD_CONTAINER_NAME)" --filter "status=running" --format "{{.Names}}" | grep -q "$(PROD_CONTAINER_NAME)"; then \
			echo "✅ Container $(PROD_CONTAINER_NAME) is running"; \
			break; \
		fi; \
		echo "Attempt $$i: Container not running yet, waiting..."; \
		sleep 2; \
		if [ $$i -eq 30 ]; then \
			echo "❌ Container failed to start within 60 seconds"; \
			docker ps -a --filter "name=$(PROD_CONTAINER_NAME)"; \
			exit 1; \
		fi; \
	done
	@echo "🔍 Testing $(PROD_CONTAINER_NAME) service connectivity on port $(NEXT_PUBLIC_PROD_PORT)..."
	@for i in $$(seq 1 60); do \
		if docker exec $(PROD_CONTAINER_NAME) sh -c "curl -f http://localhost:$(NEXT_PUBLIC_PROD_PORT) >/dev/null 2>&1"; then \
			echo "✅ Service is responding on port $(NEXT_PUBLIC_PROD_PORT)!"; \
			break; \
		fi; \
		echo "Attempt $$i: Service not ready, checking container status..."; \
		if [ $$((i % 10)) -eq 0 ]; then \
			echo "Debug info at attempt $$i:"; \
			docker exec $(PROD_CONTAINER_NAME) ps aux 2>/dev/null || echo "Cannot access container processes"; \
			docker exec $(PROD_CONTAINER_NAME) netstat -tulpn 2>/dev/null | grep :$(NEXT_PUBLIC_PROD_PORT) || echo "Port $(NEXT_PUBLIC_PROD_PORT) not bound"; \
		fi; \
		sleep 3; \
		if [ $$i -eq 60 ]; then \
			echo "❌ Service failed to respond within 180 seconds"; \
			echo "Final container logs:"; \
			docker logs $(PROD_CONTAINER_NAME) --tail 50; \
			exit 1; \
		fi; \
	done
else
	@echo "Waiting for prod service to be ready on port $(NEXT_PUBLIC_PROD_PORT)..."
	npx wait-on -v http://$(WEBSITE_DOMAIN):$(NEXT_PUBLIC_PROD_PORT)

    
          
            
    

          
          Expand Down
    
    
  
	@echo "Prod service is up and running!"
endif
PROD_TARGETS
echo "✅ Production targets added successfully"