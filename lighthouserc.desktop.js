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
    assertions: {
      'categories:performance': ['error', { minScore: 0.6 }],
      'categories:accessibility': ['error', { minScore: 0.9 }],
      'categories:bestPractices': ['error', { minScore: 0.9 }],
      'categories:seo': ['error', { minScore: 0.85 }],
    },
    assertMatrix: [
      {
        matchingUrlPattern: '.*swagger.*',
        assertions: {
          'categories:performance': ['error', { minScore: 0.59 }],
          'categories:accessibility': ['error', { minScore: 0.89 }],
          'categories:bestPractices': ['error', { minScore: 0.9 }],
          'categories:seo': ['error', { minScore: 0.85 }],
        },
      },
    ],
  },
};
