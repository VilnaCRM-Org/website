#!/usr/bin/env node
/**
 * Security-header gate (issue #377) — `make lint-headers`.
 *
 * The production site is a static export behind CloudFront, so Next's `headers()` is a
 * no-op and the edge functions under `scripts/` are the only place security headers can be
 * attached. This gate makes that enforcement point reviewable and non-regressable:
 *
 *   1. `config/security-headers.json` is the single source of truth. Its values are checked
 *      against a baseline encoded here, so the policy cannot be silently weakened (dropping
 *      a header, downgrading `X-Frame-Options`, shortening `max-age`) without this gate
 *      failing.
 *   2. `scripts/cloudfront_security_headers.js` (viewer-response) is executed against a real
 *      PAGE response and a real ASSET response — the exact `curl -I` surfaces the issue's
 *      acceptance criteria name — and must emit every policy header with the exact value.
 *   3. `scripts/cloudfront_routing.js` (viewer-request) short-circuits unknown top-level
 *      paths with a synthetic 404. CloudFront does not run the viewer-response function for
 *      such a response, so that 404 must carry the same headers inline; it is executed and
 *      checked here too.
 *
 * The edge functions are bare CloudFront Functions modules (`function handler(event) {}`
 * with no `module.exports`), so they are loaded through `node:vm` exactly as the edge unit
 * tests do — the deployed artifacts stay byte-identical.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const POLICY_PATH = path.join(ROOT, 'config/security-headers.json');
const RESPONSE_FN_PATH = path.join(ROOT, 'scripts/cloudfront_security_headers.js');
const ROUTING_FN_PATH = path.join(ROOT, 'scripts/cloudfront_routing.js');

/**
 * The posture the policy must keep. Each entry validates the VALUE in
 * config/security-headers.json; a missing key is a failure on its own.
 *
 * The anti-framing entries are pinned to the EXACT mandated values rather than to a
 * permissive minimum: `frame-ancestors 'self'` / `SAMEORIGIN` would still allow same-origin
 * framing of the sign-up form, so accepting them here would let the policy be quietly
 * weakened while the gate stayed green. Relaxing one is possible — but only by editing this
 * baseline in the same reviewed diff.
 *
 * `referrer-policy` keeps an allow-list because its accepted values are equivalent for this
 * threat (none of them leak a full URL cross-origin).
 */
const HSTS_MIN_MAX_AGE = 31536000; // one year — the HSTS preload-list minimum

/**
 * The powerful features the site never uses and that carry the highest abuse value if a
 * third-party frame or an injected script ever reaches for one. The policy may deny more;
 * it may not deny fewer.
 */
const MUST_DENY_FEATURES = Object.freeze([
  'camera',
  'display-capture',
  'geolocation',
  'microphone',
  'payment',
  'usb',
]);

/**
 * Match a whole semicolon-delimited directive, not a substring: `notpreload` and
 * `xincludeSubDomains` must not satisfy a `preload` / `includeSubDomains` requirement.
 */
function hasDirective(value, directive) {
  return new RegExp(String.raw`(?:^|;)\s*${directive}\s*(?:;|$)`, 'i').test(value);
}

function directiveValue(value, directive) {
  const match = new RegExp(String.raw`(?:^|;)\s*${directive}=([^;\s]+)\s*(?:;|$)`, 'i').exec(value);
  return match === null ? null : match[1];
}

/**
 * Read a `Permissions-Policy` value the way a browser does: as an RFC 8941 structured-field
 * DICTIONARY, not as text.
 *
 * This is a parse rather than a regex for the same reason #447's workflow-pin gate parses
 * workflow YAML instead of scanning it — a pattern and the real parser disagree in exactly
 * the places that matter, and every disagreement here is a fail-open:
 *
 *   - Whitespace around `=` (`camera =()`, `camera= ()`) is a PARSE ERROR in a dictionary,
 *     and a Permissions-Policy header that fails to parse is discarded IN ITS ENTIRETY.
 *     One stray space in config/security-headers.json therefore turns off all seventeen
 *     denials at once, while a `\s*=\s*` pattern reports the feature as denied.
 *   - Duplicate keys resolve LAST-wins, so `camera=(), camera=*` GRANTS camera to every
 *     origin — but an `(?:^|,)`-anchored pattern is satisfied by the first occurrence.
 *
 * So a malformed member fails the whole value, and duplicates are resolved last-wins before
 * any feature is judged.
 *
 * Returns `{ members }` on success or `{ error }` describing the first malformed member.
 */
