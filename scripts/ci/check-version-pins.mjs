// scripts/ci/check-version-pins.mjs - fail when a toolchain version is pinned
// in more than one place and the copies have drifted (issue #338).
//
// A repo that is portable across Docker, CI and a bare host only stays portable
// while every one of those surfaces agrees on the Node, Bun and Playwright it
// runs. Each pin below has exactly one source of truth; this gate proves the
// copies still match it.
//
// Deliberately dependency-free (fs + regex, no YAML/JSONC parser): `make
// install` runs the version guards BEFORE `bun install`, so anything imported
// from node_modules would throw MODULE_NOT_FOUND on a cold checkout and turn a
// helpful drift message into a confusing crash.
//
// Collect-all-then-fail, like scripts/ci/lint-metrics.sh: one run reports every
// mismatch so a bump is fixed in a single pass.

import fs from 'node:fs';

const NVMRC = '.nvmrc';
const BUN_VERSION_FILE = '.bun-version';
const PACKAGE_JSON = 'package.json';
const PLAYWRIGHT_DOCKERFILE = 'Playwright.Dockerfile';
const DEVCONTAINER = '.devcontainer/devcontainer.json';
// Relative to .devcontainer/, this is the repository Dockerfile the pins live in.
const DEVCONTAINER_DOCKERFILE = '../Dockerfile';
const WORKFLOWS_DIR = '.github/workflows';

// Every image that must track .nvmrc. src/test/load/Dockerfile is deliberately
// absent: it is the k6 builder (golang + a bare alpine runtime), carries no
// Node at all, and is versioned against the xk6 toolchain instead.
const NODE_IMAGE_FILES = [
  'Dockerfile',
  'Apollo.Dockerfile',
  'Mockoon.Dockerfile',
  'MemoryLeak.Dockerfile',
];

// Every place that installs Bun globally. The Makefile entry is the DIND recipe
// (install-deps-in-container-dind), which provisions a throwaway container by
// hand rather than through a Dockerfile.
const BUN_INSTALL_FILES = [
  'Dockerfile',
  'Apollo.Dockerfile',
  'Playwright.Dockerfile',
  'MemoryLeak.Dockerfile',
  'Makefile',
];

const failures = [];

