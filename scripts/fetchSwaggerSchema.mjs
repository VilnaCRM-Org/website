import 'dotenv/config';
import { writeFile } from 'node:fs/promises';

import { load } from 'js-yaml';

import { requireImmutableUserServiceVersion } from './contracts/refs.mjs';

const swaggerPath = './contracts/user-service/openapi.json';

// USER_SERVICE_VERSION is the single pin for every user-service contract and
// lives in .env. Refuse to fall back to a hidden default: a silent default would
// let a refresh or the drift check run against the wrong generation of the spec.
// The ref SHAPE is checked here rather than only in the gate, so a branch-shaped
// pin cannot be downloaded, vendored and digested before anything complains.
export function buildSpecUrl() {
  return `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${requireImmutableUserServiceVersion()}/.github/openapi-spec/spec.yaml`;
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

// swagger-ui renders a lot of this document as Markdown — `description`,
// `title` and `summary` on the info block, tags, paths, operations, parameters,
// request bodies, responses (including `responses.default`), headers, schemas,
// security schemes and Example Objects. Those are the strings an upstream
// compromise would use to land markup in every /swagger visitor's DOM.
//
// This checks EVERY string instead of trying to name that list, because the list
// cannot be expressed by key name. OpenAPI reuses the same names for different
// things depending on the parent: `default` is a schema keyword in a Schema
// Object but a response key in a Responses Object; `example`, `value` and
// `summary` are keywords in some positions and user-chosen names in others
// (`properties`, `patternProperties`, `$defs`, and every `components.*` map).
// Three successive attempts to carve out "payload" positions each closed one
// bypass and opened another, so there are now no carve-outs to get wrong.
//
// The cost is a false positive if upstream ever puts real HTML in a sample
// payload. That is affordable and deliberate: this runs at ingestion, inside a
// maintainer's `make update-contracts`, not on every PR — so the failure mode is
// one loud, reviewable message during a deliberate refresh, against a document
// that today holds 712 strings and not one `<`. Widening it is a decision for a
// reviewer to record, not something to pre-emptively guess at.

// The exact positions swagger-ui turns into a clickable anchor: the info block's
// terms link, the topbar's contact and license links, and externalDocs wherever
// it appears. Matched by POSITION rather than by key name, because a bare `url`
// key occurs all over a spec — in sample payloads, in vendor extensions, in a
// schema property that merely happens to be named `url` — where a relative URI is
// correct and nothing is ever rendered as a link.
const LINK_PATHS = [
  /^\$\.info\.termsOfService$/,
  /^\$\.info\.contact\.url$/,
  /^\$\.info\.license\.url$/,
  /\.externalDocs\.url$/,
];

const isLinkPosition = here => LINK_PATHS.some(pattern => pattern.test(here));

// Matched against HTML element names rather than "anything in angle brackets".
// API prose legitimately contains `Array<User>`, `<your token>` and
// `<support@vilnacrm.com>`, none of which a Markdown renderer treats as HTML — a
// guard that rejected them would fail `make update-contracts` on valid upstream
// text, and the next person would loosen the gate to get unblocked.
//
// The policy is fail-closed, so a name MISSING from this set is a bypass rather
// than a nuisance. It is therefore the WHATWG element index plus every obsolete
// element the spec still requires parsers to recognise (`acronym`, `blink`,
// `nobr`, `spacer`, …) — a renderer will happily build a node for those too.
//
// It is also a strict superset of the element allowlist in the DOMPurify that
// swagger-ui-react bundles, which is the set that actually survives sanitising
// and reaches the DOM. Re-derive after a swagger-ui bump with:
//   node -e "const s=require('fs').readFileSync('node_modules/dompurify/dist/purify.cjs.js','utf8');
//            console.log(s.match(/html\\\$1 = freeze\\(\\[([^\\]]+)\\]/)[1])"
// `content`, `decorator` and `shadow` came from exactly that diff.
const HTML_ELEMENTS = new Set(
  (
    'a abbr acronym address applet area article aside audio b base basefont bdi bdo bgsound big ' +
    'blink blockquote body br button canvas caption center cite code col colgroup command content ' +
    'data datalist dd decorator del details dfn dialog dir div dl dt element em embed fencedframe ' +
    'fieldset ' +
    'figcaption figure font footer form frame frameset h1 h2 h3 h4 h5 h6 head header hgroup hr ' +
    'html i iframe image img input ins isindex kbd keygen label legend li link listing main map ' +
    'mark marquee math menu menuitem meta meter multicol nav nextid nobr noembed noframes ' +
    'noscript object ol optgroup option output p param picture plaintext portal pre progress q ' +
    'rb rp rt rtc ruby s samp script search section select selectedcontent slot small source ' +
    'shadow spacer span strike strong style sub summary sup svg table tbody td template textarea ' +
    'tfoot ' +
    'th thead time title tr track tt u ul var video wbr xmp'
  ).split(' ')
);

// The lookahead makes the element name end the way HTML ends it — whitespace, a
// self-closing slash, or the closing bracket — so `<support@vilnacrm.com>` never
// parses as a `<support>` tag.
const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)(?=[\s/>])[^>]*>/g;
const HTML_COMMENT = '<!--';