function parsePermissionsPolicy(value) {
  const members = new Map();
  let depth = 0;
  let start = 0;
  const raw = [];

  for (let index = 0; index <= value.length; index += 1) {
    const char = value[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if ((char === ',' && depth === 0) || index === value.length) {
      raw.push(value.slice(start, index));
      start = index + 1;
    }
  }

  for (const entry of raw) {
    // OWS around a member is legal; whitespace touching the `=` inside it is not.
    const member = entry.trim();
    if (member === '') {
      return { error: 'contains an empty dictionary member' };
    }
    const match = /^([a-z*][a-z0-9_.*-]*)=(\S.*)$/.exec(member);
    if (match === null) {
      return {
        error: `has the malformed member "${member}" — a browser discards the WHOLE header (every feature reverts to its default allow-list) when a dictionary member does not parse`,
      };
    }
    // Last instance of a duplicate key wins, exactly as dictionary parsing does.
    members.set(match[1], match[2].trim());
  }

  return { members };
}

/**
 * A `Permissions-Policy` directive denies a feature outright only when its resolved value is
 * an EMPTY allow-list: `camera=()` (or `camera=( )`, an empty inner list). `camera=(self)`
 * still permits the feature on this origin and `camera=*` permits it everywhere, so both
 * fail. Keys are compared whole, so a lookalike (`xcamera=()`) can never satisfy `camera`.
 */
function deniesFeature(members, feature) {
  const allowList = members.get(feature);
  return allowList !== undefined && /^\(\s*\)$/.test(allowList);
}

/**
 * The permissions-policy baseline check: a parse failure is reported as the header-wide
 * outage it really is, and only then is each required denial judged.
 */
function checkPermissionsPolicy(value) {
  const { members, error } = parsePermissionsPolicy(value);
  if (error !== undefined) {
    return error;
  }
  const permitted = MUST_DENY_FEATURES.filter(feature => !deniesFeature(members, feature));
  if (permitted.length > 0) {
    return `does not deny with an empty allow-list: ${permitted.join(', ')}`;
  }
  return true;
}

function checkHsts(value) {
  const maxAge = directiveValue(value, 'max-age');
  if (maxAge === null || !/^\d+$/.test(maxAge)) {
    return false;
  }
  if (Number(maxAge) < HSTS_MIN_MAX_AGE) {
    return false;
  }
  return hasDirective(value, 'includeSubDomains') && hasDirective(value, 'preload');
}

const BASELINE = {
  'content-security-policy': {
    requirement: "must be exactly frame-ancestors 'none'",
    check: value => value.trim() === "frame-ancestors 'none'",
  },
  'x-frame-options': {
    requirement: 'must be DENY',
    check: value => value === 'DENY',
  },
  'x-content-type-options': {
    requirement: 'must be nosniff',
    check: value => value === 'nosniff',
  },
  'referrer-policy': {
    requirement: 'must not leak full URLs cross-origin',
    check: value =>
      ['no-referrer', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin'].includes(
        value
      ),
  },
  'strict-transport-security': {
    requirement: `max-age must be >= ${HSTS_MIN_MAX_AGE} (1 year) and include includeSubDomains and preload`,
    check: value => checkHsts(value),
  },
  'permissions-policy': {
    requirement: `must parse as an RFC 8941 dictionary and deny every unused powerful feature with an empty allow-list: ${MUST_DENY_FEATURES.join(', ')}`,
    check: value => checkPermissionsPolicy(value),
  },
};

const failures = [];
const checks = [];

function record(scope, name, ok, detail) {
  checks.push({ scope, name, ok, detail });
  if (!ok) {
    failures.push(`${scope}: ${name} — ${detail}`);
  }
}

function loadHandler(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const context = { console: { log: () => {} } };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.resolvedHandler = handler;`, context, { filename: filePath });
  if (typeof context.resolvedHandler !== 'function') {
    throw new Error(`${path.relative(ROOT, filePath)} did not expose a handler function`);
  }
  return context.resolvedHandler;
}

function readPolicy() {
  const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
  if (!policy.headers || typeof policy.headers !== 'object') {
    throw new Error('config/security-headers.json must define a "headers" object');
  }
  return policy;
}

function checkPolicyBaseline(policyHeaders) {
  for (const [name, { requirement, check }] of Object.entries(BASELINE)) {
    const value = policyHeaders[name];
    if (typeof value !== 'string') {
      record('policy', name, false, `missing from config/security-headers.json (${requirement})`);
    } else {
      // A check may return `true`, `false`, or a string explaining precisely how the value
      // fails — the permissions-policy parse uses the string form, because "the browser
      // drops the entire header" is not something the generic requirement text conveys.
      const result = check(value);
      const ok = result === true;
      const reason = typeof result === 'string' ? result : requirement;
      record('policy', name, ok, ok ? value : `"${value}" ${reason}`);
    }
  }
}

/**
 * `appliedBy` documents which edge functions carry the policy; a stale entry would send a
 * reviewer to a file that no longer exists, so it is verified rather than trusted.
 */
function checkAppliedByPaths(appliedBy) {
  for (const relativePath of appliedBy ?? []) {
    const exists = fs.existsSync(path.join(ROOT, relativePath));
    record('policy.appliedBy', relativePath, exists, exists ? 'exists' : 'file not found');
  }
}

function checkEmittedHeaders(scope, emitted, policyHeaders) {
  for (const [name, expected] of Object.entries(policyHeaders)) {
    const actual = emitted?.[name]?.value;
    record(
      scope,
      name,
      actual === expected,
      actual === expected ? expected : `expected "${expected}", got ${JSON.stringify(actual)}`
    );
  }
}

function checkViewerResponse(policyHeaders) {
  const handler = loadHandler(RESPONSE_FN_PATH);

  const surfaces = [
    {
      scope: 'viewer-response (page)',
      response: {
        statusCode: 200,
        statusDescription: 'OK',
        headers: { 'content-type': { value: 'text/html; charset=utf-8' } },
      },
    },
    {
      scope: 'viewer-response (asset)',
      response: {
        statusCode: 200,
        statusDescription: 'OK',
        headers: { 'content-type': { value: 'application/javascript' } },
      },
    },
    {
      // A 3xx is the last status CloudFront still runs a viewer-response function for:
      // it skips the function entirely once the origin returns 400 or higher, which is a
      // documented gap covered by a response headers policy (see docs/security-headers.md),
      // not something this handler can close.
      scope: 'viewer-response (redirect)',
      response: {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: { location: { value: '/' } },
      },
    },
  ];

  for (const { scope, response } of surfaces) {
    const result = handler({ request: { uri: '/' }, response });
    checkEmittedHeaders(scope, result.headers, policyHeaders);
  }
}

function checkRoutingNotFound(policyHeaders) {
  const handler = loadHandler(ROUTING_FN_PATH);
  const result = handler({ request: { uri: '/unknown-path' } });

  if (result.statusCode !== 404) {
    record(
      'viewer-request (synthetic 404)',
      'statusCode',
      false,
      `expected the unknown-path branch to return a 404, got ${JSON.stringify(result.statusCode)}`
    );
    return;
  }

  checkEmittedHeaders('viewer-request (synthetic 404)', result.headers, policyHeaders);
}

function report() {
  const scopeWidth = Math.max(...checks.map(({ scope }) => scope.length));
  const nameWidth = Math.max(...checks.map(({ name }) => name.length));

  for (const { scope, name, ok, detail } of checks) {
    process.stdout.write(
      `${ok ? '✓' : '✗'} ${scope.padEnd(scopeWidth)}  ${name.padEnd(nameWidth)}  ${detail}\n`
    );
  }

  if (failures.length > 0) {
    process.stderr.write(
      `\n❌ security headers: ${failures.length} failing check(s).\n` +
        'Fix the policy or the edge functions — never drop a header to silence this gate.\n'
    );
    process.exit(1);
  }

  process.stdout.write(
    `\n✅ security headers: ${checks.length} checks passed across the policy, the viewer-response function, and the synthetic 404.\n`
  );
}

const policy = readPolicy();
const policyHeaders = policy.headers;
checkPolicyBaseline(policyHeaders);
checkAppliedByPaths(policy.appliedBy);
checkViewerResponse(policyHeaders);
checkRoutingNotFound(policyHeaders);
report();
