#!/bin/bash

# Production Environment Script
# This script contains production-specific operations that don't need to be in the Makefile

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Validate production build
validate_build() {
    log_info "Validating production build"
    
    cd "${PROJECT_ROOT}"
    
    # Check if build artifacts exist
    if [ ! -d ".next" ]; then
        log_error "Build artifacts not found. Run 'make build' first."
        return 1
    fi
    
    # Check build size
    local build_size=$(du -sh .next 2>/dev/null | cut -f1)
    log_info "Build size: $build_size"
    
    # Check for critical files
    local critical_files=(".next/BUILD_ID" ".next/server" ".next/static")
    for file in "${critical_files[@]}"; do
        if [ ! -e "$file" ]; then
            log_error "Critical build file missing: $file"
            return 1
        fi
    done
    
    log_success "Production build validation passed"
}

# Run production smoke tests
smoke_tests() {
    local base_url="${1:-http://localhost:3001}"
    
    log_info "Running production smoke tests against $base_url"
    
    # Test basic endpoints
    local endpoints=(
        "/"
        "/api/health"
        "/_next/static/media"
    )
    
    local failed_tests=0
    
    for endpoint in "${endpoints[@]}"; do
        local url="${base_url}${endpoint}"
        log_info "Testing $url"
        
        if curl -f -s --max-time 10 "$url" >/dev/null; then
            log_success "✓ $endpoint"
        else
            log_error "✗ $endpoint"
            ((failed_tests++))
        fi
    done
    
    if [ $failed_tests -eq 0 ]; then
        log_success "All smoke tests passed"
    else
        log_error "$failed_tests smoke test(s) failed"
        return 1
    fi
}

# Performance validation
performance_check() {
    local base_url="${1:-http://localhost:3001}"
    
    log_info "Running performance checks against $base_url"
    
    # Check response times
    log_info "Checking response times..."
    local response_time=$(curl -o /dev/null -s -w '%{time_total}\n' "$base_url")
    
    # Convert to milliseconds for easier comparison
    local response_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)
    
    log_info "Homepage response time: ${response_ms}ms"
    
    # Warn if response time is too high
    if [ "$response_ms" -gt 2000 ]; then
        log_warning "Homepage response time is high: ${response_ms}ms"
    else
        log_success "Homepage response time is acceptable: ${response_ms}ms"
    fi
    
    # Check if gzip compression is enabled
    log_info "Checking compression..."
    local content_encoding=$(curl -H "Accept-Encoding: gzip" -s -I "$base_url" | grep -i "content-encoding" || true)
    
    if echo "$content_encoding" | grep -q "gzip"; then
        log_success "Gzip compression is enabled"
    else
        log_warning "Gzip compression not detected"
    fi
}

