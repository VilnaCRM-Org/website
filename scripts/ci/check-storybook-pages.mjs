// scripts/ci/check-storybook-pages.mjs - fail when a Storybook build would 404
// on an asset once it is served from a sub-path (issue #523).
//
// GitHub Pages serves the build at https://vilnacrm-org.github.io/website/, so a
// reference that is root-absolute (`/sb-manager/runtime.js`) resolves to the
// organisation root, outside `/website/`, and 404s. A relative reference resolves
// under the sub-path and must name a file the build actually emitted. Storybook
// writes relative paths today; this gate is what keeps a builder upgrade, a
// `staticDirs` entry or a custom `publicPath` from breaking the published site
// silently, since nothing else ever loads the build from a sub-path.
//
// Four surfaces are read, each where a line-oriented match is the whole grammar
// of what the build emits: the manager and preview HTML (`src`/`href` attributes
// and the preview's inline `import` statements), every stylesheet's `url()`, the
// webpack runtime's public path, and the `static/media/...` assets the bundles
// request — the fonts and images a story loads after the page itself.
//
// Dependency-free, like scripts/ci/check-version-pins.mjs: the deploy job runs it
// on the host with no `bun install` behind it. Collect-all-then-fail, so one run
// names every broken reference.

import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_FILES = ['index.html', 'iframe.html', 'index.json'];
const HTML_FILES = ['index.html', 'iframe.html'];
const HTML_REFERENCE = /(?:\bsrc|\bhref)\s*=\s*["']([^"']+)["']|\bimport\s*\(?\s*["']([^"']+)["']/g;
const CSS_REFERENCE = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
const PUBLIC_PATH = /\.p\s*=\s*(["'])(.*?)\1/g;
const MEDIA_REFERENCE = /static\/media\/[\w.~-]+/g;
const EXTERNAL = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

const root = path.resolve(process.argv[2] ?? 'storybook-static-ci');
const failures = new Set();

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function display(file) {
  return path.relative(root, file);
}

function checkReference(file, reference) {
  if (EXTERNAL.test(reference)) return;
  if (reference.startsWith('/')) {
    failures.add(
      `${display(file)}: "${reference}" is root-absolute and resolves outside the sub-path`
    );
    return;
  }
  const target = path.resolve(path.dirname(file), reference.replace(/[?#].*$/, ''));
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) {
    failures.add(`${display(file)}: "${reference}" names no file in the build`);
  }
}

function checkPattern(file, pattern) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(pattern)) {
    checkReference(file, match[1] ?? match[2]);
  }
}

function checkRuntime(file) {
  for (const [, , value] of fs.readFileSync(file, 'utf8').matchAll(PUBLIC_PATH)) {
    if (value.startsWith('/')) {
      failures.add(`${display(file)}: webpack public path "${value}" is root-absolute`);
    }
  }
}

function checkMedia(file) {
  for (const [reference] of fs.readFileSync(file, 'utf8').matchAll(MEDIA_REFERENCE)) {
    if (!fs.existsSync(path.join(root, reference))) {
      failures.add(`${display(file)}: requests "${reference}", which the build never emitted`);
    }
  }
}

function checkBuild() {
  const missing = REQUIRED_FILES.filter(name => !fs.existsSync(path.join(root, name)));
  missing.forEach(name => failures.add(`${name} is missing from the build`));
  if (missing.length > 0) return;

  HTML_FILES.forEach(name => checkPattern(path.join(root, name), HTML_REFERENCE));
  const files = walk(root);
  files.filter(file => file.endsWith('.css')).forEach(file => checkPattern(file, CSS_REFERENCE));
  files
    .filter(file => file.endsWith('.js'))
    .forEach(file => {
      if (path.basename(file).startsWith('runtime~')) checkRuntime(file);
      checkMedia(file);
    });
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`check-storybook-pages: ${root} is not a directory; build Storybook first.`);
  process.exit(1);
}

checkBuild();

if (failures.size > 0) {
  console.error(
    `check-storybook-pages: ${failures.size} problem(s) would break the build under a sub-path:`
  );
  failures.forEach(failure => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log(
  `check-storybook-pages: every reference in ${path.basename(root)} resolves under a sub-path.`
);
