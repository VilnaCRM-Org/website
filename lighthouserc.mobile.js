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
// a cold-first-run pattern) — LCP 6.6s, TBT 755ms, script 634KB; swagger perf 0.50
// — LCP 9.8s, TBT 1.37s, script 941KB. Floors/ceilings carry wide margin so runner
// variance cannot flake the gate; see lighthouserc.shared.js for the ratchet rule.
//
// Ratchet plan toward desktop parity (0.6) — issue #338.
//
// The floors below are the measured envelope, not the target. Mobile is the
// dominant device class for a marketing site, so the gate is expected to tighten
// on a schedule, and it may only ever move in the stricter direction (see the
// ratchet rule in lighthouserc.shared.js).
//
// The binding constraint is architectural, not budgetary: the landing page and
// its header are client-rendered (`ssr: false` in pages/_app.tsx and
// pages/index.tsx's feature entry), so on Moto G4 emulation the LCP element does
// not exist until the bundle has downloaded, parsed and hydrated. No amount of
// budget tightening moves the score past roughly 0.6 while that holds. The steps
// are therefore gated on work, not on time:
//
//   Step 1 (no product change) — after two consecutive weeks with no mobile
//     Lighthouse failure, re-baseline with `make lighthouse-mobile` and raise the
//     homepage floor to the measured median minus 0.10 (today that is 0.45), and
//     the swagger floor by the same rule. This closes the slack that exists only
//     to absorb the cold-first-run spread recorded above.
//   Step 2 (server-render the above-the-fold shell) — once the header and hero
//     render without waiting for hydration, LCP drops into the 3–4s band; raise
//     the homepage floor to 0.55 and tighten the LCP ceiling to the new median
//     plus 20%.
//   Step 3 (parity) — with the shell server-rendered and the script budget under
//     500KB, raise the homepage floor to 0.60, matching desktop.
//
// Never lower a floor to make a run green: re-run first (the spread above is
// real), and if the regression is genuine, fix the regression.
//
// Mobile CLS is deliberately gated loose (0.5): the client-rendered content pops
// in as it hydrates, so lab CLS is both high and very unstable across CI runs
// (observed 0.00 / 0.10 / 0.24), making a tight lab ceiling a flake source. The
// meaningful CLS signal is the real-user field value now collected via
// reportWebVitals; the lab ceiling here only catches a catastrophic regression.
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
          cls: 0.5,
          scriptBytes: 750000,
          totalBytes: 1550000,
        },
        swagger: {
          performance: 0.45,
          accessibility: 0.9,
          seo: 0.9,
          lcp: 12000,
          tbt: 2200,
          cls: 0.5,
          scriptBytes: 1050000,
          totalBytes: 1450000,
        },
      }),
    },
  },
};
