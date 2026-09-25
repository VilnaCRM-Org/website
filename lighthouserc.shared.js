// Shared Lighthouse (LHCI) assertion builders for the desktop and mobile configs.
// Both form factors gate the same per-page shape but carry different numeric
// budgets (each ratcheted from its own measured CI baseline), so the structure
// lives here and each config supplies only its numbers.
//
// Ratchet rule: performance floors, metric ceilings, and byte budgets may only
// move in the stricter direction (higher minScore, lower maxNumericValue).
// Re-baseline with `make lighthouse-desktop` / `make lighthouse-mobile` before
// changing any number; never loosen a budget to get a run green.

// Every gated assertion uses the representative (median) run so a single cold or
// slow run cannot flip the gate in either direction.
const median = { aggregationMethod: 'median-run' };

/**
 * Build the assertion set for one page from its ratcheted budgets.
 *
 * @param {object} budgets
 * @param {number} budgets.performance   category performance floor (minScore)
 * @param {number} budgets.accessibility category accessibility floor (minScore)
 * @param {number} budgets.seo           category SEO floor (minScore)
 * @param {number} budgets.lcp           largest-contentful-paint ceiling (ms)
 * @param {number} budgets.tbt           total-blocking-time ceiling (ms)
 * @param {number} budgets.cls           cumulative-layout-shift ceiling (unitless)
 * @param {number} budgets.scriptBytes   script transfer-size budget (bytes)
 * @param {number} budgets.stylesheetBytes stylesheet transfer-size budget (bytes)
 * @param {number} budgets.fontBytes     font transfer-size budget (bytes)
 * @param {number} budgets.imageBytes    image transfer-size budget (bytes)
 * @param {number} budgets.totalBytes    total transfer-size budget (bytes)
 * @param {number} [budgets.bestPractices=0.9] category best-practices floor
 */
function pageBudgets({
  performance,
  accessibility,
  seo,
  lcp,
  tbt,
  cls,
  scriptBytes,
  stylesheetBytes,
  fontBytes,
  imageBytes,
  totalBytes,
  bestPractices = 0.9,
}) {
  return {
    'categories:performance': ['error', { minScore: performance, ...median }],
    'categories:accessibility': ['error', { minScore: accessibility, ...median }],
    // Lighthouse category id is hyphenated; 'categories:bestPractices' would match
    // no category and silently never enforce the floor.
    'categories:best-practices': ['error', { minScore: bestPractices, ...median }],
    'categories:seo': ['error', { minScore: seo, ...median }],
    'largest-contentful-paint': ['error', { maxNumericValue: lcp, ...median }],
    'total-blocking-time': ['error', { maxNumericValue: tbt, ...median }],
    'cumulative-layout-shift': ['error', { maxNumericValue: cls, ...median }],
    'resource-summary:script:size': ['error', { maxNumericValue: scriptBytes, ...median }],
    'resource-summary:stylesheet:size': ['error', { maxNumericValue: stylesheetBytes, ...median }],
    'resource-summary:font:size': ['error', { maxNumericValue: fontBytes, ...median }],
    'resource-summary:image:size': ['error', { maxNumericValue: imageBytes, ...median }],
    'resource-summary:total:size': ['error', { maxNumericValue: totalBytes, ...median }],
  };
}

// Homepage matches the origin root (host/port-agnostic — an env override of
// WEBSITE_DOMAIN / NEXT_PUBLIC_PROD_PORT must not silently drop the gate) and
// never matches the /swagger path. LHCI applies no assertions to a URL matching
// no entry, so a host-literal pattern would be a silent bypass.
const HOMEPAGE_PATTERN = '://[^/]+/?$';
const SWAGGER_PATTERN = '.*swagger.*';

// Transfer-size budgets that do not depend on the form factor: script, stylesheet,
// font and total bytes are the same build on both, so one number serves both configs.
// The desktop homepage fetches its hero at two widths and the mobile one at one, so
// the homepage image budget is the one byte budget each config supplies itself.
const BYTE_BUDGETS = {
  homepage: { scriptBytes: 750000, stylesheetBytes: 45000, fontBytes: 500000, totalBytes: 1550000 },
  swagger: {
    scriptBytes: 1050000,
    stylesheetBytes: 45000,
    fontBytes: 500000,
    imageBytes: 15000,
    totalBytes: 1480000,
  },
};

/**
 * Assemble the assertMatrix (used alone — LHCI rejects assertMatrix combined
 * with a shared `assertions` block). Each page's form-factor budgets are merged
 * over BYTE_BUDGETS, so a config supplies scores, timings and any byte budget
 * that differs by form factor.
 */
function assertMatrix({ homepage, swagger }) {
  return [
    {
      matchingUrlPattern: HOMEPAGE_PATTERN,
      assertions: pageBudgets({ ...BYTE_BUDGETS.homepage, ...homepage }),
    },
    {
      matchingUrlPattern: SWAGGER_PATTERN,
      assertions: pageBudgets({ ...BYTE_BUDGETS.swagger, ...swagger }),
    },
  ];
}

module.exports = { assertMatrix, pageBudgets, BYTE_BUDGETS, HOMEPAGE_PATTERN, SWAGGER_PATTERN };
