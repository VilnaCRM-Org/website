/* eslint-disable prefer-object-spread */
import http from 'k6/http';
import { sleep } from 'k6';

import ScenarioUtils from './utils/scenarioUtils.js';
import Utils from './utils/utils.js';
import TEST_DATA_GENERATORS from './utils/test-data.js';

const scenarioName = 'swagger';

const utils = new Utils();
const scenarioUtils = new ScenarioUtils(utils, scenarioName);

export const options = scenarioUtils.getOptions();

export default function swagger() {
  const baseUrl = utils.getBaseUrl();
  const sharedHttpParams = utils.getParams();
  const testData = TEST_DATA_GENERATORS.generateUser();
  const userId = TEST_DATA_GENERATORS.userId();

  const swaggerPageResponse = http.get(`${baseUrl}/swagger`, sharedHttpParams);
  utils.checkResponse(swaggerPageResponse, 'swagger page loads', res => res.status === 200);

  const schemaResponse = http.get(`${baseUrl}/swagger-schema.json`, sharedHttpParams);
  utils.checkResponse(schemaResponse, 'schema loads', res => res.status === 200);

  sleep(1);

  const apiSections = [
    { path: '/api/users', method: 'GET', description: 'Get users list' },
    { path: '/api/users', method: 'POST', description: 'Create new user' },
    { path: `/api/users/${userId}`, method: 'GET', description: 'Get specific user' },
    { path: `/api/users/${userId}`, method: 'PUT', description: 'Update user' },
    { path: `/api/users/${userId}`, method: 'DELETE', description: 'Delete user' },
    { path: '/api/system/health', method: 'GET', description: 'System health check' },
    { path: '/api/system/status', method: 'GET', description: 'System status' },
  ];

  apiSections.forEach(section => {
    const requestParams = Object.assign({}, sharedHttpParams, {
      headers: Object.assign({}, sharedHttpParams.headers, {
        'Content-Type': 'application/json',
      }),
    });

    let response;

    switch (section.method) {
      case 'GET':
        response = http.get(`${baseUrl}${section.path}`, requestParams);
        break;
      case 'POST':
        response = http.post(`${baseUrl}${section.path}`, JSON.stringify(testData), requestParams);
        break;
      case 'PUT':
        response = http.put(`${baseUrl}${section.path}`, JSON.stringify(testData), requestParams);
        break;
      case 'DELETE':
        response = http.del(`${baseUrl}${section.path}`, null, requestParams);
        break;
      default:
        response = http.get(`${baseUrl}${section.path}`, requestParams);
        break;
    }

    utils.checkResponse(
      response,
      `${section.method} ${section.path} responds`,
      res => res.status >= 200 && res.status < 600
    );

    sleep(0.5);
  });

  const authHeaders = Object.assign({}, sharedHttpParams, {
    headers: Object.assign({}, sharedHttpParams.headers, {
      Authorization: `Bearer test-token-${userId}`,
      'X-API-Key': `test-api-key-${userId}`,
    }),
  });

  const authenticatedRequests = [
    { url: `${baseUrl}/api/users`, method: 'GET' },
    { url: `${baseUrl}/api/users/${userId}`, method: 'GET' },
    { url: `${baseUrl}/api/system/health`, method: 'GET' },
  ];

  authenticatedRequests.forEach(req => {
    const response = http.get(req.url, authHeaders);
    utils.checkResponse(
      response,
      `authenticated ${req.method} ${req.url} responds`,
      res => res.status >= 200 && res.status < 600
    );
  });

  sleep(1);

  const errorTestCases = [
    { path: '/api/users/999999', expectedStatus: [404, 400] },
    { path: '/api/nonexistent', expectedStatus: [404] },
    { path: '/api/users/invalid-id', expectedStatus: [400, 404] },
  ];

  errorTestCases.forEach(testCase => {
    const response = http.get(`${baseUrl}${testCase.path}`, sharedHttpParams);
    utils.checkResponse(response, `error case ${testCase.path} handles correctly`, res =>
      testCase.expectedStatus.includes(res.status)
    );
  });

  const contentTypeTests = [
    {
      contentType: 'application/json',
      body: JSON.stringify(testData),
      description: 'JSON request',
    },
    {
      contentType: 'application/x-www-form-urlencoded',
      body: `name=${encodeURIComponent(testData.name)}&email=${encodeURIComponent(testData.email)}`,
      description: 'Form data request',
    },
  ];

  contentTypeTests.forEach(test => {
    const testParams = Object.assign({}, sharedHttpParams, {
      headers: Object.assign({}, sharedHttpParams.headers, {
        'Content-Type': test.contentType,
      }),
    });

    const response = http.post(`${baseUrl}/api/users`, test.body, testParams);
    utils.checkResponse(
      response,
      `${test.description} is handled`,
      res => res.status >= 200 && res.status < 600
    );
  });

  const concurrentRequests = Array(5)
    .fill()
    .map(() => ({
      method: 'GET',
      url: `${baseUrl}/api/users`,
      params: sharedHttpParams,
    }));

  const batchResponses = http.batch(concurrentRequests);

  batchResponses.forEach((response, index) => {
    utils.checkResponse(
      response,
      `concurrent request ${index + 1} succeeds`,
      res => res.status >= 200 && res.status < 600
    );
  });

  const queryParamTests = [
    { path: '/api/users?page=1&limit=10', description: 'pagination params' },
    { path: '/api/users?search=test&sort=name', description: 'search and sort params' },
    { path: '/api/users?filter=active&include=profile', description: 'filter and include params' },
  ];

  queryParamTests.forEach(test => {
    const response = http.get(`${baseUrl}${test.path}`, sharedHttpParams);
    utils.checkResponse(
      response,
      `${test.description} query params work`,
      res => res.status >= 200 && res.status < 600
    );
  });

  const performanceTest = http.get(`${baseUrl}/api/users`, sharedHttpParams);

  utils.checkResponse(
    performanceTest,
    'response time is acceptable',
    res => res.timings.duration < 5000
  );
  utils.checkResponse(
    performanceTest,
    'response has content',
    res => res.body && res.body.length > 0
  );

  sleep(1);
}
