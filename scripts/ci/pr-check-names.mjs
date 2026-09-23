#!/usr/bin/env node
// scripts/ci/pr-check-names.mjs - list the check-run names that EVERY pull request
// to main produces, by PARSING the workflows rather than pattern-matching them
// (issue #343).
//
// A required status check is matched by the check-run name alone. A name that no
// workflow reports on a given pull request is not "skipped" to GitHub — it stays
// "Expected — Waiting for status to be reported" and blocks the merge forever. So
// the committed ruleset (config/main-ruleset.json) may only require names this
// script produces, and tests/bats/apply_branch_ruleset.bats holds the two in step
// in both directions.
//
// A workflow contributes only when it runs on EVERY pull request to main:
//   * it triggers on `pull_request` (not only push, schedule or dispatch);
//   * it carries no `paths` / `paths-ignore` filter — a filtered workflow reports
//     nothing at all when the filter misses, which is the blocked-forever case;
//   * its `branches` / `branches-ignore` filter admits `main`;
//   * its `types` (when narrowed) still include `opened` and `synchronize`.
// A job-level `if:` does NOT exclude a job: a job skipped by its condition still
// reports a check run (conclusion `skipped`), which GitHub counts as passing.
//
// The check-run name is what GitHub renders: the job's `name:` (or its id), with
// `${{ matrix.<key> }}` substituted per matrix combination, and — when the name
// carries no matrix expression — the combination's values appended in
// parentheses, e.g. `Analyze (typescript)`. Anything this script cannot render
// exactly (a reusable-workflow call, a computed matrix, any other expression in a
// name) fails closed: a guessed name is worse than none.
//
// One trap the names alone cannot show, so each entry also carries `conditional`
// (the job has an `if:`) and `matrix`: a matrix job skipped by its condition
// reports ONE check run under the UNEXPANDED name, so an expanded name of a
// conditional matrix job is never safe to require.
//
// Usage: node scripts/ci/pr-check-names.mjs [workflows-dir]
// Prints a JSON array of { name, workflow, job, conditional, matrix } on stdout;
// exits 1 on any workflow it cannot read or render.
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const DEFAULT_BRANCH = 'main';
const REQUIRED_TYPES = ['opened', 'synchronize'];
const MATRIX_EXPRESSION = /\$\{\{\s*matrix\.([A-Za-z0-9_-]+)\s*\}\}/g;

const dir = path.resolve(process.argv[2] ?? '.github/workflows');
const failures = [];

function fail(message) {
  failures.push(message);
}

