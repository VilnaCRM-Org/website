require('dotenv').config();

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
    // The assertions below were historically nested directly under `ci`, where
    // `lhci autorun` never runs them (it asserts only when `ci.assert` is
    // configured, or as a fallback when neither assert nor upload is set — and
    // upload IS set). They are now under `ci.assert` so the desktop gate is live.
    //
    // Ratchet rule: performance floors, metric ceilings, and byte budgets may only
    // move in the stricter direction (higher minScore, lower maxNumericValue). Any
    // change must be justified by a fresh CI baseline (`make lighthouse-desktop`).
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.6, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:bestPractices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.85 }],
      },
      assertMatrix: [
        {
          matchingUrlPattern: '.*swagger.*',
          assertions: {
            'categories:performance': [
              'error',
              { minScore: 0.59, aggregationMethod: 'median-run' },
            ],
            'categories:accessibility': ['error', { minScore: 0.89 }],
            'categories:bestPractices': ['error', { minScore: 0.9 }],
            'categories:seo': ['error', { minScore: 0.85 }],
          },
        },
      ],
    },
  },
};
