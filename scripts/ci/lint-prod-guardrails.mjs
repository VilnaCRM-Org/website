#!/usr/bin/env node
// Production-safety guardrail gate (issue #383).
//
// Three invariants only ever hold in production, where no PR check watches
// them, so each has already regressed silently at least once in this class of
// repo. This gate is hermetic (it reads committed files, never the network) and
// therefore runs inside `make lint` on every PR:
//
//   A. Every privileged workflow (assumes an AWS role, or cuts a release) that
//      runs on a non-pull-request trigger must be covered by an alert/audit
//      workflow, so a post-merge failure reaches a human.
//   B. The CloudFront edge handler must keep its allow-list + synthetic 404 and
//      must stay pinned inside the 100%-coverage `edge` Jest layer, so it can
//      never silently degrade into an unconditional origin pass-through.
//   C. `next.config.js` must not enable productionBrowserSourceMaps, which
//      publishes readable application source to the CDN.
//
// Collect-all-then-fail: every violation is reported in one run.
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const WORKFLOW_DIR = '.github/workflows';
const EDGE_SCRIPT = 'scripts/cloudfront_routing.js';
const JEST_CONFIG = 'jest.config.ts';
const NEXT_CONFIG = 'next.config.js';

// A privileged workflow whose triggers are all PR-scoped is already watched: a
// failure lands as a red check on the pull request. Every other trigger runs
// where nobody is looking.
const WATCHED_TRIGGERS = new Set(['pull_request', 'pull_request_target', 'merge_group']);

const AWS_CREDENTIALS_ACTION = 'aws-actions/configure-aws-credentials';
const RELEASE_ACTIONS = [
  'actions/create-release',
  'softprops/action-gh-release',
  'ncipollo/release-action',
  'TriPSs/conventional-changelog-action',
];

const root = path.resolve(process.argv[2] ?? process.cwd());
const failures = [];

function fail(assertion, message) {
  failures.push(`[${assertion}] ${message}`);
}

