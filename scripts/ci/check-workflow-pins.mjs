#!/usr/bin/env node
// scripts/ci/check-workflow-pins.mjs - prove every workflow resolves Node through
// .nvmrc, by PARSING the YAML rather than pattern-matching it (issue #447).
//
// This half used to live in scripts/ci/check-version-pins.mjs, where it scanned
// workflows a line at a time with regex. On 2026-08-25 that scanner needed seven
// separate spelling fixes in one day — a lookalike key, a key spelled inside a
// quoted value, an over-tightened flow mapping, quoted keys, an escaped quote in a
// key, block-scalar scoping, a doubled single-quote — and a differential sweep
// against a real parser judged ~38% of generated real-world-shaped inputs wrong
// (5,888 fail-open cases). Each fix was correct; the surface was unbounded. So the
// gate now asks js-yaml what the document MEANS, and every one of those spellings
// is simply the same document.
//
// The split is what lets it: check-version-pins.mjs stays dependency-free because
// `make lint-pins` runs on the host, where `make lint` reaches it with no
// `bun install` behind it. This gate needs a parser, so it runs inside the dev
// container exactly as `make lint-prod-guardrails` does.
//
// Collect-all-then-fail, like its sibling: one run reports every violation.
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const WORKFLOWS_DIR = '.github/workflows';
const NVMRC = '.nvmrc';

// The action this gate is about, and the input that pins it. Written once so no
// rule below can learn a spelling the others do not know.
const SETUP_NODE = 'actions/setup-node';
const NODE_VERSION_FILE_INPUT = 'node-version-file';
const LITERAL_NODE_VERSION_KEY = 'node-version';