# Security headers check
security_check() {
    local base_url="${1:-http://localhost:3001}"
    
    log_info "Checking security headers for $base_url"
    
    # Get headers
    local headers=$(curl -s -I "$base_url")
    
    # Security headers to check
    local security_headers=(
        "X-Frame-Options"
        "X-Content-Type-Options"
        "Referrer-Policy"
        "Content-Security-Policy"
    )
    
    local missing_headers=()
    
    for header in "${security_headers[@]}"; do
        if echo "$headers" | grep -qi "$header"; then
            log_success "✓ $header"
        else
            log_warning "✗ $header missing"
            missing_headers+=("$header")
        fi
    done
    
    if [ ${#missing_headers[@]} -eq 0 ]; then
        log_success "All security headers present"
    else
        log_warning "${#missing_headers[@]} security header(s) missing"
    fi
}

# Deploy validation (post-deployment checks)
deploy_validation() {
    local base_url="${1:-http://localhost:3001}"
    
    log_info "Running comprehensive deployment validation"
    
    # Run all validation checks
    smoke_tests "$base_url"
    performance_check "$base_url"
    security_check "$base_url"
    
    log_success "Deployment validation completed"
}

# Generate production report
generate_report() {
    local base_url="${1:-http://localhost:3001}"
    local output_file="${2:-production-report.md}"
    
    log_info "Generating production report: $output_file"
    
    cat > "$output_file" << EOF
# Production Deployment Report

**Generated:** $(date)
**Target URL:** $base_url

## Build Information
- Build ID: $(cat .next/BUILD_ID 2>/dev/null || echo "N/A")
- Build Size: $(du -sh .next 2>/dev/null | cut -f1 || echo "N/A")
- Node Version: $(node --version 2>/dev/null || echo "N/A")

## Test Results

### Smoke Tests
EOF

    # Run smoke tests and capture results
    if smoke_tests "$base_url" 2>&1; then
        echo "✅ **PASSED** - All smoke tests successful" >> "$output_file"
    else
        echo "❌ **FAILED** - Some smoke tests failed" >> "$output_file"
    fi

    cat >> "$output_file" << EOF

### Performance Check
EOF

    # Run performance check
    local response_time=$(curl -o /dev/null -s -w '%{time_total}\n' "$base_url" 2>/dev/null || echo "0")
    local response_ms=$(echo "$response_time * 1000" | bc -l 2>/dev/null | cut -d. -f1 2>/dev/null || echo "0")
    
    echo "- Homepage response time: ${response_ms}ms" >> "$output_file"

    cat >> "$output_file" << EOF

### Security Headers
EOF

    # Check security headers
    local headers=$(curl -s -I "$base_url" 2>/dev/null || echo "")
    local security_headers=("X-Frame-Options" "X-Content-Type-Options" "Referrer-Policy" "Content-Security-Policy")
    
    for header in "${security_headers[@]}"; do
        if echo "$headers" | grep -qi "$header"; then
            echo "- ✅ $header: Present" >> "$output_file"
        else
            echo "- ❌ $header: Missing" >> "$output_file"
        fi
    done

    cat >> "$output_file" << EOF

## Recommendations

1. Monitor response times in production
2. Implement missing security headers
3. Set up automated health checks
4. Configure proper logging and monitoring

---
*Report generated by production validation script*
EOF

    log_success "Production report generated: $output_file"
}

# Cleanup production artifacts
cleanup_prod() {
    log_info "Cleaning up production artifacts"
    
    cd "${PROJECT_ROOT}"
    
    # Remove build artifacts
    rm -rf .next out build 2>/dev/null || true
    
    # Remove test artifacts
    rm -rf test-results playwright-report coverage reports 2>/dev/null || true
    
    # Remove temporary files
    rm -rf production-report.md 2>/dev/null || true
    
    log_success "Production cleanup completed"
}

# Health check endpoint test
health_check() {
    local base_url="${1:-http://localhost:3001}"
    local max_attempts="${2:-30}"
    local delay="${3:-2}"
    
    log_info "Performing health check on $base_url"
    
    for i in $(seq 1 "$max_attempts"); do
        if curl -f -s --max-time 5 "$base_url/api/health" >/dev/null 2>&1; then
            log_success "Health check passed on attempt $i"
            return 0
        elif curl -f -s --max-time 5 "$base_url" >/dev/null 2>&1; then
            log_success "Homepage accessible on attempt $i"
            return 0
        fi
        
        if [ $i -lt "$max_attempts" ]; then
            log_info "Attempt $i failed, retrying in ${delay}s..."
            sleep "$delay"
        fi
    done
    
    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Main function
main() {
    case "${1:-help}" in
        "validate")
            validate_build
            ;;
        "smoke")
            smoke_tests "${2:-http://localhost:3001}"
            ;;
        "performance")
            performance_check "${2:-http://localhost:3001}"
            ;;
        "security")
            security_check "${2:-http://localhost:3001}"
            ;;
        "deploy-check")
            deploy_validation "${2:-http://localhost:3001}"
            ;;
        "report")
            generate_report "${2:-http://localhost:3001}" "${3:-production-report.md}"
            ;;
        "health")
            health_check "${2:-http://localhost:3001}"
            ;;
        "cleanup")
            cleanup_prod
            ;;
        "help"|*)
            echo "Usage: $0 {validate|smoke|performance|security|deploy-check|report|health|cleanup} [url]"
            echo ""
            echo "Commands:"
            echo "  validate              - Validate production build artifacts"
            echo "  smoke [url]           - Run smoke tests against URL"
            echo "  performance [url]     - Check performance metrics"
            echo "  security [url]        - Check security headers"
            echo "  deploy-check [url]    - Full deployment validation"
            echo "  report [url] [file]   - Generate production report"
            echo "  health [url]          - Health check with retries"
            echo "  cleanup               - Clean production artifacts"
            echo ""
            echo "Examples:"
            echo "  $0 validate                                    # Validate build"
            echo "  $0 smoke http://localhost:3001                 # Test local prod"
            echo "  $0 deploy-check https://myapp.com             # Full check"
            echo "  $0 report https://myapp.com prod-report.md    # Generate report"
            ;;
    esac
}

main "$@" 