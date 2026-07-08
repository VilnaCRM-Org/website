require('dotenv').config();

// Per-page desktop Lighthouse budgets. LHCI rejects a shared `assertions` block
// alongside `assertMatrix` ("Cannot use assertMatrix with other options"), so all
// gating lives in assertMatrix entries — which also lets the heavier Swagger UI
// page carry looser floors than the marketing homepage.
//
// Ratchet rule: floors, metric ceilings, and byte budgets are ratcheted from a
// 3-run CI median baseline (PR #332) and may only move in the stricter direction
// (higher minScore, lower maxNumericValue). Re-baseline with
// `make lighthouse-desktop` before changing any number; never loosen to get green.
//
// Desktop CI baseline (median): homepage perf 0.94 — LCP 1.5s, TBT 2ms, CLS 0.01,
// script 634KB, total 1.35MB; swagger perf 0.89 — LCP 2.1s, TBT 117ms, CLS 0.01,
// script 941KB, total 1.26MB.
const median = { aggregationMethod: 'median-run' };

const homepageAssertions = {
  'categories:performance': ['error', { minScore: 0.9, ...median }],
  'categories:accessibility': ['error', { minScore: 0.9 }],
  'categories:bestPractices': ['error', { minScore: 0.9 }],
  'categories:seo': ['error', { minScore: 0.85 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 2500, ...median }],
  'total-blocking-time': ['error', { maxNumericValue: 150, ...median }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.05, ...median }],
  'resource-summary:script:size': ['error', { maxNumericValue: 750000, ...median }],
  'resource-summary:total:size': ['error', { maxNumericValue: 1550000, ...median }],
};

const swaggerAssertions = {
  'categories:performance': ['error', { minScore: 0.85, ...median }],
  'categories:accessibility': ['error', { minScore: 0.89 }],
  'categories:bestPractices': ['error', { minScore: 0.9 }],
  'categories:seo': ['error', { minScore: 0.85 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 3000, ...median }],
  'total-blocking-time': ['error', { maxNumericValue: 350, ...median }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.05, ...median }],
  'resource-summary:script:size': ['error', { maxNumericValue: 1050000, ...median }],
  'resource-summary:total:size': ['error', { maxNumericValue: 1450000, ...median }],
};

module.exports = {
  ci: {
    collect: {
      url: [
        `${process.env.NEXT_PUBLIC_PROD_HOST_API_URL}`,
        `${process.env.NEXT_PUBLIC_PROD_HOST_API_URL}/swagger`,
      ],
      psiStrategy: 'desktop',
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox',
        extraHeaders: JSON.stringify({
          [`aws-cf-cd-${process.env.NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME}`]:
            process.env.NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE,
        }),
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: 'lhci-reports-desktop',
    },
    assert: {
      assertMatrix: [
        { matchingUrlPattern: '.*localhost:3001/?$', assertions: homepageAssertions },
        { matchingUrlPattern: '.*swagger.*', assertions: swaggerAssertions },
      ],
    },
  },
};
