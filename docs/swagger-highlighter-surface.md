# The /swagger syntax-highlighter surface

What the `/swagger` page actually ships for syntax highlighting, how it was moved off an
end-of-life engine that no upstream release would take it off, what the former `prismjs`
override in `package.json` did and did not cover before it was removed, and why no
GitHub-native alert will ever say so. Written for issue #379 (OWASP A06:2021 Vulnerable
and Outdated Components) so the inventory is a checked fact rather than a recollection.
The versions below were read from `bun.lock`, `node_modules`, and a host build of the
static export on 2026-09-11, and the highlighter chain was re-read from `bun.lock` and
`node_modules` on 2026-09-30 when the engine was replaced (follow-up 2); re-verify
against the lockfile before relying on a number after a dependency bump.

## What ships

The chain, as resolved in `bun.lock`:

```text
swagger-ui-react@5.32.6            package.json: ^5.32.6
└── react-syntax-highlighter@16.1.1   swagger-ui-react: ^16.0.0
    ├── lowlight                      react-syntax-highlighter: ^1.17.0
    │                                 → overridden to 3.3.0; its lowlight 1 entry
    │                                   point is aliased to the shim (below)
    ├── highlight.js                  react-syntax-highlighter: ^10.4.1
    │                                 → overridden to 11.12.0
    ├── prismjs@1.30.0                react-syntax-highlighter: ^1.30.0   (not shipped)
    └── refractor@5.0.0               react-syntax-highlighter: ^5.0.0    (not shipped)

src/features/swagger/helpers/lowlight-compat.ts   (the shim)
└── lowlight@3.3.0                    package.json: ^3.3.0
    ├── highlight.js@11.12.0          lowlight: ~11.11.0 → overridden to 11.12.0
    └── devlop@1.1.0                  lowlight: ^1.0.0
```

