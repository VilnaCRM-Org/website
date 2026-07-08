import desktopConfig from '../../../../lighthouserc.desktop';
import mobileConfig from '../../../../lighthouserc.mobile';

/**
 * Locks the Lighthouse gate so a future edit cannot silently weaken it:
 * - the desktop config once nested `assertions`/`assertMatrix` directly under
 *   `ci` (never asserted); this guards the fixed `ci.assert` shape and that
 *   `assertMatrix` is used alone (LHCI errors on `assertMatrix` + `assertions`);
 * - the ratcheted per-page performance floors (tighten-only);
 * - the presence of LCP/TBT/CLS + script/total byte budgets on every page.
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

const HOME_URL = 'http://localhost:3001/';
const SWAGGER_URL = 'http://localhost:3001/swagger';
const METRIC_BUDGETS = [
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'resource-summary:script:size',
  'resource-summary:total:size',
] as const;

// The configs are `.js` (`module.exports`); cast through `unknown` since their
// inferred shape does not structurally overlap the narrowed test type.
const desktop = desktopConfig as unknown as LhciConfig;
const mobile = mobileConfig as unknown as LhciConfig;

const configs: Array<[string, LhciConfig]> = [
  ['desktop', desktop],
  ['mobile', mobile],
];

function matrixOf(config: LhciConfig): MatrixEntry[] {
  return config.ci.assert.assertMatrix;
}

function entryFor(config: LhciConfig, url: string): MatrixEntry {
  const match = matrixOf(config).find(entry => new RegExp(entry.matchingUrlPattern).test(url));
  if (!match) throw new Error(`no assertMatrix entry matched ${url}`);
  return match;
}

function perfFloor(config: LhciConfig, url: string): number {
  return entryFor(config, url).assertions['categories:performance'][1].minScore as number;
}

describe('lighthouse config', () => {
  it.each(configs)(
    '%s gates through assertMatrix alone (LHCI rejects assertMatrix + assertions)',
    (_name, config) => {
      expect(matrixOf(config)).toHaveLength(2);
      expect(config.ci.assert.assertions).toBeUndefined();
    }
  );

  it.each(configs)(
    '%s routes the homepage and swagger URLs to distinct entries',
    (_name, config) => {
      const homeMatches = matrixOf(config).filter(e =>
        new RegExp(e.matchingUrlPattern).test(HOME_URL)
      );
      const swaggerMatches = matrixOf(config).filter(e =>
        new RegExp(e.matchingUrlPattern).test(SWAGGER_URL)
      );
      expect(homeMatches).toHaveLength(1);
      expect(swaggerMatches).toHaveLength(1);
      expect(homeMatches[0]).not.toBe(swaggerMatches[0]);
    }
  );

  it('locks the ratcheted desktop performance floors (>= 0.85)', () => {
    expect(perfFloor(desktop, HOME_URL)).toBe(0.9);
    expect(perfFloor(desktop, SWAGGER_URL)).toBe(0.85);
  });

  it('lifts the mobile performance floors above the retired 0.24 non-gate', () => {
    const home = perfFloor(mobile, HOME_URL);
    const swagger = perfFloor(mobile, SWAGGER_URL);
    expect(home).toBe(0.5);
    expect(swagger).toBe(0.45);
    expect(home).toBeGreaterThan(0.24);
    expect(swagger).toBeGreaterThan(0.24);
  });

  it.each(configs)(
    '%s asserts LCP/TBT/CLS and script/total byte budgets on every page',
    (_name, config) => {
      for (const entry of matrixOf(config)) {
        for (const budget of METRIC_BUDGETS) {
          expect(entry.assertions[budget]).toBeDefined();
          expect(entry.assertions[budget][1].maxNumericValue).toBeGreaterThan(0);
        }
      }
    }
  );
});
