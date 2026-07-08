require('dotenv').config();

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
    // Ratchet rule: performance floors, metric ceilings, and byte budgets may only
    // move in the stricter direction (higher minScore, lower maxNumericValue). Any
    // change must be justified by a fresh CI baseline (`make lighthouse-mobile`).
    // Mobile runs under Lighthouse's default emulation (Moto G4, 4x CPU throttle,
    // simulated slow 4G), so its scores sit below desktop for the same build.
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.24, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:bestPractices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
  },
};
