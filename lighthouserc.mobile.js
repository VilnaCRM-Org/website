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
// a cold-first-run pattern) — LCP 6.6s, TBT 755ms; swagger perf 0.50 — LCP 9.8s,
// TBT 1.37s. Floors/ceilings carry wide margin so runner variance cannot flake the
// gate; see lighthouserc.shared.js for the ratchet rule. Script bytes were re-read
// from CI runs 35945072114, 36034847382 and 36038654988: homepage 516,563-517,866 B,
// swagger 892,851-909,116 B (the 634KB / 941KB recorded here before were stale).
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
      // Per-type transfer bytes (#341), max over the same three runs: homepage font
      // 474,662 B (all 9 faces), stylesheet 39,288 B, image 197,846 B; swagger font
      // 474,662 B, stylesheet 37,158 B, image 7,717 B. The homepage image budget is the
      // first byte budget that differs from desktop (292,134 B there): the desktop
      // viewport fetches the 99,529 B desktop hero at two widths (3840w and 2048w), the
      // mobile viewport once. Font and stylesheet margins are tight on purpose (see
      // lighthouserc.desktop.js).
      //
      // Swagger loaded-state baseline (#498), 3 samples of CI run 36118768171, the first run
      // in which /swagger-schema.json returned 200: perf 0.45 on every sample, accessibility
      // 0.94, SEO 0.92, LCP 11,571-11,624 ms, TBT 2,286-2,423 ms, CLS 0.08, image 11,455 B,
      // total 1,453,591 B. The earlier swagger floors (perf 0.45, LCP 12s, TBT 2.2s, total
      // 1.45 MB) were calibrated on the LoadError page; rendering the operations adds the
      // 3,953 B schema and the swagger-ui render cost. The re-calibrated values keep the same
      // wide-margin rule as the homepage: perf 0.4, LCP 14s, TBT 3s, total 1,480,000.
      // After the spec-load plugin (CI run 36138356951): perf 0.49-0.50, TBT 1,218-1,339 ms,
      // LCP 11,409-11,478 ms.
      assertMatrix: assertMatrix({
        homepage: {
          performance: 0.4,
          accessibility: 0.9,
          seo: 0.9,
          lcp: 11000,
          tbt: 1800,
          cls: 0.5,
          scriptBytes: 750000,
          stylesheetBytes: 45000,
          fontBytes: 500000,
          imageBytes: 220000,
          totalBytes: 1550000,
        },
        swagger: {
          performance: 0.4,
          accessibility: 0.9,
          seo: 0.9,
          lcp: 14000,
          tbt: 3000,
          cls: 0.5,
          scriptBytes: 1050000,
          stylesheetBytes: 45000,
          fontBytes: 500000,
          imageBytes: 15000,
          totalBytes: 1480000,
        },
      }),
    },
  },
};