// A Markdown code fence or inline span escapes its contents, so `<code>` written
// inside one is displayed as text and never becomes an element. Blanking those
// regions keeps the guard from rejecting the normal way an API spec talks about
// markup — and `<code>` in particular, which is this service's OAuth parameter
// name. Only BALANCED delimiters are blanked: an unclosed backtick is not a code
// span to a Markdown renderer either, so it must stay visible to the scan.
const CODE_FENCE = /^([ \t]*)(```+|~~~+)[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*$/gm;
const CODE_SPAN = /(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g;

const blankCode = value => value.replace(CODE_FENCE, ' ').replace(CODE_SPAN, ' ');

// swagger-ui renders these fields as Markdown, so markup is not the only way in:
// `![](https://attacker.example/beacon.png)` needs no angle bracket and loads a
// cross-origin request from every visitor's browser with no interaction at all.
// Markdown LINKS are deliberately not blocked — they are legitimate in a spec
// (docs references), they require a click, and they show up in the reviewed
// `make update-contracts` diff. An auto-loading remote resource does not.
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(/;

export function findMarkup(value) {
  const scannable = blankCode(value);

  if (MARKDOWN_IMAGE.test(scannable)) {
    return scannable.match(MARKDOWN_IMAGE)[0];
  }
  if (scannable.includes(HTML_COMMENT)) {
    return HTML_COMMENT;
  }
  const tag = [...scannable.matchAll(TAG)].find(match => HTML_ELEMENTS.has(match[1].toLowerCase()));
  return tag ? tag[0] : null;
}

const isUnsafeUrl = value => !/^https?:\/\//i.test(value);

function assertStringIsSafe(value, here) {
  if (isLinkPosition(here) && isUnsafeUrl(value)) {
    throw new Error(`Upstream spec carries a non-http(s) ${here}: ${JSON.stringify(value)}`);
  }

  const markup = findMarkup(value);
  if (markup !== null) {
    throw new Error(
      `Upstream spec carries HTML markup at ${here} — refusing to vendor it: ${markup}`
    );
  }
}

/**
 * Rejects the document instead of rewriting it.
 *
 * The obvious alternative — strip the tags — cannot be done safely: prose like
 * `maxLength < 10 and format > 0` is indistinguishable from `<b and c>` to any
 * tag regex, so a stripper silently mutates legitimate text. The spec is
 * vendored and enters the repo through a reviewed `make update-contracts` diff,
 * so markup appearing anywhere in it is a review-worthy event, not something to
 * paper over. Failing closed keeps the committed contract provably markup-free
 * without ever mangling upstream prose.
 *
 * See the note above `LINK_KEYS` for why this checks every string rather than a
 * curated set of rendered fields.
 */
export function assertNoMarkup(node, path = '$') {
  if (typeof node === 'string') {
    assertStringIsSafe(node, path);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((value, index) => assertNoMarkup(value, `${path}[${index}]`));
    return;
  }
  if (!node || typeof node !== 'object') {
    return;
  }

  Object.entries(node).forEach(([childKey, value]) => {
    // Keys are rendered too — a path name and a schema property name both appear
    // in the swagger UI — so "every string" has to mean the keys as well.
    const markup = findMarkup(childKey);
    if (markup !== null) {
      throw new Error(
        `Upstream spec carries HTML markup in the key ${path}.${childKey} — ` +
          `refusing to vendor it: ${markup}`
      );
    }
    assertNoMarkup(value, `${path}.${childKey}`);
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
