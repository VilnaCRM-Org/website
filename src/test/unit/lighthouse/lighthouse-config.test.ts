import desktopConfig from '../../../../lighthouserc.desktop';
import mobileConfig from '../../../../lighthouserc.mobile';

/**
 * Ratchet guard for the Lighthouse gate — so a future edit cannot silently weaken
 * it. Locks:
 * - the `ci.assert.assertMatrix`-only shape (LHCI errors on assertMatrix combined
 *   with a shared `assertions` block — the reason the old desktop gate never ran);
 * - host-agnostic URL routing (a WEBSITE_DOMAIN / PROD_PORT change must not drop
 *   the homepage gate);
 * - the exact ratcheted floors, metric ceilings, and byte budgets on every page,
 *   each median-run aggregated. Loosening any number requires editing this table,
 *   making it a deliberate, reviewable change.
 */

type AssertionOptions = {
  minScore?: number;
  maxNumericValue?: number;
  aggregationMethod?: string;
};
type Assertion = [level: string, options: AssertionOptions];
type MatrixEntry = { matchingUrlPattern: string; assertions: Record<string, Assertion> };
type LhciConfig = {
  ci: { assert: { assertMatrix: MatrixEntry[]; assertions?: unknown } };
};

// The configs are `.js` (`module.exports`); cast through `unknown` since their
// inferred shape does not structurally overlap the narrowed test type.
const desktop = desktopConfig as unknown as LhciConfig;
const mobile = mobileConfig as unknown as LhciConfig;

// A finite key union (not `string`) so `EXPECTED[name]` stays a definite value
// under `noUncheckedIndexedAccess` — a `Record` over a literal union is a mapped
// type, not an index signature.
type ConfigName = 'desktop' | 'mobile';

const configs: Array<[ConfigName, LhciConfig]> = [
  ['desktop', desktop],
  ['mobile', mobile],
];

// A non-default origin proves the matchers are host/port-agnostic.
const HOME_URL = 'http://localhost:3001/';
const SWAGGER_URL = 'http://localhost:3001/swagger';
const ALT_HOME_URL = 'https://vilna.example:9999/';
const ALT_SWAGGER_URL = 'https://vilna.example:9999/swagger';

type Budgets = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  lcp: number;
  tbt: number;
  cls: number;
  scriptBytes: number;
  stylesheetBytes: number;
  fontBytes: number;
  imageBytes: number;
  totalBytes: number;
};

// Ratcheted budgets locked per config/page — mirror lighthouserc.*.js exactly.
const EXPECTED: Record<ConfigName, { home: Budgets; swagger: Budgets }> = {
  desktop: {
    home: {
      performance: 0.9,
      accessibility: 0.9,
      bestPractices: 0.9,
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
      bestPractices: 0.9,
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
  },
  mobile: {
    home: {
      performance: 0.4,
      accessibility: 0.9,
      bestPractices: 0.9,
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
      bestPractices: 0.9,
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
  },
};

// Lighthouse's ResourceSummary type ids, so a misspelt key cannot hide in both tables.
const BUDGETED_RESOURCE_KEYS = ['script', 'stylesheet', 'font', 'image', 'total'].map(
  type => `resource-summary:${type}:size`
);

// Every audited page loads all nine shipped faces (CI runs 35945072114, 36034847382,
// 36038654988); the smallest, Golos Text Regular, transfers 25,508 B.
const MEASURED_FONT_BYTES = 474662;
const SMALLEST_FONT_FACE_BYTES = 25508;

const MEDIAN = { aggregationMethod: 'median-run' };
const floor = (v: number): Assertion => ['error', { minScore: v, ...MEDIAN }];
const ceiling = (v: number): Assertion => ['error', { maxNumericValue: v, ...MEDIAN }];

function expectedAssertions(b: Budgets): Record<string, Assertion> {
  return {
    'categories:performance': floor(b.performance),
    'categories:accessibility': floor(b.accessibility),
    'categories:best-practices': floor(b.bestPractices),
    'categories:seo': floor(b.seo),
    'largest-contentful-paint': ceiling(b.lcp),
    'total-blocking-time': ceiling(b.tbt),
    'cumulative-layout-shift': ceiling(b.cls),
    'resource-summary:script:size': ceiling(b.scriptBytes),
    'resource-summary:stylesheet:size': ceiling(b.stylesheetBytes),
    'resource-summary:font:size': ceiling(b.fontBytes),
    'resource-summary:image:size': ceiling(b.imageBytes),
    'resource-summary:total:size': ceiling(b.totalBytes),
  };
}

function matrixOf(config: LhciConfig): MatrixEntry[] {
  return config.ci.assert.assertMatrix;
}

function entryFor(config: LhciConfig, url: string): MatrixEntry {
  const matches = matrixOf(config).filter(entry => new RegExp(entry.matchingUrlPattern).test(url));
  expect(matches).toHaveLength(1);
  const [firstMatch] = matches;
  if (firstMatch === undefined) throw new Error(`No matrix entry matched ${url}`);
  return firstMatch;
}

describe('lighthouse config', () => {
  it.each(configs)(
    '%s gates through assertMatrix alone (LHCI rejects assertMatrix + assertions)',
    (_name, config) => {
      expect(matrixOf(config)).toHaveLength(2);
      expect(config.ci.assert.assertions).toBeUndefined();
    }
  );

  it.each(configs)('%s routes homepage and swagger URLs host-agnostically', (_name, config) => {
    // Same entry for the default and a non-default origin — the matcher is not
    // coupled to WEBSITE_DOMAIN / NEXT_PUBLIC_PROD_PORT.
    expect(entryFor(config, HOME_URL)).toBe(entryFor(config, ALT_HOME_URL));
    expect(entryFor(config, SWAGGER_URL)).toBe(entryFor(config, ALT_SWAGGER_URL));
    expect(entryFor(config, HOME_URL)).not.toBe(entryFor(config, SWAGGER_URL));
  });

  it.each(configs)('%s locks the exact ratcheted budgets on every page', (name, config) => {
    expect(entryFor(config, HOME_URL).assertions).toEqual(expectedAssertions(EXPECTED[name].home));
    expect(entryFor(config, SWAGGER_URL).assertions).toEqual(
      expectedAssertions(EXPECTED[name].swagger)
    );
  });

  it.each(configs)(
    '%s budgets script, stylesheet, font, image and total bytes on every page',
    (_name, config) => {
      matrixOf(config).forEach(entry => {
        const budgeted = Object.keys(entry.assertions).filter(key =>
          key.startsWith('resource-summary:')
        );
        expect(budgeted.sort()).toEqual([...BUDGETED_RESOURCE_KEYS].sort());
      });
    }
  );

  it.each(configs)('%s font budget fits the shipped faces but not one more', name => {
    [EXPECTED[name].home, EXPECTED[name].swagger].forEach(page => {
      expect(page.fontBytes).toBeGreaterThanOrEqual(MEASURED_FONT_BYTES);
      expect(page.fontBytes).toBeLessThan(MEASURED_FONT_BYTES + SMALLEST_FONT_FACE_BYTES);
    });
  });

  it('keeps desktop performance floors at or above 0.85', () => {
    expect(EXPECTED.desktop.home.performance).toBeGreaterThanOrEqual(0.85);
    expect(EXPECTED.desktop.swagger.performance).toBeGreaterThanOrEqual(0.85);
  });

  it('lifts the mobile performance floors above the retired 0.24 non-gate', () => {
    expect(EXPECTED.mobile.home.performance).toBeGreaterThan(0.24);
    expect(EXPECTED.mobile.swagger.performance).toBeGreaterThan(0.24);
  });
});
