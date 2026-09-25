require('dotenv').config();

const { assertMatrix } = require('./lighthouserc.shared');

// Desktop CI baseline (3-run median): homepage perf 0.94 — LCP 1.5s, TBT 2ms,
// CLS 0.01, script 634KB, total 1.35MB; swagger perf 0.89 — LCP 2.1s, TBT 117ms,
// CLS 0.01, script 941KB, total 1.26MB. Floors sit below the baseline with margin
// for shared-runner variance; see lighthouserc.shared.js for the ratchet rule.
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
      // Per-type transfer bytes (#341), max over 3 samples in each of CI runs 35945072114,
      // 36034847382 and 36038654988: homepage font 474,662 B (all 9 faces), stylesheet
      // 39,288 B, image 292,134 B; swagger font 474,662 B, stylesheet 37,158 B, image
      // 7,187 B. Font and stylesheet bytes are static per build and never varied between
      // samples, so their headroom is tight on purpose: the 25,338 B font margin is smaller
      // than the smallest face (25,508 B), so any added face fails. The swagger numbers were
      // measured with /swagger in its failed-to-load state; #498 makes the host build
      // render the documentation, and the first loaded-state run re-measures them.
      assertMatrix: assertMatrix({
        homepage: {
          performance: 0.9,
          accessibility: 0.9,
          seo: 0.85,
          lcp: 2500,
          tbt: 150,
          cls: 0.05,
          scriptBytes: 750000,
          stylesheetBytes: 45000,
          fontBytes: 500000,
          imageBytes: 320000,
          totalBytes: 1550000,
        },
        swagger: {
          performance: 0.85,
          // Swagger UI is third-party markup; its accessibility baseline is 0.89.
          accessibility: 0.89,
          seo: 0.85,
          lcp: 3000,
          tbt: 350,
          cls: 0.05,
          scriptBytes: 1050000,
          stylesheetBytes: 45000,
          fontBytes: 500000,
          imageBytes: 15000,
          totalBytes: 1450000,
        },
      }),
    },
  },
};