function asList(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function globToRegExp(glob) {
  const escaped = String(glob)
    .split('**')
    .map(part =>
      part
        .split('*')
        .map(piece => piece.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*')
    )
    .join('.*');
  return new RegExp(`^${escaped}$`);
}

function matchesAny(patterns, branch) {
  return patterns.some(pattern => globToRegExp(pattern).test(branch));
}

function pullRequestTrigger(on) {
  if (typeof on === 'string') {
    return on === 'pull_request' ? {} : null;
  }
  if (Array.isArray(on)) {
    return on.includes('pull_request') ? {} : null;
  }
  if (on && typeof on === 'object' && Object.hasOwn(on, 'pull_request')) {
    return on.pull_request ?? {};
  }
  return null;
}

function runsOnEveryPullRequest(trigger) {
  if (trigger === null) {
    return false;
  }
  if (Object.hasOwn(trigger, 'paths') || Object.hasOwn(trigger, 'paths-ignore')) {
    return false;
  }
  if (Object.hasOwn(trigger, 'branches') && !matchesAny(asList(trigger.branches), DEFAULT_BRANCH)) {
    return false;
  }
  if (
    Object.hasOwn(trigger, 'branches-ignore') &&
    matchesAny(asList(trigger['branches-ignore']), DEFAULT_BRANCH)
  ) {
    return false;
  }
  if (Object.hasOwn(trigger, 'types')) {
    const types = asList(trigger.types);
    return REQUIRED_TYPES.every(type => types.includes(type));
  }
  return true;
}

function isScalar(value) {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function expandMatrix(matrix, where) {
  if (matrix === null || typeof matrix !== 'object' || Array.isArray(matrix)) {
    fail(`${where}: the matrix is computed, so its check-run names cannot be rendered`);
    return [];
  }
  const axes = Object.entries(matrix).filter(([key]) => key !== 'include' && key !== 'exclude');
  if (Object.hasOwn(matrix, 'exclude')) {
    fail(`${where}: matrix \`exclude\` is not supported; list the combinations explicitly`);
    return [];
  }
  const include = asList(matrix.include);
  if (axes.length > 0 && include.length > 0) {
    fail(`${where}: a matrix mixing axes and \`include\` is not supported`);
    return [];
  }
  const everyAxisIsAList = axes.every(
    ([, values]) => Array.isArray(values) && values.length > 0 && values.every(isScalar)
  );
  if (!everyAxisIsAList) {
    fail(`${where}: every matrix axis must be a literal, non-empty list of scalars`);
    return [];
  }
  if (axes.length === 0) {
    const literal = include.every(
      entry =>
        entry &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        Object.values(entry).every(isScalar)
    );
    if (include.length === 0 || !literal) {
      fail(`${where}: the matrix \`include\` must be a literal, non-empty list of scalar maps`);
      return [];
    }
    return include;
  }
  return axes.reduce(
    (combinations, [key, values]) =>
      combinations.flatMap(combination => values.map(value => ({ ...combination, [key]: value }))),
    [{}]
  );
}

function renderName(template, combination, where) {
  let usedMatrix = false;
  const rendered = template.replace(MATRIX_EXPRESSION, (whole, key) => {
    usedMatrix = true;
    if (combination === null || !Object.hasOwn(combination, key)) {
      fail(`${where}: \`${whole}\` names no matrix value`);
      return whole;
    }
    return String(combination[key]);
  });
  if (rendered.includes('${{')) {
    fail(`${where}: the job name holds an expression this script cannot render`);
    return null;
  }
  if (combination === null || usedMatrix) {
    return rendered;
  }
  return `${rendered} (${Object.values(combination).map(String).join(', ')})`;
}

function checkNamesOf(file, document) {
  const where = path.join(path.basename(dir), file);
  if (document === null || typeof document !== 'object') {
    fail(`${where}: not a workflow mapping`);
    return [];
  }
  const trigger = pullRequestTrigger(document.on);
  if (!runsOnEveryPullRequest(trigger)) {
    return [];
  }
  return Object.entries(document.jobs ?? {}).flatMap(([jobId, job]) => {
    const jobWhere = `${where} job \`${jobId}\``;
    if (job === null || typeof job !== 'object') {
      fail(`${jobWhere}: not a job mapping`);
      return [];
    }
    if (Object.hasOwn(job, 'uses')) {
      fail(
        `${jobWhere}: a reusable-workflow call reports caller/callee names this script cannot render`
      );
      return [];
    }
    const template = String(job.name ?? jobId);
    const matrix = job.strategy?.matrix;
    const combinations = matrix === undefined ? [null] : expandMatrix(matrix, jobWhere);
    return combinations
      .map(combination => renderName(template, combination, jobWhere))
      .filter(name => name !== null)
      .map(name => ({
        name,
        workflow: file,
        job: jobId,
        conditional: Object.hasOwn(job, 'if'),
        matrix: matrix !== undefined,
      }));
  });
}

let files = [];
try {
  files = fs
    .readdirSync(dir)
    .filter(file => /\.ya?ml$/.test(file))
    .sort();
} catch (error) {
  fail(`cannot read the workflows directory ${dir}: ${error.message}`);
}
if (files.length === 0 && failures.length === 0) {
  fail(`no workflow files under ${dir}`);
}

const checks = files.flatMap(file => {
  try {
    return checkNamesOf(file, yaml.load(fs.readFileSync(path.join(dir, file), 'utf8')));
  } catch (error) {
    fail(`${file}: cannot parse: ${error.message}`);
    return [];
  }
});

if (failures.length > 0) {
  for (const message of failures) {
    process.stderr.write(`pr-check-names: ${message}\n`);
  }
  process.exit(1);
}

process.stdout.write(`${JSON.stringify(checks, null, 2)}\n`);