// The repository variable this gate refuses, matched wherever a workflow READS it —
// an `env:` value, a `with:` input, an `if:` expression, a `run:` body — because
// GitHub expands `${{ }}` in all of them and the value cannot be reviewed from inside
// the repository. A MENTION reintroduces nothing, so the rule requires the expression
// wrapper rather than the bare name; a YAML comment naming the variable never reaches
// this gate at all, because the parser drops comments before the walk begins. A `#`
// line inside a `run:` body is NOT dropped, and must not be: that body is shell, and
// GitHub substitutes into it before any shell sees it.
//
// Both index spellings are covered: `vars.NODE_VERSION` and `vars['NODE_VERSION']`
// name the same variable to the expression evaluator.
const REPO_NODE_VERSION_READ =
  /\$\{\{[^}]*\bvars\s*(?:\.\s*NODE_VERSION\b|\[\s*['"]NODE_VERSION['"]\s*\])/;
const REPO_NODE_VERSION_VAR = 'vars.NODE_VERSION';

const root = path.resolve(process.argv[2] ?? process.cwd());
const failures = [];

function fail(message) {
  failures.push(message);
}

/**
 * Parse a workflow, remembering the line each collection node starts on.
 *
 * js-yaml reports the constructed value and the source line of every node it opens,
 * so a stack of open lines paired with the value each `close` yields maps collections
 * back to source. Scalars are primitives and cannot be keyed this way, which is why a
 * finding inside one is reported at its nearest enclosing collection and located
 * precisely by its document path instead.
 *
 * A node reached through an alias is the SAME object as its anchor, so the first
 * sighting — the anchor's own line — is the one kept.
 */
function loadWithLines(text) {
  const lines = new WeakMap();
  const openLines = [];

  const doc = yaml.load(text, {
    listener(event, state) {
      if (event === 'open') {
        openLines.push(state.line);
        return;
      }
      const start = openLines.pop();
      const value = state.result;
      if (value !== null && typeof value === 'object' && !lines.has(value)) {
        lines.set(value, start + 1);
      }
    },
  });

  return { doc, lines };
}

/**
 * Every node in the document, depth-first, tagged with the path that names it and the
 * line of the nearest collection that encloses it.
 *
 * A `seen` set makes a self-referential anchor terminate instead of recursing forever;
 * it also collapses a node reused through several aliases to one visit, which is the
 * right verdict either way — one document node, one finding.
 */
function* walk(node, pathText, line, lines, seen) {
  yield { node, path: pathText, line };

  if (node === null || typeof node !== 'object') {
    return;
  }
  if (seen.has(node)) {
    return;
  }
  seen.add(node);

  const ownLine = lines.get(node) ?? line;

  if (Array.isArray(node)) {
    for (const [index, item] of node.entries()) {
      yield* walk(item, `${pathText}[${index}]`, lines.get(item) ?? ownLine, lines, seen);
    }
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    const childPath = pathText === '' ? key : `${pathText}.${key}`;
    // The KEY is walked as well as the value. GitHub expands `${{ }}` on both
    // sides of a mapping entry, so a repository variable read from a key is a
    // real read — and the scanner this replaced caught it for free by testing
    // the whole raw line, which is exactly the kind of coverage a rewrite loses
    // silently.
    yield { node: key, path: `${childPath} (key)`, line: ownLine };
    yield* walk(value, childPath, lines.get(value) ?? ownLine, lines, seen);
  }
}

// A mapping is a step when it declares `uses:` naming setup-node. The reference is
// compared after the parser has decoded it, so `"actions/setup-nod\x65@v6"`, a
// single-quoted reference and a bare one are one and the same string here.
//
// `@` or a space ends the name so a longer action (`actions/setup-node-extra@v1`) is
// not read as this one, and a bare `uses: actions/setup-node` — legal, and resolved
// to the default branch — still counts.
// A `uses:` key whose value is not a string. GitHub resolves an action from a
// string and nothing else, so such a step runs nothing — but the shape also hides
// a reference from every rule below, which is the fail-open direction. Refused
// rather than ignored, the same way the scanner this replaced refused a spelling
// it could not read.
function hasUnreadableUses(node) {
  return (
    node !== null &&
    typeof node === 'object' &&
    !Array.isArray(node) &&
    Object.hasOwn(node, 'uses') &&
    typeof node.uses !== 'string'
  );
}

function isSetupNodeStep(node) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return false;
  }
  const uses = node.uses;
  if (typeof uses !== 'string') {
    return false;
  }
  const reference = uses.trim();
  if (!reference.startsWith(SETUP_NODE)) {
    return false;
  }
  const next = reference.charAt(SETUP_NODE.length);
  return next === '' || next === '@' || /\s/.test(next);
}

// setup-node reads its inputs from the step's own `with:` mapping and nowhere else,
// so a `node-version-file` under an `env:` — or anywhere else in the step — pins
// nothing. The value must be exactly `.nvmrc`: a longer path that merely starts with
// it (`.nvmrc.example`) is a different file.
function stepPinsNvmrc(step) {
  const inputs = step.with;
  if (inputs === null || typeof inputs !== 'object' || Array.isArray(inputs)) {
    return false;
  }
  return inputs[NODE_VERSION_FILE_INPUT] === NVMRC;
}

function checkWorkflow(file, relative) {
  let parsed;
  try {
    parsed = loadWithLines(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    // An unparseable workflow is a reported failure, not a stack trace: a duplicate
    // key or a bad indent would otherwise crash the gate and take every other
    // workflow's verdict down with it.
    fail(
      `${relative} is not valid YAML, so its Node pin cannot be read: ${error.message.split('\n')[0]}`
    );
    return 0;
  }

  const { doc, lines } = parsed;
  if (doc === null || typeof doc !== 'object') {
    return 0;
  }

  let steps = 0;

  for (const { node, path: nodePath, line } of walk(
    doc,
    '',
    lines.get(doc) ?? 1,
    lines,
    new Set()
  )) {
    // A literal pin is drift wherever it is declared, not only inside a step: a
    // `strategy.matrix.node-version` drives setup-node just as directly, and a
    // literal parked in an `env:` is a second source of truth waiting to be wired up.
    if (
      node !== null &&
      typeof node === 'object' &&
      !Array.isArray(node) &&
      Object.hasOwn(node, LITERAL_NODE_VERSION_KEY)
    ) {
      fail(
        `${relative}:${line} pins a literal ${LITERAL_NODE_VERSION_KEY} at ${nodePath || '<root>'}; ` +
          `use ${NODE_VERSION_FILE_INPUT}: ${NVMRC}`
      );
    }

    if (typeof node === 'string' && REPO_NODE_VERSION_READ.test(node)) {
      fail(
        `${relative}:${line} reads ${REPO_NODE_VERSION_VAR} at ${nodePath || '<root>'}; ` +
          `pin Node through ${NVMRC}, whose value is reviewable`
      );
    }

    if (hasUnreadableUses(node)) {
      fail(
        `${relative}:${line} declares a non-string \`uses:\` at ${nodePath || '<root>'}; ` +
          'an action reference is a string, and any other node hides it from this gate'
      );
    }

    if (isSetupNodeStep(node)) {
      steps += 1;
      if (!stepPinsNvmrc(node)) {
        fail(
          `${relative}:${line} calls ${SETUP_NODE} at ${nodePath || '<root>'} without ` +
            `${NODE_VERSION_FILE_INPUT}: ${NVMRC}`
        );
      }
    }
  }

  return steps;
}

const workflowsDir = path.join(root, WORKFLOWS_DIR);
let workflowFiles = [];
try {
  workflowFiles = fs
    .readdirSync(workflowsDir)
    // GitHub honours both extensions, so checking only .yml would let a .yaml
    // workflow introduce a literal pin without ever failing this gate.
    .filter(name => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort();
} catch {
  fail(`${WORKFLOWS_DIR} is missing`);
}

const setupNodeStepCount = workflowFiles
  .map(name => checkWorkflow(path.join(workflowsDir, name), `${WORKFLOWS_DIR}/${name}`))
  .reduce((total, count) => total + count, 0);

// A directory of workflows that calls setup-node nowhere is not "nothing to check" —
// it is the pin rule losing its subject, which is how a gate quietly stops enforcing
// anything. Every per-step check above is conditional on finding a step; this is the
// one assertion that a step was found at all.
if (workflowFiles.length > 0 && setupNodeStepCount === 0) {
  fail(`no ${SETUP_NODE} step found under ${WORKFLOWS_DIR}; the pin check would pass vacuously`);
}

if (failures.length > 0) {
  console.error('Workflow Node-pin check failed:\n');
  failures.forEach(message => console.error(`  - ${message}`));
  console.error(
    `\nEvery workflow must resolve Node through ${NVMRC}: pass ` +
      `${NODE_VERSION_FILE_INPUT}: ${NVMRC} to ${SETUP_NODE}, and declare the version nowhere else.`
  );
  process.exit(1);
}

console.log(
  `Workflow Node pins OK: ${setupNodeStepCount} ${SETUP_NODE} step(s) across ` +
    `${workflowFiles.length} workflow(s) resolve Node through ${NVMRC}.`
);