function fail(check, message) {
  failures.push({ check, message });
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function readRequired(check, file) {
  const text = readText(file);
  if (text === null) {
    fail(check, `${file} is missing`);
  }
  return text;
}

// `^24` -> >=24.0.0 <25.0.0 ; `^22.12` -> >=22.12.0 <23.0.0. Reimplemented
// rather than imported from checkNodeVersion.js, which is CommonJS and exits
// the process as a side effect of being loaded.
function satisfiesCaret(version, clause) {
  const wanted = /^\^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(clause);
  if (!wanted) return null;

  const [major, minor, patch] = version.split('.').map(Number);
  const [wantMajor, wantMinor, wantPatch] = [wanted[1], wanted[2], wanted[3]].map(part =>
    part === undefined ? 0 : Number(part)
  );

  if (major !== wantMajor) return false;
  if (minor !== wantMinor) return minor > wantMinor;
  return patch >= wantPatch;
}

// --- 1. Node: .nvmrc is the single source of truth ---------------------------

const nvmrcText = readRequired('node', NVMRC);
const nodeVersion = nvmrcText === null ? null : nvmrcText.trim();

if (nodeVersion !== null && !/^\d+\.\d+\.\d+$/.test(nodeVersion)) {
  fail('node', `${NVMRC} must hold an exact X.Y.Z version, found "${nodeVersion}"`);
}

// --- 2. Node images track .nvmrc, on one shared alpine tag -------------------

// One file at a time, so an unreadable or base-image-less Dockerfile reports and
// returns rather than skipping onward through the shared loop body.
//
// The matcher is anchored with `m` + `^[ \t]*`, so a FROM quoted in a comment or a
// RUN heredoc is not read as a pin; `i` accepts the legal lowercase `from`;
// `(?:--\S+[ \t]+)*` consumes leading flags such as `FROM --platform=$BUILDPLATFORM`;
// and `(?:\S*\/)?` makes a registry prefix end in `/` so an unrelated `mynode:` image
// is not mistaken for Node. Missing any of those forms is fail-open on a multi-stage
// file: one drifted stage would simply stop being seen while its siblings keep the
// "declares no base image" check quiet. Both added groups are non-capturing, so 1/2
// stay version/alpineTag.
function collectNodeImages(file) {
  const text = readRequired('node-images', file);
  if (text === null) {
    return [];
  }

  const matches = [
    ...text.matchAll(
      /^[ \t]*FROM[ \t]+(?:--\S+[ \t]+)*(?:\S*\/)?node:(\d+\.\d+\.\d+)-alpine(\S*)/gim
    ),
  ];
  if (matches.length === 0) {
    fail('node-images', `${file} declares no node:<version>-alpine<tag> base image`);
    return [];
  }

  return matches.map(([, version, alpineTag]) => {
    if (nodeVersion !== null && version !== nodeVersion) {
      fail('node-images', `${file} pins node:${version} but ${NVMRC} says ${nodeVersion}`);
    }
    return { file, version, alpineTag };
  });
}

const nodeImages = NODE_IMAGE_FILES.flatMap(collectNodeImages);

const alpineTags = [...new Set(nodeImages.map(image => image.alpineTag))];
if (alpineTags.length > 1) {
  fail(
    'node-images',
    `node images use ${alpineTags.length} different alpine tags (${alpineTags.join(', ')}); ` +
      'they must share one'
  );
}

// --- 3. package.json engines.node is a caret range around .nvmrc -------------

const packageText = readRequired('package', PACKAGE_JSON);
let pkg = null;

if (packageText !== null) {
  try {
    pkg = JSON.parse(packageText);
  } catch (error) {
    fail('package', `${PACKAGE_JSON} is not valid JSON: ${error.message}`);
  }
}

const enginesNode = pkg?.engines?.node;

if (typeof enginesNode !== 'string') {
  fail('engines-node', `${PACKAGE_JSON} engines.node is missing`);
} else if (nodeVersion !== null) {
  const satisfied = satisfiesCaret(nodeVersion, enginesNode.trim());
  if (satisfied === null) {
    fail(
      'engines-node',
      `${PACKAGE_JSON} engines.node "${enginesNode}" is not a single caret range ` +
        '(e.g. "^24"), so the pin cannot be verified'
    );
  } else {
    const enginesMajor = enginesNode.trim().replace(/^\^/, '').split('.')[0];
    if (enginesMajor !== nodeVersion.split('.')[0]) {
      fail(
        'engines-node',
        `${PACKAGE_JSON} engines.node "${enginesNode}" targets major ${enginesMajor} ` +
          `but ${NVMRC} says ${nodeVersion}`
      );
    } else if (enginesNode.trim() !== `^${nodeVersion}`) {
      // The caret over the EXACT pin, not merely a range that admits it. `^24` and
      // `^24.18.0` both accept the .nvmrc version, but only the second says which
      // version this repository runs: under `^24` a host on 24.0.0 satisfies
      // `engines` while disagreeing with every other pin site, and the drift this
      // gate exists to report is invisible to `bun install`. Checked after the major
      // comparison so a genuinely wrong major still reports as a wrong major.
      fail(
        'engines-node',
        `${PACKAGE_JSON} engines.node is "${enginesNode}", expected "^${nodeVersion}" ` +
          `— the caret over the exact ${NVMRC} version, not a looser range that merely admits it`
      );
    }
    if (!satisfied) {
      fail(
        'engines-node',
        `${NVMRC} ${nodeVersion} does not satisfy engines.node "${enginesNode}"`
      );
    }
  }
}

// --- 4. Bun agrees everywhere -----------------------------------------------

const bunVersionText = readRequired('bun', BUN_VERSION_FILE);
const bunVersion = bunVersionText === null ? null : bunVersionText.trim();

if (bunVersion !== null && !/^\d+\.\d+\.\d+$/.test(bunVersion)) {
  fail('bun', `${BUN_VERSION_FILE} must hold an exact X.Y.Z version, found "${bunVersion}"`);
}

if (bunVersion !== null && pkg !== null) {
  // packageManager may carry a "+<integrity>" suffix; only the version is pinned.
  const packageManager = typeof pkg.packageManager === 'string' ? pkg.packageManager : '';
  const declared = /^bun@(\d+\.\d+\.\d+)/.exec(packageManager);
  if (!declared) {
    fail(
      'bun',
      `${PACKAGE_JSON} packageManager must be "bun@<version>", found "${packageManager}"`
    );
  } else if (declared[1] !== bunVersion) {
    fail(
      'bun',
      `${PACKAGE_JSON} packageManager pins bun@${declared[1]} but ` +
        `${BUN_VERSION_FILE} says ${bunVersion}`
    );
  }

  const enginesBun = typeof pkg.engines?.bun === 'string' ? pkg.engines.bun : '';
  if (enginesBun !== `>=${bunVersion}`) {
    fail(
      'bun',
      `${PACKAGE_JSON} engines.bun must floor at ">=${bunVersion}", found "${enginesBun}"`
    );
  }
}

function checkBunInstalls(file) {
  const text = readRequired('bun', file);
  if (text === null) {
    return;
  }

  // Match every global bun install, pinned or not: a file that carries one pinned
  // and one bare `npm install -g bun` would otherwise pass on the pinned one
  // while shipping whatever version npm resolved for the other.
  // The lookahead forces the match to end at a token boundary, so a bare `bun`
  // cannot match when `bun@<version>` is what is actually written.
  const installs = [...text.matchAll(/npm install -g (?:[^\s&|;]+\s+)*?bun(@[^\s&|;]+)?(?=\s|$)/g)];
  if (installs.length === 0) {
    fail('bun', `${file} no longer installs a pinned bun@<version>`);
    return;
  }

  installs.forEach(([, pin]) => {
    if (pin === undefined) {
      fail('bun', `${file} installs bun with no version; pin it to bun@${bunVersion}`);
      return;
    }
    const version = pin.slice(1);
    if (bunVersion !== null && version !== bunVersion) {
      fail('bun', `${file} installs bun@${version} but ${BUN_VERSION_FILE} says ${bunVersion}`);
    }
  });
}

BUN_INSTALL_FILES.forEach(checkBunInstalls);

// --- 5. Workflows resolve Node through .nvmrc, never a literal ---------------

let workflowFiles = [];
try {
  workflowFiles = fs
    .readdirSync(WORKFLOWS_DIR)
    // GitHub honours both extensions, so checking only .yml would let a .yaml
    // workflow introduce a literal pin without ever failing this gate.
    .filter(name => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map(name => `${WORKFLOWS_DIR}/${name}`);
} catch {
  fail('workflows', `${WORKFLOWS_DIR} is missing`);
}

/**
 * One YAML key, in the three spellings that name it: bare, single-quoted and
 * double-quoted. `"node-version": '20'` is the same literal pin `node-version: '20'`
 * is, so a scanner that knows only the bare spelling reads it as an unrelated key and
 * waves it through — and, in the other direction, reports a correctly written
 * `"node-version-file": '.nvmrc'` as unpinned.
 *
 * Every key this scanner matches is built here, so no key can be taught a spelling the
 * others do not know — the failure mode that has cost this family of gates three
 * separate fail-opens, each one key wide.
 *
 * Quoting widens nothing else. Each alternative is anchored at its opening quote and
 * must close with the SAME quote, so `"legacy-node-version-file"` is still a key
 * setup-node never reads (a prefix cannot be consumed and the tail read as the key),
 * and `"node-version'` is a key to no YAML reader at all. The three alternatives are
 * disjoint on their first character, so choosing between them is never a guess the
 * engine has to unwind.
 *
 * Every spelling this scanner accepts is built here for that reason; teaching one rule
 * a spelling the others do not know is what makes a key-anchored gate fail open.
 */
function yamlKey(name) {
  return `(?:${name}|"${name}"|'${name}')`;
}

const USES_KEY = yamlKey('uses');
const WITH_KEY = yamlKey('with');
const NODE_VERSION_KEY = yamlKey('node-version');
const NODE_VERSION_FILE_KEY = yamlKey('node-version-file');

// The whitespace YAML permits between a key and its colon. `node-version : "20"` is the
// ordinary key `node-version`, and a runner honours it; a scanner that demands the colon
// touch the key sees no key on that line at all and waves the literal straight through.
// A TAB counts: YAML 1.2 ends an implicit key with `s-separate-in-line?`, which is a
// space OR a tab, and js-yaml — what a runner's own tooling reads with — accepts
// `node-version\t: '20'`. (PyYAML is the stricter outlier here, and is wrong per spec.)
// Every key match below ends `${WS}:` and is built from this one constant, so the spacing
// cannot be allowed in one spelling and forgotten in the next.
const WS = String.raw`[ \t]*`;

// A double-quoted YAML scalar, consumed whole. `\"` is an escaped quote INSIDE the
// scalar, not the end of it: a run that stopped there would hand the remainder of the
// string back to the walk as structure, and `{ "k\": v, node-version-file: .nvmrc, z" }`
// — one key, pinning nothing — would credit the step. The two alternatives are disjoint
// on their first character and neither matches the empty string, so consuming the scalar
// is still a single deterministic pass.
const DQ_SCALAR = String.raw`"(?:[^"\\]|\\.)*"`;

// A single-quoted YAML scalar in KEY position. YAML escapes `'` by doubling it, so
// `'it''s'` is one key and a run that stopped at the first half of the `''` desynchronises
// the flow-entry walk: the entry never finds the `:` that must follow its key, the walk
// gives up, and every key AFTER it becomes invisible. That is a fail-OPEN, not merely a
// fail-closed one — `extra: { 'it''s': 1, node-version: '20' }` is a literal pin the gate
// would never report, and setup-node resolves `node-version` ahead of `node-version-file`,
// so the unreported literal is the version that actually runs.
const SQ_KEY_SCALAR = String.raw`'[^']*(?:''[^']*)*'`;

// The same scalar in VALUE position, where the naive pairing is kept DELIBERATELY. It is
// correct there: doubling always adds quotes two at a time, so naive pairing splits
// `'it''s'` into the two ADJACENT scalars `'it'` and `'s'`, which span exactly the
// characters the one real scalar does — no comma or colon is ever left outside a scalar,
// and the walk cannot desynchronise.
//
// It is also required. This scalar sits inside the repeating value alternation of
// FLOW_ENTRIES, where a doubling-aware form is ambiguous with itself (a scalar holding one
// doubled quote reads as that one scalar or as two adjacent ones) and the readings
// multiply per entry. MEASURED on this file's own patterns, a doubling-aware scalar in
// value position DOUBLES its backtracking with every added entry — 0.36 ms at 14 entries,
// 1.42 at 16, 5.62 at 18, 22.8 at 20, 88.9 at 22, 354 at 24, a ratio of 1.95-2.05 at every
// step — so a 40-entry line takes hours. The shipped shape does the same 40 entries in
// under 0.01 ms, and a 4000-entry line in under 1 ms.
// Key position has no such repetition to pair with, and an early close there is refuted
// by the very next character (the second quote of the pair is neither the space nor the
// colon that has to follow a key), so it costs one step. Do not "unify" the two.
const SQ_SCALAR = String.raw`'[^']*'`;

// Any key at all, for the flow entries that are merely stepped over, for the key a flow
// mapping hangs off, and for the key a block scalar hangs off. A quoted key is consumed
// whole, so a colon or a comma INSIDE a key is part of that key rather than structure
// the walk could be desynchronised by — and, now that the single-quoted form knows its
// doubling, so is a quote the key escapes rather than closes.
const ANY_KEY = String.raw`(?:[\w.$-]+|${DQ_SCALAR}|${SQ_KEY_SCALAR})`;

// `.nvmrc`, bare or quoted, with the quotes required to match each other: a value that
// opens with one quote and closes with the other is not `.nvmrc` to any YAML reader, so
// it must not be one here either.
const NVMRC_VALUE = String.raw`(?:'\.nvmrc'|"\.nvmrc"|\.nvmrc)`;

// `run: |`, `run: >-`, `run: |2`, `"run": |` — with an optional trailing comment.
// Anchored on the key (unlike the sibling's awk, which strips inline comments before it
// looks) so a shell pipe at the end of an inline value — `cache: bun # see: |` — cannot
// open a block scalar and swallow the rest of the step. Capture 1 is everything before
// the key, so the scalar can be scoped to the column the KEY starts at.
// A spaced header (`      - run : |`) opens a block scalar exactly as an unspaced one
// does; missing it leaves the scalar closed and reads its prose back as YAML structure —
// the "prose poses as a step" failure this function exists to prevent.
const BLOCK_SCALAR_HEADER = new RegExp(
  String.raw`^(\s*(?:-\s+)?)${ANY_KEY}${WS}:\s*[|>][-+]?\d*\s*(?:#.*)?$`
);

/**
 * Slice a workflow into the `with:` block of each `actions/setup-node` step.
 *
 * Counting `setup-node` and `node-version-file` occurrences file-wide would let a
 * step that omits `.nvmrc` pass whenever a sibling step (or a comment) supplied a
 * second mention. Each step is therefore validated on its own text: from the
 * `uses:` line up to the next line indented no deeper than that `uses:`.
 */
function stepStart(lines, usesIndex) {
  const usesIndent = lines[usesIndex].search(/\S/);
  for (let cursor = usesIndex; cursor >= 0; cursor -= 1) {
    const indent = lines[cursor].search(/\S/);
    if (lines[cursor].trim().startsWith('- ') && indent <= usesIndent) {
      return cursor;
    }
  }
  return usesIndex;
}

function stepEnd(lines, startIndex) {
  const itemIndent = lines[startIndex].search(/\S/);
  for (let cursor = startIndex + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (line.trim() !== '' && line.search(/\S/) <= itemIndent) {
      return cursor;
    }
  }
  return lines.length;
}

/**
 * Flag every line that can carry a real YAML key, so prose never poses as a step.
 *
 * `uses: actions/setup-node@v6` and `node-version:` both show up in workflows as
 * documentation — a `#` comment quoting the canonical snippet, or a `run: |`
 * block echoing a fragment into a heredoc or an error message. Matching those
 * invents a pin failure in a workflow that never calls setup-node, and the only
 * way to "fix" it is to delete the prose. A block scalar (`run: |`, `script: >`)
 * owns every following line that is blank or indented deeper than the key that
 * opened it; everything else is data.
 *
 * Returns the block-scalar bodies alongside the key lines, because the two are not
 * complements: a blank line and a `#` comment are neither. Only one walk may decide
 * this — a second one that drifted would let a body count as structure in one check
 * and as prose in the next, which is the fail-open shape this whole scanner is
 * built to avoid.
 */
function yamlKeyLines(lines) {
  const isKeyLine = [];
  const isBlockBody = [];
  let blockIndent = null;

  lines.forEach((line, index) => {
    const indent = line.search(/\S/);
    isBlockBody[index] = false;

    if (blockIndent !== null && (indent === -1 || indent > blockIndent)) {
      isKeyLine[index] = false;
      isBlockBody[index] = true;
      return;
    }
    blockIndent = null;

    if (indent === -1 || /^\s*#/.test(line)) {
      isKeyLine[index] = false;
      return;
    }

    isKeyLine[index] = true;
    const header = BLOCK_SCALAR_HEADER.exec(line);
    if (header) {
      // The column of the KEY, not of the sequence dash that may precede it. `- run: |`
      // owns only what is indented past `run`, and the step's own sibling keys — its
      // `uses:` and `with:` — sit at exactly that column. Scoping the scalar to the dash
      // instead swallows the entire rest of the step, hiding an unpinned setup-node call
      // behind any leading `run:`. The sibling gate scopes it to the key too.
      blockIndent = header[1].length;
    }
  });

  return { isKeyLine, isBlockBody };
}

// A real step, not a mention: the first token on the line — after the optional
// `- ` that opens a list item — has to be the `uses:` key itself, in any of its three
// spellings. The action reference may be quoted too, exactly as the sibling gate allows.
const SETUP_NODE_USES = new RegExp(
  String.raw`^\s*(?:-\s+)?${USES_KEY}${WS}:\s*["']?actions/setup-node[@\s]`
);
const LITERAL_NODE_VERSION = new RegExp(String.raw`^\s*(?:-\s+)?${NODE_VERSION_KEY}${WS}:`);

// The entries of a flow mapping that precede the key being looked for: `key: value,`
// repeated, with a quoted key or value consumed whole. Stepping over one entry at a time
// is what makes the key that follows the mapping's OWN key. A looser `[^}]*` prefix reads
// any tail of a longer key as the key itself — `legacy-node-version-file:` would credit
// a step the block spelling of the same input correctly rejects — and reads a key
// spelled inside a quoted value as a real one.
//
// The construction stays a single deterministic pass however it is matched: the key
// alternatives and the three value alternatives are each disjoint on their first
// character, and every repetition consumes at least a `k:,`, so none of them can match
// the empty string. There is exactly one way to match any given prefix — nothing for a
// backtracking engine to explore.
const FLOW_ENTRIES = String.raw`(?:${ANY_KEY}${WS}:(?:[^,{}'"]|${SQ_SCALAR}|${DQ_SCALAR})*,\s*)*`;

// The same literal written inside a flow mapping, `with: { node-version: '24.18.0' }`.
// Without it the two spellings disagree: a flow mapping that carries the `.nvmrc` pin
// AND a literal beside it would be credited and never reported, while the block form
// of the very same step is. The key has to open the mapping or start an entry, so
// `node-version-file:` is never read as a literal.
const FLOW_LITERAL_NODE_VERSION = new RegExp(
  String.raw`^\s*(?:-\s+)?${ANY_KEY}${WS}:\s*\{\s*${FLOW_ENTRIES}${NODE_VERSION_KEY}${WS}:`
);

// The step's own `node-version-file:` key, on a real key line, whose complete value
// is `.nvmrc`. Anchored at both ends for the same reason LITERAL_NODE_VERSION is:
// an unanchored search over the step's raw text accepts a `#` comment quoting the
// canonical snippet, a longer path that merely starts with `.nvmrc`
// (`.nvmrc.example`), and a similarly suffixed key (`legacy-node-version-file:`) —
// each of which lets a genuinely unpinned setup-node step through.
const NODE_VERSION_FILE_NVMRC = new RegExp(
  String.raw`^\s*(?:-\s+)?${NODE_VERSION_FILE_KEY}${WS}:\s*${NVMRC_VALUE}\s*(?:#.*)?$`
);

// The step's own `with:` mapping, in either mapping style — both are the same
// mapping, and setup-node reads its inputs from nowhere else. Block style opens a
// scope whose deeper keys NODE_VERSION_FILE_NVMRC is matched against; a flow
// mapping is complete on its own line, so the pin is read straight out of it and no
// scope opens. FLOW_ENTRIES bounds the scan to that one mapping and makes the key its
// own, and the value alternation terminates exactly at `.nvmrc`, so a lookalike key
// (`legacy-node-version-file:`), a lookalike path (`.nvmrc.bak`, `".nvmrcX"`) or a
// literal `node-version:` all still leave the step unpinned.
const BLOCK_WITH = new RegExp(String.raw`^${WITH_KEY}${WS}:\s*(?:#.*)?$`);
const FLOW_WITH_NVMRC = new RegExp(
  String.raw`^${WITH_KEY}${WS}:\s*\{\s*${FLOW_ENTRIES}${NODE_VERSION_FILE_KEY}${WS}:\s*${NVMRC_VALUE}\s*[,}]`
);

// The mapping key a line carries, with any sequence dash removed, and the column it
// really starts at: in `- uses: x` the key is nested one level below the dash, and
// that column is what tells a step's own `with:` apart from a `with:` nested inside
// another of its mappings — an `env:`, say, where setup-node never looks.
function mappingKey(line) {
  const parts = /^([ \t]*)(-[ \t]+)?(\S.*)$/.exec(line);
  return parts === null
    ? null
    : { column: parts[1].length + (parts[2] ?? '').length, text: parts[3] };
}

function setupNodeSteps(lines, isKeyLine) {
  return lines.flatMap((line, index) => {
    if (!isKeyLine[index] || !SETUP_NODE_USES.test(line)) {
      return [];
    }
    // `with:` is a sibling key of `uses:`, not nested under it, so the step's
    // extent is the whole `- ` list item that encloses the `uses:` line. The
    // range, not a joined blob: the caller still needs isKeyLine per line.
    const start = stepStart(lines, index);
    const end = stepEnd(lines, start);
    return [{ line: index + 1, start, end }];
  });
}

// The mapping keys the step actually declares, in source order. Prose declares
// none: a comment or a block-scalar body is not a key line, and a line that carries
// no key at all (a bare list item, say) yields nothing — so neither can open a
// `with:` mapping nor carry the pin.
function stepKeys(lines, isKeyLine, step) {
  return lines
    .slice(step.start, step.end)
    .map((line, offset) => (isKeyLine[step.start + offset] ? mappingKey(line) : null))
    .filter(key => key !== null);
}

// Whether a key opens the step's OWN block `with:` — the only mapping setup-node
// reads its inputs from. It has to sit at the step's own column: a `with:` deeper
// than that is nested inside another of the step's mappings (an `env:`, say), where
// the action never looks.
function opensBlockWith(key, stepColumn) {
  return key.column === stepColumn && BLOCK_WITH.test(key.text);
}

// The two places the `.nvmrc` pin can legitimately sit. At the step's own column it
// has to be a flow `with: { … }` carrying the pin, complete on that one line —
// `node-version-file:` spelled as a direct key of the step is an input of nothing.
// Deeper, it has to be a `node-version-file:` input of an open block `with:`; the
// caller clears `inWith` at every key that dedents back to the step, so a pin under
// `env:`, or after the mapping has closed, credits no step.
function keyPinsNvmrc(key, stepColumn, inWith) {
  return key.column === stepColumn
    ? FLOW_WITH_NVMRC.test(key.text)
    : inWith && NODE_VERSION_FILE_NVMRC.test(key.text);
}

// The column of the step's first mapping key (the one its dash introduces) is the
// column every direct key of the step sits at, so a `with:` found there is the
// step's own and one found deeper is not. Any key deeper than an open block `with:`
// is one of its inputs; a key at or left of it has dedented back out and closes the
// mapping — which is why the scope is recomputed, never merely kept, at those keys.
function stepPinsNvmrc(lines, isKeyLine, step) {
  const keys = stepKeys(lines, isKeyLine, step);
  const stepColumn = keys.length === 0 ? -1 : keys[0].column;
  let inWith = false;

  for (const key of keys) {
    if (key.column <= stepColumn) {
      inWith = opensBlockWith(key, stepColumn);
    }
    if (keyPinsNvmrc(key, stepColumn, inWith)) {
      return true;
    }
  }

  return false;
}

// A double-quoted scalar spelled with YAML escape sequences. `"node-versio\x6E"` is
// the mapping key `node-version` to every YAML reader and to setup-node, but decoding
// escapes is a parser's job, not a scanner's. Rather than guess at the decoded
// spelling — and wave through a literal pin it guessed wrong about — this gate reports
// the spelling and refuses: an escaped key is either a key it cannot read or an
// obfuscation of one it must, and both have to be spelled plainly before the file can
// be vouched for. The escape is REQUIRED (`+`, not `*`), so an ordinary quoted key is
// untouched, and the rule only ever runs on a line already known to be structure —
// never inside a `run: |` body.
const ESCAPED_SCALAR = String.raw`"[^"\\]*(?:\\.[^"\\]*)+"`;
const ESCAPED_KEY = new RegExp(String.raw`^\s*(?:-\s+)?${ESCAPED_SCALAR}${WS}:`);
const FLOW_ESCAPED_KEY = new RegExp(
  String.raw`^\s*(?:-\s+)?${ANY_KEY}${WS}:\s*\{\s*${FLOW_ENTRIES}${ESCAPED_SCALAR}${WS}:`
);

// A double-quoted scalar that CLOSES on the line it opens on. Used only to subtract the
// well-formed scalars from a line, so that any `"` left standing is one that opened a
// scalar the line never closes. Same shape as DQ_SCALAR; named apart because this one is
// a subtraction over a whole line rather than a piece of a larger key pattern.
const CLOSED_DQ_SCALAR = new RegExp(String.raw`"[^"\\]*(?:\\.[^"\\]*)*"`, 'g');
const CLOSED_SQ_SCALAR = new RegExp(String.raw`'[^']*'`, 'g');

// The repository variable this gate refuses, as a literal substring. It is matched
// wherever a workflow READS it — an `env:` value, a `with:` input, an `if:` expression,
// a `run:` body — because GitHub expands `${{ }}` in all of them and the value cannot be
// seen or reviewed from inside the repository. What it must NOT be matched in is a
// comment: a note ABOUT the variable reintroduces nothing, and failing a PR for one is a
// false rejection.
const REPO_NODE_VERSION_VAR = 'vars.NODE_VERSION';

// The action reference, as a literal substring, for the refusal below.
const SETUP_NODE_REF = 'actions/setup-node@';

// A plain block key whose VALUE is an ordinary scalar — `run: echo actions/setup-node@x`,
// `name: bump actions/setup-node@x`, an `env:` entry holding the string. GitHub resolves
// an action from a `uses:` key and nowhere else, so a reference sitting in one of those is
// data, and refusing it would be a false rejection — the multi-line `run: |` spelling of
// the very same text is already skipped as a block body, so refusing the one-line spelling
// would make the verdict depend on scalar style rather than on meaning.
//
// The exemption is withheld in exactly the two places the value may not be what it looks
// like: when the key is `uses` itself, and when the value opens a flow collection, where a
// `uses` key may sit after a brace that nothing here can reach.
const PLAIN_BLOCK_KEY = /^([^:{}[]+):[ \t]/;

// YAML node properties may sit between the colon and the value proper: an anchor
// (`&name`), a tag (`!tag`, `!!tag`, `!<verbatim>`), or both in either order. They are
// stripped before asking what the value opens, because `with: &a { uses: … }` is a flow
// mapping and would otherwise read as a plain scalar and skip the refusal. A plain scalar
// cannot begin with `&` or `!` in YAML — both are indicators, so a real value starting
// with one is quoted — which is what makes stripping them safe rather than another way to
// lose a line.
const NODE_PROPERTY = /^[&!]\S*[ \t]*/;

const USES_KEY_NAMES = new Set(['uses', '"uses"', "'uses'"]);

function isDataValue(keyText) {
  const match = PLAIN_BLOCK_KEY.exec(keyText);
  if (match === null) {
    return false;
  }

  const keyName = match[1].replace(/[ \t]+$/, '');
  let value = keyText.slice(match[0].length).replace(/^[ \t]+/, '');
  for (let property = NODE_PROPERTY.exec(value); property !== null; ) {
    value = value.slice(property[0].length);
    property = NODE_PROPERTY.exec(value);
  }

  const opensFlow = value.startsWith('{') || value.startsWith('[');
  return !opensFlow && !USES_KEY_NAMES.has(keyName);
}

/**
 * The index at which the scalar opening at `start` closes, or -1 when the line does not
 * close it. A double-quoted scalar escapes with a backslash (which escapes any character,
 * itself included); a single-quoted one escapes a quote by doubling it.
 */
function scalarEnd(text, start, quote) {
  for (let cursor = start + 1; cursor < text.length; cursor += 1) {
    const character = text[cursor];
    if (quote === '"' && character === '\\') {
      cursor += 1;
      continue;
    }
    if (character === quote) {
      if (quote === "'" && text[cursor + 1] === "'") {
        cursor += 1;
        continue;
      }
      return cursor;
    }
  }
  return -1;
}

/**
 * Drop a trailing `#` comment without reaching inside a quoted scalar.
 *
 * A naive `line.replace(/\s+#.*$/, '')` cuts at the first ` #` on the line, which is wrong
 * in both directions when the `#` is inside a value: it truncates
 * `with: { cache: "a # b", node-version: '20' }` to `with: { cache: "a`, so the literal
 * after it is never read (a pin passes), and it strips the closing quote off a scalar that
 * is perfectly well formed (a continued-scalar refusal for a line that continues nothing).
 *
 * A quote only opens a scalar here if the line also CLOSES it. That matters because an
 * apostrophe is ordinary text in a YAML plain scalar — `- name: Don't fail # c` has one
 * single quote and no scalar, and its comment must still be stripped — and because an
 * unterminated quote is exactly the continuation the caller must still be able to see.
 *
 * Walking past such a quote is reported as `unclosed`. Where the quote sits where a VALUE
 * may start, the line may be opening a multi-line quoted scalar, every `#` after it is
 * literal text rather than a comment, and the strip is a guess — so a caller that must not
 * miss what was cut away can read the raw line instead.
 */
function stripComment(text) {
  let unclosed = false;
  let cursor = 0;

  while (cursor < text.length) {
    const character = text[cursor];

    if (character === '"' || character === "'") {
      const stop = scalarEnd(text, cursor, character);
      if (stop >= 0) {
        cursor = stop + 1;
        continue;
      }
      // Unclosed. It opens a scalar only where a value may start — at the head of the
      // line, or after `:`, `,`, `{`, `[`, or a sequence dash. An apostrophe anywhere else
      // is ordinary plain-scalar text, and what follows it is still a comment.
      let back = cursor - 1;
      while (back >= 0 && /[ \t]/.test(text[back])) {
        back -= 1;
      }
      if (back < 0 || ':,{[-'.includes(text[back])) {
        unclosed = true;
      }
      cursor += 1;
      continue;
    }

    if (character === '#' && (cursor === 0 || /\s/.test(text[cursor - 1]))) {
      return { text: text.slice(0, cursor), unclosed };
    }

    cursor += 1;
  }

  return { text, unclosed };
}

// A double-quoted scalar may be CONTINUED onto the next line by ending this one with a
// backslash, and YAML folds the break away: `"node-versio\` / `n": '20'` is the key
// `node-version`, spelled across two lines. A line-based scanner never sees that scalar
// whole, so neither the key rule nor the literal rule can fire — the pin simply passes.
//
// Detected structurally rather than guessed at: subtract every scalar that CLOSES on this
// line (single-quoted first, so a double quote living inside one is gone before
// double-quoted scalars are paired), and any double quote still standing opened a scalar
// this line does not close.
function continuesScalar(text) {
  return text.replace(CLOSED_SQ_SCALAR, '').replace(CLOSED_DQ_SCALAR, '').includes('"');
}

// A workflow that never calls setup-node yields no steps, so the pin check is
// simply vacuous for it — but the literal `node-version:` check still runs over
// every workflow, because a literal pin is drift wherever it is declared.
//
// Returns the number of setup-node steps it read, so the caller can tell "every step is
// pinned" from "there was no step to check" across the whole directory.
function checkWorkflowNodePin(file) {
  const text = readText(file);
  if (text === null) {
    return 0;
  }

  const lines = text.split('\n');
  const { isKeyLine, isBlockBody } = yamlKeyLines(lines);
  const steps = setupNodeSteps(lines, isKeyLine);
  const readableUses = new Set(steps.map(step => step.line - 1));

  steps
    .filter(step => !stepPinsNvmrc(lines, isKeyLine, step))
    .forEach(step => {
      fail(
        'workflows',
        `${file}:${step.line} calls actions/setup-node without node-version-file: ${NVMRC}`
      );
    });

  lines.forEach((line, index) => {
    // Counted first, and outside every structural guard: the variable is unreviewable
    // wherever it is read, and reading it is not confined to a step or to a key line.
    // A block-scalar body is skipped as STRUCTURE but not as TEXT — GitHub substitutes
    // `${{ }}` into a `run:` body before any shell sees it, so a read there is a real
    // read, and literal text carries no YAML comment to strip.
    if (isBlockBody[index]) {
      if (line.includes(REPO_NODE_VERSION_VAR)) {
        fail(
          'workflows',
          `${file}:${index + 1} reads ${REPO_NODE_VERSION_VAR}; pin Node through ${NVMRC}, ` +
            'whose value is reviewable'
        );
      }
      return;
    }

    const { text: stripped, unclosed } = stripComment(line);

    // Read off the STRIPPED line, so a note about the variable is not a read — except
    // where the strip walked past a quote opening a scalar the line never closes. There a
    // `#` may be literal text inside a multi-line quoted value whose `${{ }}` GitHub still
    // expands, and cutting at it would hide a real read. Over-counting a mention costs a
    // reword; under-counting a read leaves the gate green on a pin nobody can review.
    if ((unclosed ? line : stripped).includes(REPO_NODE_VERSION_VAR)) {
      fail(
        'workflows',
        `${file}:${index + 1} reads ${REPO_NODE_VERSION_VAR}; pin Node through ${NVMRC}, ` +
          'whose value is reviewable'
      );
    }

    if (!isKeyLine[index]) {
      return;
    }

    if (LITERAL_NODE_VERSION.test(line) || FLOW_LITERAL_NODE_VERSION.test(line)) {
      fail(
        'workflows',
        `${file}:${index + 1} pins a literal node-version; use node-version-file: ${NVMRC}`
      );
    }

    // Refused wherever a key is read, not only inside a step: an escaped key hides a
    // literal from the rule above just as effectively as it hides an unpinned step from
    // the one before it.
    if (ESCAPED_KEY.test(stripped) || FLOW_ESCAPED_KEY.test(stripped)) {
      fail(
        'workflows',
        `${file}:${index + 1} spells a mapping key with YAML escape sequences; this gate ` +
          'reads keys, not escapes, so spell them plainly'
      );
    }

    if (continuesScalar(stripped)) {
      fail(
        'workflows',
        `${file}:${index + 1} continues a double-quoted scalar past the end of the line; ` +
          'this gate reads a line at a time, so keep every quoted scalar on one line'
      );
    }

    // A setup-node reference no rule above read as a step's own `uses:` key is refused,
    // not ignored. Every rule in this scanner is anchored to a mapping key on its own
    // line, which is the block spelling; a step written as a compact flow mapping —
    // `- { uses: actions/setup-node@…, with: { node-version-file: .nvmrc } }`, or a whole
    // `steps: [{ … }]` sequence — puts the key after a brace nothing here can reach.
    // Ignoring that is fail-open in the one direction that matters: the step runs, the
    // gate never sees it, and the directory-wide vacuity guard is satisfied by the plainly
    // spelled steps beside it. So this takes the way out the two refusals above took — a
    // spelling this gate cannot read is reported and has to be spelled plainly.
    const key = mappingKey(stripped);
    if (
      stripped.includes(SETUP_NODE_REF) &&
      !readableUses.has(index) &&
      !(key !== null && isDataValue(key.text))
    ) {
      fail(
        'workflows',
        `${file}:${index + 1} names actions/setup-node where this gate cannot read it as a ` +
          "step's own `uses:` key; spell every setup-node step in block style, not as a " +
          'compact flow mapping'
      );
    }
  });

  return steps.length;
}

const setupNodeStepCount = workflowFiles
  .map(checkWorkflowNodePin)
  .reduce((total, count) => total + count, 0);

// A directory of workflows that calls setup-node nowhere is not "nothing to check" — it is
// the pin rule losing its subject, which is how a gate quietly stops enforcing anything.
// The per-file checks above are all conditional on finding a step; this is the one
// assertion that a step was found at all.
if (workflowFiles.length > 0 && setupNodeStepCount === 0) {
  fail(
    'workflows',
    `no actions/setup-node step found under ${WORKFLOWS_DIR}; the pin check would pass vacuously`
  );
}

// --- 6. Playwright image tracks the @playwright/test devDependency -----------

const playwrightDockerfile = readRequired('playwright', PLAYWRIGHT_DOCKERFILE);

if (playwrightDockerfile !== null) {
  // Anchored and flag-tolerant for the same reasons as collectNodeImages above:
  // `FROM --platform=…` and a lowercase `from` are both legal Dockerfile syntax and
  // must not read as "does not build on the playwright image", while a commented-out
  // FROM must not read as a pin.
  const image =
    /^[ \t]*FROM[ \t]+(?:--\S+[ \t]+)*mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-jammy/im.exec(
      playwrightDockerfile
    );
  if (!image) {
    fail(
      'playwright',
      `${PLAYWRIGHT_DOCKERFILE} does not build on mcr.microsoft.com/playwright:v<version>-jammy`
    );
  } else {
    for (const dep of ['@playwright/test', 'playwright']) {
      const declared = pkg?.devDependencies?.[dep];
      if (declared !== image[1]) {
        fail(
          'playwright',
          `${PLAYWRIGHT_DOCKERFILE} runs playwright v${image[1]} but devDependencies.${dep} ` +
            `is "${declared}" (must be the exact same version)`
        );
      }
    }
  }
}

// --- 7. The devcontainer reuses the Dockerfile instead of adding a 5th pin ---

// Required, not optional: if the file can go missing, every assertion below
// silently stops holding the moment someone deletes or renames it.
const devcontainerText = readRequired('devcontainer', DEVCONTAINER);

if (devcontainerText !== null) {
  // JSONC: strip comments and trailing commas before parsing. Strings in this
  // file are plain paths and flags, so no comment marker can hide inside one.
  const stripped = devcontainerText
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
    .replace(/,(\s*[}\]])/g, '$1');

  let devcontainer = null;
  try {
    devcontainer = JSON.parse(stripped);
  } catch (error) {
    fail('devcontainer', `${DEVCONTAINER} is not parseable as JSONC: ${error.message}`);
  }

  if (devcontainer !== null) {
    if (devcontainer.build?.target !== 'base') {
      fail(
        'devcontainer',
        `${DEVCONTAINER} build.target must be "base" (the image that already carries the pins), ` +
          `found "${devcontainer.build?.target}"`
      );
    }
    // The target name alone proves nothing: another Dockerfile could declare its
    // own `base` stage with different pins and satisfy the check above.
    if (devcontainer.build?.dockerfile !== DEVCONTAINER_DOCKERFILE) {
      fail(
        'devcontainer',
        `${DEVCONTAINER} build.dockerfile must be "${DEVCONTAINER_DOCKERFILE}" (the repository ` +
          `Dockerfile), found "${devcontainer.build?.dockerfile}"`
      );
    }
    if (devcontainer.remoteEnv?.EXEC_MODE !== 'host') {
      fail(
        'devcontainer',
        `${DEVCONTAINER} remoteEnv.EXEC_MODE must be "host" (#399's explicit executor ` +
          `switch; CI is deliberately not read), found "${devcontainer.remoteEnv?.EXEC_MODE}"`
      );
    }
  }

  // Reject ANY version literal, not just today's values. Matching only the
  // current Node/Bun versions would wave through a devcontainer that pinned a
  // *different* one — which is precisely the drift this gate exists to stop.
  // Comments are stripped first so prose may still mention a version.
  const versionLiterals = [
    [/\b\d+\.\d+\.\d+\b/, 'a semantic version'],
    [/\b(?:node|bun)@\S+/i, 'a pinned node@/bun@ install'],
    [/\bnode:\d/i, 'a node image tag'],
  ];

  versionLiterals
    .filter(([pattern]) => pattern.test(stripped))
    .forEach(([pattern, label]) => {
      fail(
        'devcontainer',
        `${DEVCONTAINER} embeds ${label} ("${pattern.exec(stripped)?.[0]}"); it must inherit ` +
          'every version from the Dockerfile base stage rather than become another pin'
      );
    });
}

// --- Report ------------------------------------------------------------------

// Written straight to the streams rather than through `console`: this is a CLI
// gate whose report IS its output, and the diagnostic goes to stderr so a caller
// can capture the verdict without the detail.
if (failures.length > 0) {
  const report = failures.map(({ check, message }) => `  [${check}] ${message}`).join('\n');
  process.stderr.write(`\nversion pins: ${failures.length} drift(s) found\n\n`);
  process.stderr.write(`${report}\n`);
  process.stderr.write(
    '\nlint-pins FAILED: bring every copy back in step with its source of truth\n\n'
  );
  process.exit(1);
}

process.stdout.write('version pins: node, bun and playwright agree across every pin site\n');
