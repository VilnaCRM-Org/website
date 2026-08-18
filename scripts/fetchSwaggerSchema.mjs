import 'dotenv/config';
import { writeFile } from 'node:fs/promises';

import { load } from 'js-yaml';

const swaggerPath = './contracts/user-service/openapi.json';

// USER_SERVICE_VERSION is the single pin for every user-service contract and
// lives in .env. Refuse to fall back to a hidden default: a silent default would
// let a refresh or the drift check run against the wrong generation of the spec.
function requireUserServiceVersion() {
  const version = process.env.USER_SERVICE_VERSION;
  if (!version) {
    throw new Error(
      'USER_SERVICE_VERSION is not set — define it in .env (the single user-service pin).'
    );
  }
  return version;
}

export function buildSpecUrl() {
  return `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${requireUserServiceVersion()}/.github/openapi-spec/spec.yaml`;
}

export async function fetchSwaggerYaml(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL parameter is required and must be a string');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch swagger schema. HTTP status: ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

// Keywords the upstream spec emits as `null` — `maxLength: null` on 158 schema
// properties and `format: null` on 166. Both are invalid per OpenAPI 3 (maxLength
// must be a non-negative integer, format a string), they render as noise on the
// swagger page, and they make `spectral lint` abort outright instead of reporting.
const DROP_WHEN_NULL = new Set(['maxLength', 'format']);

/**
 * Drops the invalid `null` keywords listed in DROP_WHEN_NULL, recursively.
 *
 * Scoped to those keys on purpose. A blanket "strip every null" would also delete
 * legitimate OpenAPI 3.1 metadata such as `default: null` or `example: null`, and
 * because the drift check normalizes both sides the same way, that deletion would
 * pass silently while mutating the committed contract. Normalizing at the single
 * point where the document enters this repo keeps the committed artifact a valid
 * OpenAPI document; nothing carrying meaning is removed.
 */
export function normalizeSpec(node) {
  if (Array.isArray(node)) {
    return node.map(normalizeSpec);
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key, value]) => !(value === null && DROP_WHEN_NULL.has(key)))
        .map(([key, value]) => [key, normalizeSpec(value)])
    );
  }
  return node;
}

// Prose fields swagger-ui renders as markdown, and therefore the fields an
// upstream compromise would use to land markup in every /swagger visitor's DOM.
// `externalDocs.description` is a `description`, so it is covered by the walk.
const PROSE_KEYS = new Set(['description', 'title', 'summary']);

// Matched against the HTML element names below rather than "anything in angle
// brackets". API prose legitimately contains `Array<User>`, `<your token>` and
// `<support@vilnacrm.com>`, none of which a markdown renderer treats as HTML — a
// guard that rejected them would fail `make update-contracts` on valid upstream
// text, and the next person would loosen the gate to get unblocked. Only a name
// the renderer would actually turn into an element counts.
const HTML_ELEMENTS = new Set(
  (
    'a abbr address applet area article aside audio b base basefont bdi bdo big blockquote body ' +
    'br button canvas caption center cite code col colgroup data datalist dd del details dfn ' +
    'dialog dir div dl dt em embed fieldset figcaption figure font footer form frame frameset ' +
    'h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li ' +
    'link main map mark marquee math menu meta meter nav noembed noframes noscript object ol ' +
    'optgroup option output p param picture plaintext pre progress q rb rp rt rtc ruby s samp ' +
    'script search section select slot small source span strike strong style sub summary sup ' +
    'svg table tbody td template textarea tfoot th thead time title tr track tt u ul var video ' +
    'wbr xmp'
  ).split(' ')
);

// The lookahead makes the element name end the way HTML ends it — whitespace, a
// self-closing slash, or the closing bracket — so `<support@vilnacrm.com>` never
// parses as a `<support>` tag.
const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)(?=[\s/>])[^>]*>/g;
const HTML_COMMENT = '<!--';

export function findMarkup(value) {
  if (value.includes(HTML_COMMENT)) {
    return HTML_COMMENT;
  }
  const tag = [...value.matchAll(TAG)].find(match => HTML_ELEMENTS.has(match[1].toLowerCase()));
  return tag ? tag[0] : null;
}

const isUnsafeUrl = value => !/^https?:\/\//i.test(value);

/**
 * Rejects the document instead of rewriting it.
 *
 * The obvious alternative — strip the tags — cannot be done safely: prose like
 * `maxLength < 10 and format > 0` is indistinguishable from `<b and c>` to any
 * tag regex, so a stripper silently mutates legitimate text. The spec is
 * vendored and enters the repo through a reviewed `make update-contracts` diff,
 * so markup appearing in a description is a review-worthy event, not something
 * to paper over. Failing closed keeps the committed contract provably
 * markup-free without ever mangling upstream prose.
 */
export function assertNoMarkup(node, path = '$') {
  if (Array.isArray(node)) {
    node.forEach((value, index) => assertNoMarkup(value, `${path}[${index}]`));
    return;
  }
  if (!node || typeof node !== 'object') {
    return;
  }

  Object.entries(node).forEach(([key, value]) => {
    const here = `${path}.${key}`;

    if (typeof value !== 'string') {
      assertNoMarkup(value, here);
      return;
    }
    if (PROSE_KEYS.has(key)) {
      const markup = findMarkup(value);
      if (markup !== null) {
        throw new Error(
          `Upstream spec carries HTML markup at ${here} — refusing to vendor it: ${markup}`
        );
      }
    }
    if (key === 'url' && path.endsWith('.externalDocs') && isUnsafeUrl(value)) {
      throw new Error(`Upstream spec carries a non-http(s) ${here}: ${value}`);
    }
  });
}

export async function saveSwaggerJson(yamlText, filePath) {
  if (!yamlText || typeof yamlText !== 'string') {
    throw new Error('yamlText parameter is required and must be a string');
  }
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath parameter is required and must be a string');
  }
  const jsonContent = normalizeSpec(load(yamlText));
  assertNoMarkup(jsonContent);
  await writeFile(filePath, `${JSON.stringify(jsonContent, null, 2)}\n`);
}

export async function refreshSwaggerSchema(url, filePath) {
  const swaggerSchema = await fetchSwaggerYaml(url);
  await saveSwaggerJson(swaggerSchema, filePath);
  console.log('✅ Swagger schema saved as JSON');
  return true;
}

// Only fetch when run as a script: lint-contracts.mjs imports the helpers above
// and an unguarded IIFE would hit the network on import. Matched on argv rather
// than import.meta because Jest transforms this module to CJS, where import.meta
// is not available.
if (process.argv[1]?.endsWith('fetchSwaggerSchema.mjs')) {
  (async () => {
    try {
      await refreshSwaggerSchema(buildSpecUrl(), swaggerPath);
    } catch (err) {
      console.error('❌ Failed to fetch/save swagger schema:', err);
      process.exitCode = 1;
    }
  })();
}
