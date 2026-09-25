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
      // than the smallest face (25,508 B), so any added face fails.
      //
      // Swagger loaded-state baseline (#498), 3 samples of CI run 36118768171, the first run
      // in which /swagger-schema.json returned 200: perf 0.71/0.88/0.87, accessibility 0.95,
      // SEO 0.92, LCP 2,242-2,268 ms, TBT 91-401 ms, CLS 0.048, script 910,234 B, image
      // 10,730-10,843 B, total 1,452,869-1,452,982 B. Every earlier swagger number measured
      // the LoadError page, so the total grows by the 3,953 B schema plus the rendered
      // operations (1,480,000 keeps about 27 KB of headroom), and accessibility moves UP to
      // 0.9 now that the audited markup is the real documentation.
      //
      // The perf floor held only on fast runners (a slow run scored 0.72/0.76/0.75), so the
      // spec-load plugin (src/features/swagger/README.md, "Load performance") removed the
      // duplicate spec parse and the ApiDOM normalization of the security schemes. CI run
      // 36138356951 after it: perf 0.84/0.85/0.86, TBT 122-146 ms, LCP 2,302-2,390 ms. LCP is
      // now the binding metric, and it is page weight: 474,662 B of fonts preloaded on every
      // route plus 910,548 B of swagger-ui script, so the next gain is there, not in the floor.
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
          accessibility: 0.9,
          seo: 0.85,
          lcp: 3000,
          tbt: 350,
          cls: 0.05,
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
