# Swagger Load Tests

This directory contains load tests for the Swagger API documentation page using K6.
The tests are designed to simulate real user interactions with the Swagger UI and API endpoints.

## Test Files

### `swagger-advanced.js` - Comprehensive Swagger Load Test

A comprehensive load test that covers:

- Main Swagger page loading
- Swagger schema JSON fetching
- Static assets loading (images, icons)
- API endpoint exploration
- Different user agent simulation
- Concurrent request testing
- API endpoint testing with different HTTP methods (GET, POST, PUT, DELETE)
- Authentication header testing
- Error scenario testing
- Different content type testing
- Query parameter testing
- Performance validation

## Configuration

The load tests use the configuration defined in `config.json.dist`. The Swagger configuration includes:

```bash
{
  "swagger": {
    "setupTimeoutInMinutes": 15,
    "smoke": {
      "threshold": 20000,
      "rps": 3,
      "vus": 3,
      "duration": 15
    },
    "average": {
      "threshold": 8000,
      "rps": 10,
      "vus": 10,
      "duration": {
        "rise": 5,
        "plateau": 45,
        "fall": 5
      }
    },
    "stress": {
      "threshold": 25000,
      "rps": 50,
      "vus": 50,
      "duration": {
        "rise": 5,
        "plateau": 45,
        "fall": 5
      }
    },
    "spike": {
      "threshold": 60000,
      "rps": 100,
      "vus": 100,
      "duration": {
        "rise": 30,
        "fall": 15
      }
    }
  }
}
```

## Running the Tests

### Prerequisites

1. Ensure the production environment is running
2. Make sure K6 is available in the Docker environment

### Available Commands

#### Swagger Load Test

```bash
make load-tests-swagger
```

Runs the comprehensive Swagger load test with all scenarios (smoke, average, stress, spike).

#### Smoke Test Only

```bash
run_smoke=true make load-tests-swagger
```

Runs only the smoke test scenario (light load, quick validation).

#### Stress Test Only

```bash
run_stress=true make load-tests-swagger
```

Runs only the stress test scenario (high load, performance validation).

### Environment Variables

You can control which test scenarios run by setting environment variables:

- `run_smoke=true` - Run smoke tests
- `run_average=true` - Run average load tests
- `run_stress=true` - Run stress tests
- `run_spike=true` - Run spike tests

If no environment variables are set, all scenarios will run.

## Test Scenarios

### Smoke Test

- **Purpose**: Quick validation that the system works under minimal load
- **Load**: 3 virtual users, 3 requests per second
- **Duration**: 15 seconds
- **Threshold**: 20 seconds response time

### Average Load Test

- **Purpose**: Test normal expected load
- **Load**: 10 virtual users, 10 requests per second
- **Duration**: 55 seconds (5s rise, 45s plateau, 5s fall)
- **Threshold**: 8 seconds response time

### Stress Test

- **Purpose**: Test system behavior under high load
- **Load**: 50 virtual users, 50 requests per second
- **Duration**: 55 seconds (5s rise, 45s plateau, 5s fall)
- **Threshold**: 25 seconds response time

### Spike Test

- **Purpose**: Test system behavior under sudden load spikes
- **Load**: 100 virtual users, 100 requests per second
- **Duration**: 45 seconds (30s rise, 15s fall)
- **Threshold**: 60 seconds response time

## What the Tests Cover

### Page Loading

- Main Swagger page (`/swagger`)
- Swagger schema JSON (`/swagger-schema.json`)
- Static assets (images, icons)

### API Endpoint Testing

- GET requests to various endpoints
- POST requests with JSON payloads
- PUT requests for updates
- DELETE requests
- Error handling (404, 400 responses)

### Authentication Testing

- Requests with Bearer tokens
- Requests with API keys
- Unauthenticated requests

### Performance Testing

- Response time validation
- Concurrent request handling
- Different content type handling
- Query parameter processing

### Error Scenarios

- Invalid endpoints
- Invalid IDs
- Missing resources
- Malformed requests

## Results

Test results are saved in the `results/` directory:

- `swagger.html` - Comprehensive test results

## Monitoring

The tests include comprehensive monitoring:

- Response time metrics (avg, min, med, max, p95, p99)
- Request rate monitoring
- Error rate tracking
- Custom checks for specific functionality

## Customization

### Adding New Endpoints

To test additional API endpoints, modify the `apiSections` array in the test files:

```bash
const apiSections = [
  // ... existing endpoints
  { path: '/api/new-endpoint', method: 'GET', description: 'New endpoint test' }
];
```

### Modifying Test Data

Update the `generateTestData()` function to include different test data:

```bash
function generateTestData() {
  return {
    user: {
      name: `Custom User ${Math.floor(Math.random() * 1000)}`,
      email: `custom${Math.floor(Math.random() * 1000)}@example.com`,
      // ... additional fields
    }
  };
}
```

### Adjusting Load Patterns

Modify the configuration in `config.json.dist` to adjust:

- Number of virtual users
- Requests per second
- Test duration
- Response time thresholds

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure the production environment is running
2. **Timeout Errors**: Check if the service is healthy and responding
3. **High Error Rates**: Verify API endpoints are properly configured
4. **Memory Issues**: Reduce the number of virtual users or test duration

### Debug Mode

To run tests in debug mode, you can modify the K6 command to include verbose logging:

```bash
$(K6) run --verbose --summary-trend-stats="avg,min,med,max,p(95),p(99)" /loadTests/swagger-advanced.js
```

## Integration with CI/CD

The load tests can be integrated into CI/CD pipelines. The GitHub Actions workflow includes load testing:

```bash
- name: Run Load Tests
  run: make load-tests-swagger
```

This ensures that performance regressions are caught early in the development process.
