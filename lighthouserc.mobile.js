require('dotenv').config();

// Per-page mobile Lighthouse budgets. LHCI rejects a shared `assertions` block
// alongside `assertMatrix`, so all gating lives in assertMatrix entries — which
// also lets the heavier Swagger UI page carry looser floors than the homepage.
//
// Ratchet rule: floors, metric ceilings, and byte budgets are ratcheted from a
// 3-run CI median baseline (PR #332) and may only move in the stricter direction
// (higher minScore, lower maxNumericValue). Re-baseline with
// `make lighthouse-mobile` before changing any number; never loosen to get green.
//
// Mobile runs under Lighthouse's default emulation (Moto G4, 4x CPU throttle,
// simulated slow 4G), so scores sit well below desktop for the same build: the
// landing + header are client-rendered (ssr:false), which keeps LCP high on
// mobile. These floors ratchet the previous non-gate (0.24) up to the measured
// envelope; tighten them as the client-render cost is reduced (#332 preserves the
// dynamic imports, so that is deliberately out of scope here).
//
// Mobile CI baseline (median): homepage perf 0.55 — LCP 6.6s, TBT 755ms, CLS 0.00,
// script 634KB; swagger perf 0.50 — LCP 9.8s, TBT 1.37s, CLS 0.03, script 941KB.
const median = { aggregationMethod: 'median-run' };

const homepageAssertions = {
  'categories:performance': ['error', { minScore: 0.5, ...median }],
  'categories:accessibility': ['error', { minScore: 0.9 }],
  'categories:bestPractices': ['error', { minScore: 0.9 }],
  'categories:seo': ['error', { minScore: 0.9 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 8500, ...median }],
  'total-blocking-time': ['error', { maxNumericValue: 1200, ...median }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.05, ...median }],
  'resource-summary:script:size': ['error', { maxNumericValue: 750000, ...median }],
  'resource-summary:total:size': ['error', { maxNumericValue: 1550000, ...median }],
};

const swaggerAssertions = {
  'categories:performance': ['error', { minScore: 0.45, ...median }],
  'categories:accessibility': ['error', { minScore: 0.9 }],
  'categories:bestPractices': ['error', { minScore: 0.9 }],
  'categories:seo': ['error', { minScore: 0.9 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 12000, ...median }],
  'total-blocking-time': ['error', { maxNumericValue: 2200, ...median }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, ...median }],
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
      psiStrategy: 'mobile',
      settings: {
        chromeFlags: '--no-sandbox',
        extraHeaders: JSON.stringify({
          [`aws-cf-cd-${process.env.NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME}`]:
            process.env.NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE,
        }),
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: 'lhci-reports-mobile',
    },
    assert: {
      assertMatrix: [
        { matchingUrlPattern: '.*localhost:3001/?$', assertions: homepageAssertions },
        { matchingUrlPattern: '.*swagger.*', assertions: swaggerAssertions },
      ],
    },
  },
};
