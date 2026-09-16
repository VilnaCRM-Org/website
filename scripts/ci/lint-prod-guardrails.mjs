#!/usr/bin/env node
// Production-safety guardrail gate (issues #383 and #375).
//
// Six invariants only ever hold in production, where no PR check watches
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
//   D. Every CloudFront Function source must fit the service's 10 KB function
//      quota, which is not adjustable. The infra repository publishes these files
//      verbatim from `main`, so an oversized one is rejected at apply time and
//      the distribution keeps running whatever version it had — which is how the
//      `/en` rewrite shipped in git and 404'd in production (docs/edge-routing.md).
//   E. Every job that assumes an AWS role in a workflow reachable from any
//      trigger other than `pull_request` must declare a GitHub `environment:`
//      (a string, or a mapping with `name`), so the environment's protection
//      rules -- required reviewers, wait timer, deployment branches -- stand in
//      front of the role. `pull_request` alone is exempt, and only because of
//      the OIDC-subject trap: naming an environment changes the subject GitHub
//      mints from `repo:<org>/<repo>:pull_request` to
//      `repo:<org>/<repo>:environment:<name>`, and the deployed sandbox role
//      trust policies reject that subject, so the key fails
//      sts:AssumeRoleWithWebIdentity on every run (.github/sandbox_workflows.md
//      records the failed run). Widening those trust policies is the
//      prerequisite for lifting the exemption. pull_request_target, merge_group,
//      push, schedule, workflow_dispatch, workflow_run and every other trigger
//      are never exempt. A role is assumed through
//      aws-actions/configure-aws-credentials, any `with: role-to-assume` input,
//      or `aws sts assume-role` in a run body; the steps of a local composite
//      action are followed, because moving the login into one must not move it
//      out of the audit, and a local action this gate cannot read fails closed.
//   F. A `run:` step that appends a variable named like a credential
//      (TOKEN, SECRET, PASSWORD, PRIVATE_KEY, CREDENTIAL) to $GITHUB_ENV or
//      $GITHUB_OUTPUT must have printed `::add-mask::` earlier in the SAME
//      step, so the value is redacted from the job log before it is persisted
//      into every later step. The write is read off the parsed `run:` string
//      line by line -- `>> "$GITHUB_ENV"`, `>>$GITHUB_ENV`, `tee -a`, printf, a
//      grouped `{ ...; } >>` block, the `NAME<<EOF` multi-line form and a
//      heredoc redirected into the file -- and a write whose variable name the
//      gate cannot read is reported too: fail closed rather than guess.
//
// Collect-all-then-fail: every violation is reported in one run.
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const WORKFLOW_DIR = '.github/workflows';
const ACTIONS_DIR = '.github/actions';
const EDGE_SCRIPT = 'scripts/cloudfront_routing.js';
const HEADERS_SCRIPT = 'scripts/cloudfront_security_headers.js';
const JEST_CONFIG = 'jest.config.ts';

// AWS documents the quota as "10 KB" without saying which kilobyte it means, so
// the stricter reading is the one enforced: 10,000 bytes of UTF-8 source, which is
// what the API receives. Comments count — the file is uploaded as written.
const CLOUDFRONT_FUNCTION_MAX_BYTES = 10_000;
const CLOUDFRONT_FUNCTIONS = [EDGE_SCRIPT, HEADERS_SCRIPT];
const NEXT_CONFIG = 'next.config.js';

// A privileged workflow whose triggers are all PR-scoped is already watched: a
// failure lands as a red check on the pull request. Every other trigger runs
// where nobody is looking.
const WATCHED_TRIGGERS = new Set(['pull_request', 'pull_request_target', 'merge_group']);

// Assertion E exempts strictly less than assertion A does. `pull_request_target`
// and `merge_group` runs are watched (their failure is a red check), but they
// mint OIDC subjects the sandbox trust policies were never proved against, so
// nothing about the sandbox trap excuses them from an environment gate.
const ENVIRONMENT_EXEMPT_TRIGGER = 'pull_request';

const AWS_CREDENTIALS_ACTION = 'aws-actions/configure-aws-credentials';
// The action is the documented path, but a role can also be assumed straight
// from the CLI.
const AWS_CLI_ASSUME_ROLE = /\baws\s+sts\s+assume-role(?:-with-web-identity)?\b/;
const LOCAL_ACTION_USES = /^\.\//;

