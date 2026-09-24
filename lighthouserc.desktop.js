require('dotenv').config();

const { assertMatrix } = require('./lighthouserc.shared');

// Desktop CI baseline (3-run median): homepage perf 0.94 — LCP 1.5s, TBT 2ms,
// script 634KB, total 1.35MB; swagger perf 0.89 — LCP 2.1s, TBT 117ms,
// script 941KB, total 1.26MB. Floors sit below the baseline with margin
// for shared-runner variance; see lighthouserc.shared.js for the ratchet rule.
//
// CLS, measured per sample (#493). The 0.01 recorded here before did not match
// what CI measured. Across 30 samples from 10 runs after the landing
// mount-order fix (35841312125, 35919691128, 35919842510, 35920615796,
// 35922413688, 35929332930, 35933099199, 35933615284, 35945072114,
// 35979329666):
// - homepage: 0 or 0.00036; the only shift left is on the header toolbar.
// - swagger, before the loading state reserved the viewport: 0.0445 in 23
//   samples and 0.0269 in 7, so the median sat at 89% of the ceiling. The
//   shifting node was footer#Contacts: the zero-height loading state left it
//   under the header, and each later state pushed it down
//   (src/features/swagger/README.md). Those samples are the failed-to-load
//   state. /swagger-schema.json returned 404 on every run, because the host
//   build path never runs scripts/patchSwaggerServer.mjs. Until the host
//   LHCI_RUN in the Makefile runs it, the swagger CLS assertion below measures
//   that failed state, not the documentation. See "What the Lighthouse gate
//   does not see yet" in src/features/swagger/README.md.
// The 0.05 ceiling is not moved. It was the measurement that was wrong, not
// the budget.
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
      assertMatrix: assertMatrix({
        homepage: {
          performance: 0.9,
          accessibility: 0.9,
          seo: 0.85,
          lcp: 2500,
          tbt: 150,
          cls: 0.05,
          scriptBytes: 750000,
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
          totalBytes: 1450000,
        },
      }),
    },
  },
};