`bun.lock` holds exactly one `highlight.js` entry (11.12.0) and one `lowlight` entry
(3.3.0). `lowlight@1.20.0`, `highlight.js@10.7.3`, and `fault` and `format` (which only
lowlight 1 needed) are gone. The `react-syntax-highlighter` entry still spells its edges
`"highlight.js": "10.7.3"` and `"lowlight": "1.20.0"`: the lockfile was migrated from
pnpm (#396) and records each parent's edge as the exact version it first resolved, and
bun resolves an overridden package through the override without rewriting that string —
`@lhci/cli`'s `"tmp": "0.1.0"` and `swagger-ui-react`'s `"dompurify": "3.4.7"` read the
same way under their overrides. `node_modules` confirms it: no nested copy exists under
`react-syntax-highlighter` or `lowlight`, and the hoisted packages are 3.3.0 and 11.12.0.

Only the highlight.js branch reaches a visitor:

- `swagger-ui-react`'s `#swagger-ui` import map resolves to `swagger-ui-es-bundle-core.js`
  in the browser. That bundle imports `react-syntax-highlighter/dist/esm/light` plus seven
  `languages/hljs/*` grammars — bash, http, javascript, json, powershell, xml, yaml — and
  seven `styles/hljs/*` themes. It imports nothing from the `prism` side of the package.
- `dist/esm/light.js` does `import lowlight from 'lowlight/lib/core'` and hands that
  object to its renderer. `next.config.js` aliases that exact request — `resolve.alias`
  for the webpack build (`lowlight/lib/core$`), `turbopack.resolveAlias` for `next dev` —
  to `src/features/swagger/helpers/lowlight-compat.ts`. The shim wraps one
  `createLowlight()` instance from lowlight 3, which requires `highlight.js/lib/core` —
  the light build, not the every-grammar `lib/index.js`. Each `languages/hljs/*` grammar
  is a one-line re-export of `highlight.js/lib/languages/<name>`, so under the override it
  is the highlight.js 11 grammar that registers.
- `react-syntax-highlighter` declares `sideEffects: false`, so webpack drops the unimported
  `prism*` entry points and, with them, `prismjs` and `refractor`. It also drops
  `default-highlight.js`, the only other module that imports `lowlight` — as the bare
  package, whose default export lowlight 3 no longer has.

The alias is not optional: lowlight 3's `exports` map declares only `.`, so without it
`lowlight/lib/core` does not resolve and the build fails. A bypassed alias therefore
breaks loudly at build time instead of shipping lowlight 1's emitter against the
highlight.js 11 core. The resolution was checked with webpack's own resolver
(`enhanced-resolve`, browser conditions) against the config `next.config.js` produces:
with the alias the request
lands on the shim, the shim's `lowlight` on `lowlight/index.js`, and the grammars and
lowlight's core on `highlight.js/es/*`; without it the resolver refuses
`./lib/core is not exported`.

The shim reproduces the part of lowlight 1's API the light build calls, matched against
`dist/esm/highlight.js`, `light.js` and `checkForListedLanguage.js`:

| lowlight 1                        | shim                                                  |
| --------------------------------- | ----------------------------------------------------- |
| `registerLanguage(name, grammar)` | `register(name, grammar)` on the shared instance      |
| `listLanguages()`                 | `listLanguages()`                                     |
| `highlight(language, code)`       | `{ value: root.children, language, relevance }`       |
| `highlightAuto(code)`             | same shape; `language: null`, `value: []` on no match |

The renderer reads `.value` as hast children and treats `language === null` as "render
the code as plain text", so the no-match case must stay `null` — lowlight 3 reports it as
`undefined`, which the renderer would take as a match with no nodes and render an empty
block. The light build assigns `SyntaxHighlighter.registerLanguage =
lowlight.registerLanguage` detached from its object, so no shim function reads `this`.
`registerAlias` and `highlightAuto`'s `subset`/`prefix` options are not reproduced;
nothing in the light build calls them.

highlight.js 11 names some tokens differently. Run over representative samples of all
seven grammars on both engines, every token kept the class the agate theme
(`syntaxHighlight.theme` is swagger-ui's default, `agate`; the site does not override it)
colours it by, with three differences:

- A JSON `true`/`false`/`null` is now `hljs-literal` wrapping `hljs-keyword`. Both are
  `#fcc28c` in agate, so the colour is unchanged.
- The strings inside an XML prolog (`version="1.0"`) are now `hljs-string` inside
  `hljs-meta`, so they render `#a2fca2` instead of `#fc9b9b`.
- In JavaScript, a called function is `hljs-title function_` (`#ffa`, was uncoloured),
  and `this`/`super`/`console` are `hljs-variable language_` (`#ade5fc`, was
  `hljs-built_in` `#ffa`). No JavaScript is rendered from the contract.

highlight.js 11 adds a sub-scope as an extra class after the prefixed one (`hljs-title
class_`). react-syntax-highlighter merges the stylesheet entry of every class a token
carries, and the prefixed class is always among them, so the theme still applies and the
shim does not rename any scope. The new `hljs-punctuation`, `hljs-property` and
`hljs-params` classes have no agate entry and render in the block's default white, as the
same text did before. Every colour the new classes select is an agate colour already on
the page, and each clears 4.5:1 on the `#333` block background (`#ffa` 12.1, `#a2fca2`
10.2, `#ade5fc` 9.3, `#fcc28c` 8.0). Two agate colours were below AA before this change
and still are, on the same tokens: numbers and bullets (`#d36363`, 3.45:1) and comments
(`#888`, 3.56:1). They are part of the waived `color-contrast` debt tracked by #423, not
something the engine swap introduced.

`src/test/unit/swagger/lowlight-compat.test.ts` pins that contract and the highlight.js
major; `tests/integration/coverage/swagger/lowlight-compat.integration.test.ts` registers
the seven swagger-ui grammars from `highlight.js/lib/languages/*` under swagger-ui's eight
names and checks each round-trips its text and keeps a class the agate theme colours (a
JSON literal additionally carries `hljs-keyword`, as noted above). No Jest suite renders
the real highlighter — every spec mocks `swagger-ui-react` — so `jest.config.ts` carries
no module mapping for the alias; it only lets babel-jest transform the ESM-only `lowlight`
and `devlop`.

The 2026-09-11 export check found the highlight.js `versionString` `"10.7.3"` in
`out/_next/static/chunks/`, pulled in by `pages/swagger` alone — the landing page's chunk
list contains none of the highlighter, because `pages/swagger.tsx` loads the feature
through `next/dynamic` with `ssr: false`. The engine swap does not move that boundary.
The export has not been rebuilt locally for it; confirm on the CI build artifact that the
only `versionString` is `"11.12.0"` and that lowlight 1's
``Expected `string` for name`` fault message is gone (lowlight 3 words its own errors
differently). There is no `Prism.languages` and no `refractor` package code; the one
`refract(` in the export belongs to ApiDOM (`refractorOpts` in the
`@swagger-api/apidom-parser-adapter-*` packages that swagger-client's OpenAPI 3.1 resolver
pulls in), an unrelated function that happens to share the name.

Two other packages the census named ship in the same lazy chunks and matter more than the
highlighter: `dompurify` (its `.version` string is in the export) and the `immutable` 3.x
nested under `swagger-ui-react` in `bun.lock`. Both were moved inside `swagger-ui-react`'s
own ranges by issue #501 (`dompurify` 3.4.7 → 3.4.13, `immutable` 3.8.3 → 3.8.4); see
follow-up 6.

## Status of the engine

highlight.js upstream lists `10.7.x` as "No longer supported" in its `SECURITY.md`; only
`11.x` receives fixes, and the newest release is 11.12.0 — the version the site now
ships. Until follow-up 2 it served the end-of-life 10.7.3 to every `/swagger` visitor.
The nightly osv-scanner census (issue #455) listed no advisory against `highlight.js`,
`lowlight`, `prismjs` or `refractor` as of 2026-09-11, so the exposure was unsupported
code, not a published CVE — exactly the kind of debt a CVE-keyed gate cannot see and this
document had to carry instead.

11.12.0 is one minor past the `~11.11.0` lowlight 3.3.0 declares. lowlight 3 drives
highlight.js through the emitter hooks 11.x keeps stable (`__emitter`, `startScope`,
`endScope`, `__addSublanguage`), and both specs above run lowlight 3.3.0 against 11.12.0.
If a later lowlight release narrows its highlight.js range on purpose, move the override
inside it.

## The upstream blocker

`react-syntax-highlighter@16.1.1` is the newest release and still declares
`highlight.js ^10.4.1` and `lowlight ^1.17.0`. `lowlight@1.x` is written against the
highlight.js 10 emitter API (`addKeyword`, `openNode` and `closeNode` in `lib/core.js`,
where 11.x calls `startScope`, `endScope` and `__addSublanguage`) and pins
`highlight.js ~10.7.0`; the lowlight lines built for highlight.js 11 are 2.x (`~11.0.0`)
and 3.x, which the `^1.17.0` range cannot reach. A bare
`overrides: { "highlight.js": "11.x" }` would therefore have left lowlight 1.20.0 driving
highlight.js 11 and broken it at runtime rather than upgraded it.
`swagger-ui-react@5.33.0`, the newest release, still declares
`react-syntax-highlighter ^16.0.0`, so nothing in range moves the page off highlight.js 10.

Follow-up 2 therefore overrides both packages together and replaces the one module
that spoke the old API: the `highlight.js` and `lowlight` overrides in `package.json`
(11.12.0 and 3.3.0), both also direct dependencies so the versions the shim and its
grammars run on are declared rather than inherited, and the alias that serves
`lowlight/lib/core` from the shim. ADR 0015 records the decision and its cost. Retire
all three together once `react-syntax-highlighter` depends on lowlight 3 (or later) and
calls it itself: then remove the alias, the shim and its specs, and both overrides, and
drop the direct dependencies unless something else imports them.

## Why the prismjs override existed

`package.json` carried `"overrides": { "prismjs": "1.30.0" }` until it was removed in the
F5 change below. It landed in `ccebf1a8`
(`feat(#29): add swagger page`, PR #195, 2025-06-04) alongside `swagger-ui-react ^5.22.0`.
At that commit `react-syntax-highlighter@15.6.1` declared `prismjs ^1.27.0` and its
`refractor@3.6.0` declared `prismjs ~1.27.0`; every prismjs release before 1.30.0 carries
GHSA-x7hr-w5r2-h6wg (CVE-2024-53382, DOM clobbering, fixed in 1.30.0). The override forced
both consumers onto 1.30.0 — the pnpm lockfile of that commit shows `refractor@3.6.0`
resolving `prismjs 1.30.0` — and that was a real fix at the time.

By the time it was removed it was inert, and it must never be read as coverage of the
highlighter tree:

- `react-syntax-highlighter@16.1.1` already requires `prismjs ^1.30.0`, and 1.30.0 is the
  newest prismjs, so the override changes nothing about that edge.
- `refractor@5.0.0` lists `prismjs` only as a devDependency and copies `prism-core.js` into
  its own `lib/`, so the override no longer reaches refractor's engine at all (in 3.x it
  did, through a real dependency edge).
- Neither prismjs nor refractor ships — see above — and the override never touched
  `highlight.js`, the engine that does.

The override was removed in the same change that landed Follow-up 3 below (issue #379,
F5). Dropping it changed nothing observable: prismjs and refractor still never ship, so the
override was pure dead weight by the time it was deleted.

## Why GitHub-native alerting is blind to this tree

- GitHub's Dependabot supported-ecosystems table lists `bun` as: version updates yes,
  security updates **no**. No repository setting changes that.
- The dependency graph does not parse `bun.lock`. The repository SBOM holds 118
  manifest-level packages read from `package.json` (`swagger-ui-react ^5.32.6` is there;
  `highlight.js`, `lowlight`, `immutable` and `dompurify` are not), and the graph's only
  non-workflow manifest is `package.json`.
- Consequently the repository shows **0** open Dependabot alerts. The 44 alerts that were
  still open against `pnpm-lock.yaml` flipped to "fixed" at `2026-07-23T22:12Z` — the
  minute the pnpm → bun migration (#396, commit `17556186`) deleted that lockfile — while
  the packages they named stayed installed. The nightly census listed 101 advisories on the
  same day this was checked.
- `dependency-review-action` would be equally blind: it diffs the same graph.

The watch on this tree is therefore osv-scanner (issue #356): `make lint-vulns` is the
differential pull-request gate, and `.github/workflows/osv-scanner.yml` carries both it and
the nightly census. `.github/dependabot.yml` records the same evidence next to the group
it constrains, and [SECURITY.md](../SECURITY.md) sets the triage timeline for the census.

## Follow-ups

None of these is a documentation change; each rewrites `bun.lock` or the rendered page and
so belongs in its own reviewed change, after the open dependency pull requests land.

1. **Bump `swagger-ui-react` in range, 5.32.6 → `^5.33.0`.** The newest release, 5.33.0,
   declares `js-yaml =4.3.2`, `swagger-client ^3.38.2` (which declares `js-yaml ^4.3.2`),
   `immutable ^5.1.9` and `dompurify ^3.4.13`. The `dompurify` and `immutable` census
   entries it would have cleared are already gone (follow-up 6), so what is left for this
   bump is the two nested `js-yaml@4.1.1` copies — `swagger-ui-react`'s own exact `=4.1.1`
   pin and `swagger-client`'s — which carry GHSA-2883-xcg3-v3hh, GHSA-52cp-r559-cp3m,
   GHSA-5p4m-2wfm-xmqj and GHSA-h67p-54hq-rp68 (all clear at 4.3.2). No lockfile move
   can reach the first copy, because the pin is exact. Both consumers then share the
   hoisted `js-yaml@4.3.2`. Stop short of 5.33.0 and the
   `js-yaml` half fails: 5.32.15 pins `=4.3.1`, which nests a third copy beside the
   hoisted one and still carries GHSA-2883-xcg3-v3hh. Not hermetic, and not small: the 112
   upstream commits between 5.32.6 and 5.33.0 rewrite `operations.jsx`, the models panels
   and the authorize popup, add operation virtualization and a skip link, and touch
   `responses.jsx`, which the owned responses-table port is pinned to (see
   `src/features/swagger/README.md`). Re-diff the port, then re-run the swagger e2e,
   visual baselines and accessibility route scan against the prod stack.
2. **Done: highlight.js 10 taken out of the export, highlighting kept (#379 F3).** The
   issue's own options — a webpack alias that stubs
   `react-syntax-highlighter/dist/esm/light` with `syntaxHighlight` turned off, or a
   different renderer — would each have changed what `/swagger` shows. The shim above
   keeps the renderer, the theme and every token's colour except the three listed in
   [What ships](#what-ships), and swaps only the engine: `lowlight` 1.20.0 → 3.3.0 and
   `highlight.js` 10.7.3 → 11.12.0. The swagger visual baselines are not expected to
   move: `src/test/visual/swagger/swaggerComparison.spec.ts` screenshots the page at
   load, with every operation collapsed, so no highlighted block is on screen. The
   swagger e2e journeys that expand an operation, the accessibility scan of the expanded
   operation, and the `/swagger` Lighthouse audit are what exercise the rendered chain.
3. **Done: `tmp` overridden to `0.2.7`.** `bun.lock` used to resolve `tmp@0.1.0` (via
   `@lhci/cli@0.15.1`, which declares `^0.1.0`) and `tmp@0.0.33` (via `@lhci/cli` →
   `inquirer@6.5.2` → `external-editor@3.1.0`). The census listed GHSA-ph9p-34f9-6g65
   (CVSS 7.7, fixed in 0.2.6) and GHSA-52f5-9888-hmc6 (fixed in 0.2.4) against both. Issue
   #379 asked for `>= 0.2.4`, which would have cleared only the second advisory; the floor
   was **0.2.6**, and `package.json`'s `overrides.tmp` now pins `0.2.7`, the newest release
   (no dependencies, Node `>= 14.14`) — confirmed against the osv.dev entries for both
   advisories before landing. Both call sites — `tmp.fileSync` in `@lhci/cli`'s `open`
   command and `tmpNameSync` in `external-editor` — survive in 0.2.x, and both are
   dev-only. `bun.lock` now carries a single hoisted `tmp@0.2.7` entry; the old
   `tmp@0.1.0`/`tmp@0.0.33` entries, and the `os-tmpdir`/`rimraf` sub-dependencies only
   0.0.x/0.1.x needed, are gone. Note that the Docker-in-Docker Lighthouse path in the
   Makefile installs `@lhci/cli@0.14.0` globally inside the prod container, outside
   `bun.lock`; the override does not reach it, and the lockfile criterion does not need it
   to. The inert `prismjs` override was dropped in the same lockfile change (issue #379,
   F5).
4. **Done: twelve dev-only transitives overridden within their major (#455).** Each is
   reachable only through build, lint or test tooling — none from the shipped export,
   `/swagger` included — and each `package.json` override is the lowest release that
   clears every advisory the census listed against it, so no parent is pushed past its
   major. `form-data` is the one that sits next to shipped code: it is a dependency of the
   `axios` that `/swagger` bundles, but axios's `browser` field maps its Node `FormData`
   class to an empty module, so the package never enters the export:
   - `fast-uri` 3.1.2 → **3.1.6**, via `ajv@8` (Mockoon, Spectral, webpack's
     `schema-utils`): GHSA-4c8g-83qw-93j6, GHSA-7p8r-x3mc-p8w7, GHSA-f65p-4m7j-42xc,
     GHSA-fph4-wmhf-6fwf, GHSA-jqff-g426-hqxp, GHSA-v2hh-gcrm-f6hx. Raised to **3.1.7**
     by #501 for GHSA-58mr-gqgx-xq4g and GHSA-qw65-cvwx-89v3, published after the pin.
   - `ip-address` 10.2.0 → **10.3.1**, via `socks` (Puppeteer, Lighthouse CI):
     GHSA-mwp4-54f8-5fhr, GHSA-22jq-vg5j-6vgg, GHSA-4xrf-jv44-h6hh. Raised to **10.5.1**
     by #501 for GHSA-2vr4-cq9g-pvrc and GHSA-rpw4-54j3-4h4q.
   - `joi` 18.2.1 / 18.2.3 → **18.2.5**, via `@mockoon/commons` and `wait-on`:
     GHSA-6w3j-5fw6-r9vr, GHSA-gg4h-3hg2-grpc.
   - `smol-toml`, `markdown-it` and `linkify-it` (**retired**). They were pinned to
     1.7.1, 14.2.0 and 5.0.2 for GHSA-7w5x-hrqm-74c2, GHSA-v3rj-xjv7-4jmq,
     GHSA-6v5v-wf23-fmfq and GHSA-v245-v573-v5vm, because `markdownlint-cli@0.47`
     declared `~1.5.2` and `~14.1.0`. #501 moved `markdownlint-cli` to 0.49.1, which
     declares `~1.7.0` and `~14.3.0` (14.3.2 declares `linkify-it ^5.0.2`), so all
     three entries were dropped in the same change.
   - `postcss-selector-parser` 7.1.1 → **7.1.3**, via `css-loader` (Storybook's
     webpack): GHSA-w9m9-85wc-3x92.
   - `form-data` 4.0.5 → **4.0.6**, via `axios` (`^4.0.5`; `wait-on`, and the Node build
     of `@swagger-api/apidom-reference`): GHSA-hmw2-7cc7-3qxx.
   - `nanoid` 3.3.12 → **3.3.18**, via both `postcss` copies — the hoisted one under
     Storybook's webpack loaders (`^3.3.16`, postcss 8.5.23) and `next`'s own `postcss@8.4.31`
     (`^3.3.6`): GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8.
   - `browserslist` 4.28.2 → **4.28.7**, via Babel's `helper-compilation-targets`,
     `core-js-compat` and webpack: GHSA-73wf-gq98-2v4g, GHSA-c83g-rgw3-j3cx. Its own
     caret ranges move the `electron-to-chromium` and `node-releases` data packages and
     nest a newer `caniuse-lite` under it, because the hoisted copy `next` resolves is
     older than the `^1.0.30001806` browserslist 4.28.7 asks for.
   - `baseline-browser-mapping` 2.10.32 → **2.11.0**, via `next` (`^2.9.19`) and
     `browserslist` (`^2.10.44`): GHSA-w5vr-8v7q-w6rv.
   - `qs` 6.15.1 / 6.15.2 → **6.16.0**, via `express` (Lighthouse CI, Mockoon),
     `body-parser` (Express, and `@apollo/server` in the local mock), Mockoon's
     `@mockoon/commons-server`, Stryker's `typed-rest-client` and Storybook's `url`
     polyfill: GHSA-4mjr-xmp4-gh2g, GHSA-q8mj-m7cp-5q26, GHSA-x5fp-wj9c-mxmx.

   `qs` steps past exact and tilde pins: `typed-rest-client@2.3.1` pins
   `6.15.1` and `express@4.22.2` (Lighthouse CI) declares `~6.15.1`. Their next releases
   already sit on 6.16 (`typed-rest-client` 3.x declares `^6.16.0`, `express@4.22.3`
   declares `~6.16.0`), so drop the entry once both have moved. `@mockoon/commons-server`
   already has: 9.9.0 pins `6.16.0` and brings its own `express@4.22.3`.

   Bun honours only top-level overrides, so a package the tree resolves at more than one
   major — `minimatch` 3/9/10, `brace-expansion` 1/2/5, `js-yaml` 3/4 — cannot be pinned
   this way without forcing a major on one of its consumers; item 5 moves those inside
   their parents' ranges instead. Retire an entry once no parent's range can resolve below
   it.

   The overrides reach only what `bun.lock` resolves. `Mockoon.Dockerfile` installs
   `@mockoon/cli` globally with `npm`, outside the lockfile, so the e2e mock image still
   runs the `joi` 18.2.3 that `@mockoon/commons` pins exactly, while the in-process
   contract harness runs 18.2.5; its `fast-uri` floats to the newest 3.x under `ajv`'s
   `^3.0.1` at image-build time instead of following the pin. Advisories inside that image
   are invisible to the lockfile-based CVE gate and clear only when Mockoon moves `joi`.

5. **Done: multi-major transitives re-resolved inside their parents' ranges (#455).**
   `brace-expansion`, `body-parser`, `js-yaml` and `immutable` each resolve at more than
   one major, and `postcss` shares its major with an exact pin an override must not
   touch, so they were moved by rewriting their `bun.lock` entries rather than by an
   override. Except for `postcss` (below), each new version is the newest release inside
   the range the parent's published manifest declares — what a fresh resolution would
   pick — and every copy is dev or build tooling:
   - `brace-expansion` 1.1.15 → **1.1.21** (hoisted, `minimatch@3` `^1.1.7`), 2.1.1 →
     **2.1.7** (Jest's `glob` → `minimatch@9` `^2.0.2`) and 5.0.6 → **5.0.12**
     (`minimatch@10.2` under API Extractor, Stryker, typescript-estree and
     `@swagger-api/apidom-reference`, `^5.0.2` / `^5.0.5`): GHSA-3jxr-9vmj-r5cp,
     GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895. apidom-reference sits in the `/swagger`
     tree, but it loads `minimatch` only from its Node file resolver, which its `browser`
     field swaps out, so none of these copies ships.
   - `body-parser` 1.20.5 → **1.20.8** (`express` `~1.20.5`) and 2.2.2 → **2.3.0**
     (`@apollo/server` `^2.2.2`, used only by the local GraphQL mock):
     GHSA-v422-hmwv-36x6. 2.3.0 asks for `content-type ^2.0.0`, so the `content-type@2.0.0`
     that `type-is` already nested is now nested one level up and shared.
   - `js-yaml` 3.14.2 → **3.15.2** (`@istanbuljs/load-nyc-config` and `@lhci/utils`, both
     `^3.13.1`): GHSA-2883-xcg3-v3hh, GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj,
     GHSA-h67p-54hq-rp68 for the 3.x line.
   - `immutable` 5.1.6 → **5.1.9** (`sass` `^5.1.5`): GHSA-v56q-mh7h-f735,
     GHSA-xvcm-6775-5m9r for the 5.x line.
   - `postcss` 8.5.15 → **8.5.23**, the hoisted copy Storybook's webpack uses
     (`@storybook/nextjs` `^8.4.38`, `css-loader` `^8.4.33` / `^8.4.40`,
     `resolve-url-loader`, the `postcss-modules-*` and `icss-utils` peers):
     GHSA-r28c-9q8g-f849, GHSA-fxqj-rqcc-2cmp. A top-level override would also have
     rewritten the exact `8.4.31` that `next@16.2.6` pinned, so `next/postcss` was left
     to the `next` bump. 8.5.23 is not the newest 8.5.x on purpose: it is the version
     `next@16.3.x` pins, and the two copies did collapse into one when #501 moved `next`
     to 16.3.6.
     `terser-webpack-plugin` lists `postcss` only as an optional peer with no range, so
     its edge keeps the migrated lockfile's exact-version form (`8.5.23`).

   The entries were rewritten by hand because neither bun command does it. The lockfile
   was migrated from pnpm (#396) and records each parent's dependency as the exact version
   it resolved (`minimatch@3.1.5` lists `"brace-expansion": "1.1.15"`), so a widened range
   alone changes nothing. Removing entries — a parent together with its child, or the
   children with their parents' edges widened — made bun 1.3.5 discard the lockfile and
   re-resolve every package (both attempts rewrote about 3,100 lines and moved
   `@apollo/client` 4.2.0 → 4.3.1), and `bun update <pkg>` promotes the transitive to a
   direct dependency. Instead, each child entry was rewritten from its registry manifest
   (version, dependency ranges, integrity), and the one edge in each parent entry was
   replaced by the range that parent publishes. Bun then re-serialised the file,
   `bun install --frozen-lockfile` accepts it, and a clean `node_modules` install checked
   every integrity hash. Repeat that recipe for the next in-range move, but only after
   checking every consumer of the moved child: a parent whose published range does not
   admit the new version (a peer placement on another major, for example) must keep its
   own nested entry rather than having its edge re-pointed; a hand-edited
   entry that bun would not have written shows up as a diff the next time it
   re-serialises.

   The 4.x `js-yaml` line moved with the root devDependency (`^4.3.2`, issue #322): the
   hoisted copy is now **4.3.2**, and `@eslint/eslintrc` (`^4.1.1`) and both
   `cosmiconfig` copies (`^4.1.0`) had their edges widened onto it the same way. Two
   consumers keep a nested `js-yaml@4.1.1`: `swagger-ui-react` (`=4.1.1`) and
   `swagger-client` stay on the version the `/swagger` bundle has always shipped.
   `swagger-client` declares `^4.1.0`, so its copy could take the hoisted 4.3.2 by this
   recipe, but `swagger-ui-react`'s exact pin holds a `js-yaml@4.1.1` in the tree either
   way, so the census entry would not clear; item 1 moves both copies together. The
   cost is that the lazy `/swagger` chunk now bundles two identical copies of
   `js-yaml@4.1.1` (about 13 KB gzipped more) where the hoisted copy used to serve both;
   item 1's bump collapses them. The third, under `markdownlint-cli@0.47` (`~4.1.1`), went
   with the 0.49.1 bump in #501, together with the `minimatch@10.1.3` and
   `brace-expansion@5.0.6` below it: 0.49.1's `minimatch ~10.2.5` resolved
   `brace-expansion@5.0.12` on its own, and its `js-yaml ~5.2.1` resolves 5.2.3, past
   GHSA-pm4m-ph32-ghv5 (5.0.0–5.2.1).

6. **Done: the census burn-down of #501.** Every move below is the lowest release that
   clears every advisory the census listed against the package unless noted, checked
   against the GitHub advisory API before landing:
   - `next` 16.2.6 → **16.3.6**, with `@next/*` and `eslint-config-next` (Dependabot's
     #473 pairing, without its React 19.3 half — `next` 16.3 still peers on `^19.0.0`).
     GHSA-2xp9-vwfh-vxw4 and GHSA-p293-qw3h-jr36 are fixed only in 16.3.3; the other nine
     at 16.2.11. The static export serves no image optimizer, but the census counts them.
   - `sharp` 0.34.5 → **0.35.5** (override). `next` 16.3 already declares `^0.35.4`, but
     `next-export-optimize-images@4.7.0` — the latest, and the package that runs sharp over every
     exported image — declares `^0.34.3`, so like the `tmp` override above it moves a consumer
     across a 0.x minor, which semver treats as a breaking release, and this one reaches the
     production build. Its call path (`resize`, then `jpeg`/`png`/`webp`/`avif`, WebP-only in
     `export-images.config.js`) avoids every 0.35 removal. GHSA-rgj7-g3m4-5g8c, GHSA-f88m-g3jw-g9cj.
     Drop the entry once `next-export-optimize-images` declares `^0.35`.
   - `axios` 1.16.1 → **1.18.0** (override; `@swagger-api/apidom-reference` and `wait-on`
     declare `^1.16.0`): ten advisories, GHSA-gcfj-64vw-6mp9 through GHSA-xj6q-8x83-jv6g.
   - `dompurify` 3.4.7 → **3.4.13** (override; `swagger-ui-react` declares `^3.4.0`):
     GHSA-55q2-fjhq-7xh7, GHSA-cmwh-pvxp-8882, GHSA-c2j3-45gr-mqc4, GHSA-vxr8-fq34-vvx9,
     GHSA-gvmj-g25r-r7wr. Ships in the `/swagger` chunk.
   - `immutable` 3.8.3 → **3.8.4** for `swagger-ui-react` (`^3.x.x`) and the three peer
     placements beside it, by the lockfile recipe of item 5 (the 5.x line keeps `sass`):
     GHSA-v56q-mh7h-f735, GHSA-xvcm-6775-5m9r. Ships in the `/swagger` chunk. Only
     `redux-immutable`'s peer edge takes its published range (`^3.8.1 || ^4.0.0-rc.1`).
     `react-immutable-proptypes` (`>=3.6.2`) and `react-immutable-pure-component`
     (`>= 2 || >= 4.0.0-rc`) publish ranges the hoisted `immutable@5.1.9` satisfies, so
     widening their edges made bun drop both nested copies and bundle a second
     `immutable` major into `/swagger`; their edges keep the migrated exact form
     (`3.8.4`), as `terser-webpack-plugin`'s `postcss` edge does, and all four
     placements resolve `immutable@3.8.4`.
   - `image-size` 2.0.2 → **2.0.3** (override; `@storybook/nextjs` `^2.0.2`):
     GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr. Dropped with the Storybook 10.6.1 bump
     (#475): its `@storybook/nextjs` reads image sizes through `probe-image-size` instead,
     so `image-size` left the tree and the override went with it.
   - `storybook` and its four sibling packages 10.4.1 → **10.4.6**, the first release whose
     `esbuild` range admits `^0.28.0`, so its nested `esbuild@0.27.7` (GHSA-g7r4-m6w7-qqqr,
     no 0.27.x fix) folds into the hoisted 0.28.1.

   What the census still lists, and why no change here reaches it:
   - `js-yaml@4.1.1` (four advisories): two nested copies, `swagger-ui-react`'s exact
     `=4.1.1` pin and `swagger-client`'s. The exact pin keeps the entry listed whatever
     happens to the other copy — item 1.
   - `extract-zip@2.0.1` (GHSA-jmr9-qjv8-65gv, GHSA-7pqw-9j4j-h8q3): no fixed release. It
     arrives through `@puppeteer/browsers` 2.x under `puppeteer` 24, the major memlab
     (`^24.2.0`) and Lighthouse's `puppeteer-core` (`^24.10.0`) declare;
     `@puppeteer/browsers` 3.x drops it, but only `puppeteer` 25 uses 3.x. Dev-only
     (memlab, Lighthouse CI).
   - `elliptic@6.6.1` (GHSA-848j-6mx2-7j84): no fixed release. Reached only through
     `node-polyfill-webpack-plugin` → `crypto-browserify` in Storybook's webpack config.
   - `uuid@8.3.2` (GHSA-w5hq-g745-h8pq): fixed only in 11.1.1 and later majors;
     `@lhci/cli@0.15.1`, the latest, declares `^8.3.1` and calls only `uuid.v4()`, while
     the advisory is the `buf` argument of v3/v5/v6. The root `uuid` is already 14.x, and
     bun overrides are top-level only, so the one available override would push
     `@lhci/cli` across six majors. Dev-only.
   - `@faker-js/faker@9.9.0` (GHSA-qxc2-j82w-r537): fixed in 10.5.0, but
     `@mockoon/commons-server` pins `9.9.0` exactly up to its latest release (9.9.0), and
     `Mockoon.Dockerfile` and a spec hold that package to the Mockoon CLI version. The
     advisory needs an attacker-controlled `helpers.fake` template; Mockoon only renders
     the committed mock data. Dev-only.
