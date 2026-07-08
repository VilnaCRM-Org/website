require('dotenv').config();

const { assertMatrix } = require('./lighthouserc.shared');

// Mobile runs under Lighthouse's default emulation (Moto G4, 4x CPU throttle,
// simulated slow 4G), so scores sit well below desktop for the same build: the
// landing + header are client-rendered (ssr:false), which keeps LCP high on
// mobile. These floors lift the previous non-gate (0.24) to the measured
// envelope; #332 preserves the dynamic imports, so reducing the client-render
// cost is deliberately out of scope here.
//
// Mobile CI baseline (3-run median): homepage perf 0.55 (spread 0.36/0.55/0.57 —
// a cold-first-run pattern) — LCP 6.6s, TBT 755ms, CLS 0.00 (observed up to ~0.10
// on CI), script 634KB; swagger perf 0.50 — LCP 9.8s, TBT 1.37s, CLS 0.03,
// script 941KB. Floors/ceilings carry wide margin so runner variance cannot flake
// the gate; see lighthouserc.shared.js for the ratchet rule.
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
      assertMatrix: assertMatrix({
        homepage: {
          performance: 0.4,
          accessibility: 0.9,
          seo: 0.9,
          lcp: 11000,
          tbt: 1800,
          cls: 0.2,
          scriptBytes: 750000,
          totalBytes: 1550000,
        },
        swagger: {
          performance: 0.45,
          accessibility: 0.9,
          seo: 0.9,
          lcp: 12000,
          tbt: 2200,
          cls: 0.2,
          scriptBytes: 1050000,
          totalBytes: 1450000,
        },
      }),
    },
  },
};