function readIfPresent(relative) {
  const full = path.join(root, relative);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

function loadWorkflows() {
  const dir = path.join(root, WORKFLOW_DIR);
  if (!fs.existsSync(dir)) {
    fail('A', `${WORKFLOW_DIR}/ is missing; the privileged-workflow audit cannot run.`);
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter(file => /\.ya?ml$/.test(file))
    .map(file => {
      let doc;
      try {
        doc = yaml.load(fs.readFileSync(path.join(dir, file), 'utf8')) ?? {};
      } catch (error) {
        // An unparseable workflow must be a reported failure, not a stack trace:
        // a duplicate key or bad indent would otherwise crash the gate and take
        // assertions B and C down with it, hiding unrelated regressions.
        fail(
          'A',
          `${WORKFLOW_DIR}/${file} is not valid YAML, so its privileges cannot be audited: ` +
            `${error.message.split('\n')[0]}`
        );
        return null;
      }
      // YAML 1.1 folds a bare `on:` key to boolean true; js-yaml v4 (YAML 1.2
      // core) keeps it a string. Read both so the gate is parser-agnostic.
      // (A boolean key reaches JS as the string 'true', hence `doc.true`.)
      const triggers = doc.on ?? doc.true ?? {};
      return { file, name: typeof doc.name === 'string' ? doc.name : file, doc, triggers };
    })
    .filter(Boolean);
}

function stepsOf(doc) {
  const jobs = doc.jobs && typeof doc.jobs === 'object' ? Object.values(doc.jobs) : [];
  return jobs.flatMap(job => (Array.isArray(job?.steps) ? job.steps : []));
}

function assumesAwsRole(step) {
  const uses = typeof step?.uses === 'string' ? step.uses : '';
  const run = typeof step?.run === 'string' ? step.run : '';
  const hasRoleInput =
    step?.with && typeof step.with === 'object' && Object.hasOwn(step.with, 'role-to-assume');
  return (
    uses.startsWith(AWS_CREDENTIALS_ACTION) ||
    Boolean(hasRoleInput) ||
    // The action is the documented path, but a role can also be assumed straight
    // from the CLI, and a local composite action hides its steps from this audit
    // entirely — treat both as privileged rather than as invisible.
    /\baws\s+sts\s+assume-role(-with-web-identity)?\b/.test(run) ||
    /^\.\/\.github\/actions\//.test(uses)
  );
}

function createsRelease(step) {
  const uses = typeof step?.uses === 'string' ? step.uses : '';
  const run = typeof step?.run === 'string' ? step.run : '';
  return (
    RELEASE_ACTIONS.some(action => uses.startsWith(action)) || /\bgh\s+release\s+create\b/.test(run)
  );
}

function triggerKeys(triggers) {
  if (Array.isArray(triggers)) return triggers.map(String);
  if (typeof triggers === 'string') return [triggers];
  return triggers && typeof triggers === 'object' ? Object.keys(triggers) : [];
}

function runsUnwatched(triggers) {
  return triggerKeys(triggers).some(key => !WATCHED_TRIGGERS.has(key));
}

// A workflow only provides coverage if it can actually reach a human, i.e. it
// grants `issues: write` (files/refreshes the ci-alert or ledger issue). Without
// that test, adding any unrelated `workflow_run` listener — or a release
// workflow that listens to its own `release` event — would satisfy the audit
// requirement while alerting nobody.
function canAlertHumans(doc) {
  const jobs = doc?.jobs && typeof doc.jobs === 'object' ? Object.values(doc.jobs) : [];
  const grantsIssueWrite = perms => perms && typeof perms === 'object' && perms.issues === 'write';
  return grantsIssueWrite(doc?.permissions) || jobs.some(job => grantsIssueWrite(job?.permissions));
}

// Coverage is a relationship across the workflow directory rather than a
// hardcoded filename, so renaming the alert workflow does not silently disable
// this assertion — but only alerting workflows count, and a workflow can never
// vouch for itself.
function collectAlertCoverage(workflows, audited) {
  const alertedNames = new Set();
  let hasReleaseAudit = false;
  workflows.forEach(workflow => {
    if (workflow.file === audited.file) return;
    if (!canAlertHumans(workflow.doc)) return;
    const listed = workflow.triggers?.workflow_run?.workflows;
    if (Array.isArray(listed)) listed.forEach(name => alertedNames.add(String(name)));
    if (triggerKeys(workflow.triggers).includes('release')) hasReleaseAudit = true;
  });
  return { alertedNames, hasReleaseAudit };
}

function assertPrivilegedWorkflowsAreAlerted(workflows) {
  workflows.forEach(workflow => {
    const steps = stepsOf(workflow.doc);
    const aws = steps.some(assumesAwsRole);
    const release = steps.some(createsRelease);
    if (!aws && !release) return;
    if (!runsUnwatched(workflow.triggers)) return;
    const { alertedNames, hasReleaseAudit } = collectAlertCoverage(workflows, workflow);
    if (alertedNames.has(workflow.name)) return;
    if (release && !aws && hasReleaseAudit) return;
    const privilege = aws ? 'assumes an AWS role' : 'creates a GitHub release';
    fail(
      'A',
      `${WORKFLOW_DIR}/${workflow.file} (name: "${workflow.name}") ${privilege} on a ` +
        `non-pull-request trigger, but no workflow lists "${workflow.name}" under ` +
        `on.workflow_run.workflows. Add it to the alert workflow ` +
        `(${WORKFLOW_DIR}/ci-health-alerts.yml) so a post-merge failure reaches a human.`
    );
  });
}

// The behavioural contract (which URIs 404) is owned by the 100%-coverage edge
// Jest layer, which vm-loads this exact file. What that layer structurally
// cannot assert about itself is the shape below: that the allow-list maps are
// still immutable and that the handler still fails closed instead of ending in
// an unconditional origin pass-through.
// The semicolon is optional (ASI makes a bare `return request` valid) and a
// trailing comment must not hide the fallthrough, so comments are stripped
// before this is applied rather than being tolerated by the pattern.
const ORIGIN_PASSTHROUGH_TAIL = /return\s+request(?:\.uri)?\s*;?$/;

// Line and block comments only — enough to normalise a tail like
// `return request; // TODO` without pulling in a JS parser for one assertion.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\r\n]*/g, '');
}

function assertEdgeAllowListIntact() {
  const source = readIfPresent(EDGE_SCRIPT);
  if (source === null) {
    fail('B', `${EDGE_SCRIPT} is missing; the production edge routing contract is unenforceable.`);
    return;
  }

  // `var|let|const`: the file is ES5.1 today, but a later edit to `const` must not
  // silently drop the ALLOWED_* tables out of this audit and take the
  // immutability check with them.
  const maps = [
    ...source.matchAll(/(?:var|let|const)\s+(ROUTE_MAP|ALLOW(?:ED)?_[A-Z0-9_]+)\s*=\s*(\S+)/g),
  ];
  if (!maps.some(([, name]) => name === 'ROUTE_MAP')) {
    fail('B', `${EDGE_SCRIPT} no longer declares a ROUTE_MAP allow-list.`);
  }
  maps
    .filter(([, , initialiser]) => !initialiser.startsWith('Object.freeze('))
    .forEach(([, name]) => {
      fail('B', `${EDGE_SCRIPT}: ${name} is not Object.freeze()d; the allow-list is mutable.`);
    });

  if (!/statusCode:\s*404/.test(source)) {
    fail('B', `${EDGE_SCRIPT} no longer builds a synthetic 404 response for unknown paths.`);
  }

  // `map` in the extension table would publish browser source maps through the
  // edge even while next.config.js keeps them off — the routing policy forbids it
  // outright, so it is asserted here rather than left to review.
  const extensionTable = /ALLOWED_EXTENSIONS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/.exec(source);
  if (extensionTable && /(^|[\s{,'"])map\s*:/.test(extensionTable[1])) {
    fail(
      'B',
      `${EDGE_SCRIPT}: 'map' is in ALLOWED_EXTENSIONS; that publishes browser source maps ` +
        'through the edge. It must never be added.'
    );
  }

  const tryBlock = /try\s*\{([\s\S]*?)\}\s*catch\s*\(/.exec(stripComments(source))?.[1];
  if (tryBlock === undefined) {
    fail('B', `${EDGE_SCRIPT}: could not locate the handler try/catch block to audit its exit.`);
    return;
  }
  if (ORIGIN_PASSTHROUGH_TAIL.test(tryBlock.trimEnd())) {
    fail(
      'B',
      `${EDGE_SCRIPT}: the handler's try block ends in an unconditional \`return request\`, so a ` +
        'non-allow-listed path falls through to the origin. It must fail closed by returning ' +
        'the synthetic 404 response.'
    );
  }
}

function assertEdgeCoverageStaysPinned() {
  const config = readIfPresent(JEST_CONFIG);
  if (config === null) {
    fail('B', `${JEST_CONFIG} is missing; the edge coverage pin cannot be verified.`);
    return;
  }
  const collectFrom = /const EDGE_COVERAGE_FROM[^;]*;/.exec(config)?.[0] ?? '';
  if (!collectFrom.includes(EDGE_SCRIPT)) {
    fail(
      'B',
      `${JEST_CONFIG} no longer collects edge coverage from ${EDGE_SCRIPT}; ` +
        'the 100% edge layer would stop guarding the routing allow-list.'
    );
  }
  const threshold = /const EDGE_COVERAGE_THRESHOLD[^;]*;/.exec(config)?.[0] ?? '';
  ['branches', 'functions', 'lines', 'statements'].forEach(counter => {
    if (!new RegExp(`${counter}:\\s*100\\b`).test(threshold)) {
      fail('B', `${JEST_CONFIG} no longer pins the edge coverage threshold ${counter} at 100.`);
    }
  });
}

function assertNoProductionSourceMaps() {
  const config = readIfPresent(NEXT_CONFIG);
  if (config === null) {
    fail('C', `${NEXT_CONFIG} is missing; the source-map guardrail cannot be verified.`);
    return;
  }
  // Comments are stripped so prose mentioning the option cannot trip the gate.
  const code = stripComments(config);
  // Three spellings reach the same setting and all must be caught: an object
  // literal property (`productionBrowserSourceMaps: true`), an assignment
  // (`config.productionBrowserSourceMaps = true`), and a quoted/computed key
  // (`['productionBrowserSourceMaps']: true`). Anything other than a literal
  // `false` is rejected — including a variable, whose value this gate cannot
  // know, so it must not be assumed safe.
  const assignments = [
    ...code.matchAll(/productionBrowserSourceMaps["'\]]*\s*[:=]\s*([^,;}\n]+)/g),
  ];
  assignments
    .map(match => match[1].trim())
    .filter(value => value !== 'false')
    .forEach(value => {
      fail(
        'C',
        `${NEXT_CONFIG} sets productionBrowserSourceMaps to \`${value}\`; that publishes ` +
          'readable application source to the CDN. Remove the key (Next defaults to false) ' +
          'or pin it to the literal false.'
      );
    });
}

const workflows = loadWorkflows();
assertPrivilegedWorkflowsAreAlerted(workflows);
assertEdgeAllowListIntact();
assertEdgeCoverageStaysPinned();
assertNoProductionSourceMaps();

if (failures.length > 0) {
  failures.forEach(failure => console.error(`::error::prod-guardrails: ${failure}`));
  process.exit(1);
}

console.log(`prod-guardrails: OK (${workflows.length} workflows audited)`);