// Assertion F. The name test is deliberately a substring match, so `GH_TOKEN`,
// `NPM_TOKEN`, `DB_PASSWORD` and `AWS_SECRET_ACCESS_KEY` all count.
const CREDENTIAL_NAME = /TOKEN|SECRET|PASSWORD|PRIVATE_KEY|CREDENTIAL/i;
// Any spelling of the two files GitHub reads back: `$GITHUB_ENV`,
// `"${GITHUB_ENV}"`, PowerShell's `$env:GITHUB_ENV`, cmd's `%GITHUB_ENV%`.
const PERSISTED_FILE = /\bGITHUB_(?:ENV|OUTPUT)\b/;
const ADD_MASK = '::add-mask::';
// A `NAME=` or `NAME<<` token that is not itself a variable expansion
// (`$name=`), so `echo "TOKEN=$x"`, `printf 'TOKEN=%s'`, `echo TOKEN=$x` and
// `echo 'TOKEN<<EOF'` all yield TOKEN.
const WRITTEN_NAME = /(?<![\w$])([A-Za-z_][\w-]*)(?:=|<<)/g;
// A shell heredoc redirection (`cat <<EOF`, `tee -a "$GITHUB_ENV" <<'EOF'`),
// as distinct from the `NAME<<EOF` value form, where `<<` abuts the name, and
// from a `<<<` here-string.
const HEREDOC_OPENER = /(?<![\w<])<<(?!<)-?\s*(['"]?)([A-Za-z_]\w*)\1/;
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

// The local composite actions, keyed by the `uses:` spelling that reaches
// them (`./.github/actions/<name>`). Assertion E follows their steps and
// assertion F audits their run bodies, so a login or a persisted credential
// moved into a composite stays inside the gate.
function loadLocalActions() {
  const dir = path.join(root, ACTIONS_DIR);
  const actions = new Map();
  if (!fs.existsSync(dir)) return actions;
  fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .forEach(entry => {
      const relativeDir = `${ACTIONS_DIR}/${entry.name}`;
      const file = ['action.yml', 'action.yaml']
        .map(name => `${relativeDir}/${name}`)
        .find(relative => fs.existsSync(path.join(root, relative)));
      // A directory with no action metadata is not an action; a `uses:` that
      // points at it stays unresolved and fails closed in assertion E.
      if (!file) return;
      let doc;
      try {
        doc = yaml.load(fs.readFileSync(path.join(root, file), 'utf8')) ?? {};
      } catch (error) {
        fail(
          'E',
          `${file} is not valid YAML, so the jobs that call it cannot be audited: ` +
            `${error.message.split('\n')[0]}`
        );
        return;
      }
      const steps = Array.isArray(doc?.runs?.steps) ? doc.runs.steps : [];
      actions.set(`./${relativeDir}`, { file, steps });
    });
  return actions;
}

function jobsOf(doc) {
  return doc?.jobs && typeof doc.jobs === 'object' ? Object.entries(doc.jobs) : [];
}

function stepsOfJob(job) {
  return Array.isArray(job?.steps) ? job.steps : [];
}

function stepsOf(doc) {
  return jobsOf(doc).flatMap(([, job]) => stepsOfJob(job));
}

function usesOf(step) {
  return typeof step?.uses === 'string' ? step.uses : '';
}

function runOf(step) {
  return typeof step?.run === 'string' ? step.run : '';
}

// The three spellings through which a step itself takes on an AWS role.
function assumesAwsRoleDirectly(step) {
  const hasRoleInput =
    step?.with && typeof step.with === 'object' && Object.hasOwn(step.with, 'role-to-assume');
  return (
    usesOf(step).startsWith(AWS_CREDENTIALS_ACTION) ||
    Boolean(hasRoleInput) ||
    AWS_CLI_ASSUME_ROLE.test(runOf(step))
  );
}

// Assertion A's predicate. A local composite action hides its steps from the
// alert audit, so the caller is treated as privileged rather than as invisible
// -- which is why every non-PR caller of the dev-container composite is listed
// in ci-health-alerts.yml.
function assumesAwsRole(step) {
  return assumesAwsRoleDirectly(step) || /^\.\/\.github\/actions\//.test(usesOf(step));
}

// Assertion D's step set: the job's own steps plus those of every local action
// it calls, followed transitively. A local `uses:` with no readable action
// metadata is returned separately so the caller can fail closed on it instead
// of treating the unreadable action as one that assumes nothing.
function resolveSteps(steps, localActions, seen = new Set()) {
  const resolved = [];
  const unresolved = [];
  steps.forEach(step => {
    resolved.push(step);
    const uses = usesOf(step);
    if (!LOCAL_ACTION_USES.test(uses)) return;
    const action = localActions.get(uses.replace(/\/+$/, ''));
    if (!action) {
      unresolved.push(uses);
      return;
    }
    if (seen.has(action.file)) return;
    seen.add(action.file);
    const nested = resolveSteps(action.steps, localActions, seen);
    resolved.push(...nested.resolved);
    unresolved.push(...nested.unresolved);
  });
  return { resolved, unresolved };
}

function createsRelease(step) {
  const uses = usesOf(step);
  return (
    RELEASE_ACTIONS.some(action => uses.startsWith(action)) ||
    /\bgh\s+release\s+create\b/.test(runOf(step))
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

// `environment: production` and `environment: { name: production, url: ... }`
// both name an environment; an empty string, a bare `url`, or a list do not,
// and a key that survives only in a comment never reaches the parser at all.
function declaresEnvironment(job) {
  const environment = job?.environment;
  if (typeof environment === 'string') return environment.trim().length > 0;
  if (environment && typeof environment === 'object' && !Array.isArray(environment)) {
    return typeof environment.name === 'string' && environment.name.trim().length > 0;
  }
  return false;
}

function assertRoleAssumingJobsDeclareEnvironment(workflows, localActions) {
  workflows.forEach(workflow => {
    const unexempt = triggerKeys(workflow.triggers).filter(
      key => key !== ENVIRONMENT_EXEMPT_TRIGGER
    );
    if (unexempt.length === 0) return;
    const location = `${WORKFLOW_DIR}/${workflow.file}`;
    jobsOf(workflow.doc).forEach(([jobId, job]) => {
      const { resolved, unresolved } = resolveSteps(stepsOfJob(job), localActions);
      unresolved.forEach(uses => {
        fail(
          'E',
          `${location} job "${jobId}" runs on ${unexempt.join(', ')} and calls the local ` +
            `action ${uses}, which has no readable action.yml under ${ACTIONS_DIR}/, so this ` +
            'gate cannot prove the job assumes no AWS role. Place the action under ' +
            `${ACTIONS_DIR}/<name>/action.yml.`
        );
      });
      if (!resolved.some(assumesAwsRoleDirectly)) return;
      if (declaresEnvironment(job)) return;
      fail(
        'E',
        `${location} job "${jobId}" assumes an AWS role and is reachable from ` +
          `${unexempt.join(', ')}, but declares no environment:. Name a GitHub environment ` +
          '(a string, or a mapping with name) so its protection rules stand in front of the ' +
          'role -- and widen the role trust policy to the ' +
          'repo:<org>/<repo>:environment:<name> subject FIRST (.github/sandbox_workflows.md), ' +
          'or the key fails sts:AssumeRoleWithWebIdentity on every run.'
      );
    });
  });
}

// Assertion E helpers. Everything below reads the parsed `run:` string of one
// step, never the workflow file, so a `#` here is a shell comment: a whole
// comment line is inert in every shell GitHub runs and is skipped on both
// sides, while a trailing comment is only honoured for the mask -- not
// counting a mask that a comment swallowed is the fail-closed direction, and
// counting a name a trailing comment mentions merely over-reports.
function isShellComment(line) {
  return /^\s*#/.test(line);
}

// The column at which a live `::add-mask::` starts, or -1 when the line prints
// none -- including when the marker sits behind a `#` and so never reaches
// stdout.
function maskColumn(line) {
  const at = line.indexOf(ADD_MASK);
  if (at < 0) return -1;
  const comment = line.search(/(?:^|\s)#/);
  return comment >= 0 && comment < at ? -1 : at;
}

function writtenNames(text) {
  return [...text.matchAll(WRITTEN_NAME)].map(match => match[1]);
}

// The lines of a `{ ...; } >> "$GITHUB_ENV"` / `( ... ) >> ...` group whose
// closing bracket is on `closeIndex`, walked backwards to the bracket that
// opened it. Brackets are counted rather than parsed, so a group that never
// balances hands back everything above it -- a superset, which can only
// over-report.
function groupLines(lines, closeIndex) {
  const body = [];
  let depth = 0;
  for (let index = closeIndex; index >= 0; index -= 1) {
    const line = lines[index];
    depth += (line.match(/[})]/g) ?? []).length - (line.match(/[{(]/g) ?? []).length;
    if (index < closeIndex) body.push(line);
    if (depth <= 0) break;
  }
  return body;
}

// The body of the heredoc opened on `openIndex`: every following line up to
// the terminator, or to the end of the step when no terminator is found.
function heredocLines(lines, openIndex, terminator) {
  const body = [];
  for (let index = openIndex + 1; index < lines.length; index += 1) {
    if (lines[index].replace(/^\t+/, '') === terminator) break;
    body.push(lines[index]);
  }
  return body;
}

// Every variable name the write on `index` persists, gathered from the line
// itself, from the group it closes, and from the heredoc it opens. An empty
// result means the gate could not read the write (`cat file >> "$GITHUB_ENV"`,
// `done >> "$GITHUB_OUTPUT"`), which the caller treats as a violation.
function namesPersistedAt(lines, index) {
  const line = lines[index];
  const names = writtenNames(line);
  if (/^\s*[})]/.test(line)) names.push(...writtenNames(groupLines(lines, index).join('\n')));
  const heredoc = HEREDOC_OPENER.exec(line);
  if (heredoc) names.push(...writtenNames(heredocLines(lines, index, heredoc[2]).join('\n')));
  return names;
}

// The findings for one step's run body, in source order.
function auditRunBody(run) {
  const lines = run.split(/\r?\n/);
  const findings = [];
  let masked = false;
  lines.forEach((line, index) => {
    if (isShellComment(line)) return;
    const mask = maskColumn(line);
    const sink = line.search(PERSISTED_FILE);
    if (sink >= 0) {
      const file = PERSISTED_FILE.exec(line)[0];
      const names = namesPersistedAt(lines, index);
      const credentials = names.filter(name => CREDENTIAL_NAME.test(name));
      // A mask printed later on the same line lands after the write, so it does
      // not count for this line.
      const maskedHere = masked || (mask >= 0 && mask < sink);
      if (!maskedHere && names.length === 0) {
        findings.push(
          `line ${index + 1} writes to $${file} (\`${line.trim()}\`) but the gate cannot tell ` +
            `which variable it persists; print ${ADD_MASK} first, or spell the write as ` +
            `echo "NAME=value" >> "$${file}" so the name can be read.`
        );
      } else if (!maskedHere && credentials.length > 0) {
        findings.push(
          `line ${index + 1} writes ${credentials.join(', ')} to $${file} without printing ` +
            `${ADD_MASK} earlier in the same step; mask the value ` +
            `(echo "${ADD_MASK}$VALUE") before it is persisted, or do not persist it.`
        );
      }
    }
    if (mask >= 0) masked = true;
  });
  return findings;
}

function assertCredentialsMaskedBeforePersisting(workflows, localActions) {
  const sources = [
    ...workflows.map(workflow => ({
      file: `${WORKFLOW_DIR}/${workflow.file}`,
      jobs: jobsOf(workflow.doc),
    })),
    ...[...localActions.values()].map(action => ({
      file: action.file,
      jobs: [['runs', { steps: action.steps }]],
    })),
  ];
  sources.forEach(({ file, jobs }) => {
    jobs.forEach(([jobId, job]) => {
      stepsOfJob(job).forEach((step, index) => {
        if (typeof step?.run !== 'string') return;
        const label = typeof step.name === 'string' ? ` ("${step.name}")` : '';
        auditRunBody(step.run).forEach(finding => {
          fail('F', `${file} job "${jobId}" step ${index + 1}${label}: ${finding}`);
        });
      });
    });
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

// The handler dereferences all four tables, so every one of them is load-bearing.
const REQUIRED_EDGE_TABLES = ['ROUTE_MAP', 'ALLOWED_DIRS', 'ALLOWED_FILES', 'ALLOWED_EXTENSIONS'];

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

  // Every structural check below runs on a comment-stripped copy. A comment can
  // otherwise both hide a violation (`map/* x */: true`) and break an extraction
  // (a `})` inside a comment ends the table capture early), and a commented-out
  // declaration must not count as a live one.
  const code = stripComments(source);

  // `var|let|const`: the file is ES5.1 today, but a later edit to `const` must not
  // silently drop the ALLOWED_* tables out of this audit and take the
  // immutability check with them.
  const maps = [
    ...code.matchAll(/(?:var|let|const)\s+(ROUTE_MAP|ALLOW(?:ED)?_[A-Z0-9_]+)\s*=\s*(\S+)/g),
  ];
  // Deleting a table is as dangerous as unfreezing one: the file is `'use strict'`,
  // so the reads left behind in the handler throw a ReferenceError inside the try
  // and the catch turns that into the unconditional origin pass-through this
  // assertion exists to prevent. Checking only ROUTE_MAP left three tables open.
  REQUIRED_EDGE_TABLES.forEach(table => {
    if (maps.some(([, name]) => name === table)) return;
    fail(
      'B',
      `${EDGE_SCRIPT} no longer declares the ${table} allow-list, but the handler still ` +
        'reads it. The missing binding throws and the catch falls through to the origin.'
    );
  });
  maps
    .filter(([, , initialiser]) => !initialiser.startsWith('Object.freeze('))
    .forEach(([, name]) => {
      fail('B', `${EDGE_SCRIPT}: ${name} is not Object.freeze()d; the allow-list is mutable.`);
    });

  if (!/statusCode:\s*404/.test(code)) {
    fail('B', `${EDGE_SCRIPT} no longer builds a synthetic 404 response for unknown paths.`);
  }

  // `map` in the extension table would publish browser source maps through the
  // edge even while next.config.js keeps them off — the routing policy forbids it
  // outright, so it is asserted here rather than left to review.
  const extensionTable = /ALLOWED_EXTENSIONS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/.exec(code);
  if (extensionTable && /(^|[\s{,'"])map\s*:/.test(extensionTable[1])) {
    fail(
      'B',
      `${EDGE_SCRIPT}: 'map' is in ALLOWED_EXTENSIONS; that publishes browser source maps ` +
        'through the edge. It must never be added.'
    );
  }

  const tryBlock = /try\s*\{([\s\S]*?)\}\s*catch\s*\(/.exec(code)?.[1];
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
  // Same comment-stripped copy as the allow-list audit, for the same reason: a
  // commented-out entry or threshold must not count as a live one, and a `;`
  // inside a comment would truncate either capture below.
  const code = stripComments(config);
  const collectFrom = /const EDGE_COVERAGE_FROM[^;]*;/.exec(code)?.[0] ?? '';
  // Compare against the extracted quoted elements rather than building a regex out
  // of a path: hand-escaping only `.` leaves every other metacharacter (a backslash
  // above all) unescaped, which is the incomplete-escaping defect CodeQL flags. The
  // pin is matched against exactly the two spellings Jest resolves to the repo file --
  // the bare path and the `<rootDir>/`-prefixed one -- because anything looser passes
  // an entry that never collects this file: one merely ending in the same tail
  // (`<rootDir>/../../other/scripts/cloudfront_routing.js`), a negated glob that tells
  // Jest to exclude it (`!<rootDir>/scripts/cloudfront_routing.js`), or a longer
  // sibling (`...cloudfront_routing.js.map`).
  const collectedEntries = [...collectFrom.matchAll(/(['"])([^'"]*)\1/g)].map(match => match[2]);
  const pinsEdgeScript = collectedEntries.some(
    entry => entry === EDGE_SCRIPT || entry === `<rootDir>/${EDGE_SCRIPT}`
  );
  if (!pinsEdgeScript) {
    fail(
      'B',
      `${JEST_CONFIG} no longer collects edge coverage from ${EDGE_SCRIPT}; ` +
        'the 100% edge layer would stop guarding the routing allow-list.'
    );
  }
  const threshold = /const EDGE_COVERAGE_THRESHOLD[^;]*;/.exec(code)?.[0] ?? '';
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

// Measured on the committed bytes rather than a comment-stripped copy, because
// CloudFront receives the committed bytes: a rationale comment is as fatal to the
// publish as the code is, which is why the rationale lives under docs/ instead.
function assertEdgeFunctionsFitQuota() {
  CLOUDFRONT_FUNCTIONS.forEach(relative => {
    const source = readIfPresent(relative);
    if (source === null) {
      fail('D', `${relative} is missing; its CloudFront function size cannot be verified.`);
      return;
    }
    const bytes = Buffer.byteLength(source, 'utf8');
    if (bytes > CLOUDFRONT_FUNCTION_MAX_BYTES) {
      fail(
        'D',
        `${relative} is ${bytes} bytes, over the ${CLOUDFRONT_FUNCTION_MAX_BYTES}-byte ` +
          'CloudFront Functions quota; the infra apply would reject it and production ' +
          'would keep the previous version. Move rationale to docs/edge-routing.md rather ' +
          'than raising the limit, which AWS does not allow.'
      );
    }
  });
}

const workflows = loadWorkflows();
const localActions = loadLocalActions();
assertPrivilegedWorkflowsAreAlerted(workflows);
assertEdgeAllowListIntact();
assertEdgeCoverageStaysPinned();
assertNoProductionSourceMaps();
assertEdgeFunctionsFitQuota();
assertRoleAssumingJobsDeclareEnvironment(workflows, localActions);
assertCredentialsMaskedBeforePersisting(workflows, localActions);

if (failures.length > 0) {
  failures.forEach(failure => console.error(`::error::prod-guardrails: ${failure}`));
  process.exit(1);
}

console.log(
  `prod-guardrails: OK (${workflows.length} workflows audited, ` +
    `${localActions.size} local composite actions followed)`
);
