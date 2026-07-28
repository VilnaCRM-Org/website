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
    check: value => {
      const maxAge = directiveValue(value, 'max-age');
      return (
        maxAge !== null &&
        /^\d+$/.test(maxAge) &&
        Number(maxAge) >= HSTS_MIN_MAX_AGE &&
        hasDirective(value, 'includeSubDomains') &&
        hasDirective(value, 'preload')
      );
    },
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
      const ok = check(value);
      record('policy', name, ok, ok ? value : `"${value}" ${requirement}`);
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
      scope: 'viewer-response (origin error)',
      response: { statusCode: 403, statusDescription: 'Forbidden', headers: {} },
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
