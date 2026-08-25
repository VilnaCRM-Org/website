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
// The matcher mirrors scripts/ci/check-node-version-sources.sh: `m` + `^[ \t]*`
// anchors to the start of an instruction line, so a FROM quoted in a comment or a
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
 */
function yamlKeyLines(lines) {
  const isKeyLine = [];
  let blockIndent = null;

  lines.forEach((line, index) => {
    const indent = line.search(/\S/);

    if (blockIndent !== null && (indent === -1 || indent > blockIndent)) {
      isKeyLine[index] = false;
      return;
    }
    blockIndent = null;

    if (indent === -1 || /^\s*#/.test(line)) {
      isKeyLine[index] = false;
      return;
    }

    isKeyLine[index] = true;
    // `run: |`, `run: >-`, `run: |2` — with an optional trailing comment. Anchored
    // on the key so a shell pipe inside an inline `run:` cannot open a block.
    if (/^\s*(?:-\s+)?[\w.$-]+:\s*[|>][-+]?\d*\s*(?:#.*)?$/.test(line)) {
      blockIndent = indent;
    }
  });

  return isKeyLine;
}

// A real step, not a mention: the first token on the line — after the optional
// `- ` that opens a list item — has to be the `uses:` key itself.
const SETUP_NODE_USES = /^\s*(?:-\s+)?uses:\s*actions\/setup-node[@\s]/;
const LITERAL_NODE_VERSION = /^\s*(?:-\s+)?node-version:/;

// The step's own `node-version-file:` key, on a real key line, whose complete value
// is `.nvmrc`. Anchored at both ends for the same reason LITERAL_NODE_VERSION is:
// an unanchored search over the step's raw text accepts a `#` comment quoting the
// canonical snippet, a longer path that merely starts with `.nvmrc`
// (`.nvmrc.example`), and a similarly suffixed key (`legacy-node-version-file:`) —
// each of which lets a genuinely unpinned setup-node step through.
const NODE_VERSION_FILE_NVMRC =
  /^\s*(?:-\s+)?node-version-file:\s*(?:'\.nvmrc'|"\.nvmrc"|\.nvmrc)\s*(?:#.*)?$/;

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

function stepPinsNvmrc(lines, isKeyLine, step) {
  return lines
    .slice(step.start, step.end)
    .some((line, offset) => isKeyLine[step.start + offset] && NODE_VERSION_FILE_NVMRC.test(line));
}

// A workflow that never calls setup-node yields no steps, so the pin check is
// simply vacuous for it — but the literal `node-version:` check still runs over
// every workflow, because a literal pin is drift wherever it is declared.
function checkWorkflowNodePin(file) {
  const text = readText(file);
  if (text === null) {
    return;
  }

  const lines = text.split('\n');
  const isKeyLine = yamlKeyLines(lines);

  setupNodeSteps(lines, isKeyLine)
    .filter(step => !stepPinsNvmrc(lines, isKeyLine, step))
    .forEach(step => {
      fail(
        'workflows',
        `${file}:${step.line} calls actions/setup-node without node-version-file: ${NVMRC}`
      );
    });

  lines.forEach((line, index) => {
    if (isKeyLine[index] && LITERAL_NODE_VERSION.test(line)) {
      fail(
        'workflows',
        `${file}:${index + 1} pins a literal node-version; use node-version-file: ${NVMRC}`
      );
    }
  });
}

workflowFiles.forEach(checkWorkflowNodePin);

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
    if (devcontainer.remoteEnv?.CI !== '1') {
      fail(
        'devcontainer',
        `${DEVCONTAINER} remoteEnv.CI must be "1", found "${devcontainer.remoteEnv?.CI}"`
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
