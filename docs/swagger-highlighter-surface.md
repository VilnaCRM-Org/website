# The /swagger syntax-highlighter surface

What the `/swagger` page actually ships for syntax highlighting, why it is stuck on an
end-of-life engine, what the former `prismjs` override in `package.json` did and did not
cover before it was removed, and why no GitHub-native alert will ever say so. Written for
issue #379 (OWASP A06:2021
Vulnerable and Outdated Components) so the inventory is a checked fact rather than a
recollection. Every version below was read from `bun.lock`, `node_modules`, and a host
build of the static export on 2026-09-11; re-verify against the lockfile before relying on
a number after a dependency bump.

## What ships

The chain, as resolved in `bun.lock`:

```text
swagger-ui-react@5.32.6            package.json: ^5.32.6
└── react-syntax-highlighter@16.1.1   swagger-ui-react: ^16.0.0
    ├── lowlight@1.20.0               react-syntax-highlighter: ^1.17.0
    │   └── highlight.js@10.7.3       lowlight: ~10.7.0
    ├── highlight.js@10.7.3           react-syntax-highlighter: ^10.4.1
    ├── prismjs@1.30.0                react-syntax-highlighter: ^1.30.0   (not shipped)
    └── refractor@5.0.0               react-syntax-highlighter: ^5.0.0    (not shipped)
```

Only the highlight.js branch reaches a visitor:

- `swagger-ui-react`'s `#swagger-ui` import map resolves to `swagger-ui-es-bundle-core.js`
  in the browser. That bundle imports `react-syntax-highlighter/dist/esm/light` plus seven
  `languages/hljs/*` grammars — bash, http, javascript, json, powershell, xml, yaml — and
  seven `styles/hljs/*` themes. It imports nothing from the `prism` side of the package.
- `dist/esm/light.js` wraps `lowlight/lib/core`, and lowlight's core requires
  `highlight.js/lib/core` — the light build, not the 191-language `lib/index.js`.
- `react-syntax-highlighter` declares `sideEffects: false`, so webpack drops the unimported
  `prism*` entry points and, with them, `prismjs` and `refractor`.

The export confirms it. In `out/_next/static/chunks/` the only highlight.js
`versionString` is `"10.7.3"`; that chunk, the lowlight core (recognisable by its
`Unknown language` fault message) and the react-syntax-highlighter renderer are pulled in
by `pages/swagger` alone — the landing page's chunk list contains none of them, because
`pages/swagger.tsx` loads the feature through `next/dynamic` with `ssr: false`. The
`registerLanguage` calls in the swagger chunk are exactly the seven grammars above (plus
the `js` alias). There is no `Prism.languages` and no `refractor` package code; the one
`refract(` in the export belongs to ApiDOM (`refractorOpts` in the
`@swagger-api/apidom-parser-adapter-*` packages that swagger-client's OpenAPI 3.1 resolver
pulls in), an unrelated function that happens to share the name.

Two other packages the census names ship in the same lazy chunks and matter more than the
highlighter: `dompurify@3.4.7` (its `.version` string is in the export) and
`immutable@3.8.3` (nested under `swagger-ui-react` in `bun.lock`). See the follow-ups.

## Status of the engine

highlight.js upstream lists `10.7.x` as "No longer supported" in its `SECURITY.md`; only
`11.x` receives fixes, and the newest release is 11.12.0. The site therefore serves an
end-of-life highlighter to every `/swagger` visitor. The nightly osv-scanner census
(issue #455) lists no advisory against `highlight.js`, `lowlight`, `prismjs` or `refractor`
as of 2026-09-11, so the exposure is unsupported code, not a published CVE — which is
exactly the kind of debt a CVE-keyed gate cannot see and this document has to carry
instead.

## The upstream blocker

`react-syntax-highlighter@16.1.1` is the newest release and still declares
`highlight.js ^10.4.1` and `lowlight ^1.17.0`. `lowlight@1.x` is written against the
highlight.js 10 emitter API (`openNode` / `closeNode` in `lib/core.js`) and pins
`highlight.js ~10.7.0`; the lowlight line built for highlight.js 11 is 2.x (`~11.0.0`),
which the `^1.17.0` range cannot reach. A bare `overrides: { "highlight.js": "11.x" }`
would therefore break lowlight 1.20.0 at runtime rather than upgrade it — do not add one.
`swagger-ui-react@5.32.15`, the newest release, still declares
`react-syntax-highlighter ^16.0.0`, so nothing in range moves the page off highlight.js 10.

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

1. **Bump `swagger-ui-react` in range, 5.32.6 → 5.32.15.** The newest release declares
   `immutable ^5.1.9`, `dompurify ^3.4.13` and `swagger-client ^3.38.0`. That is where the
   census entries that ship in the public `/swagger` bundle go away: `immutable@3.8.3`
   carries GHSA-v56q-mh7h-f735 (fixed in 4.3.9 / 5.1.8) and `dompurify@3.4.7` carries
   GHSA-55q2-fjhq-7xh7 (fixed in 3.4.13). Not hermetic — the releases between change the
   rendered markup, so the swagger visual baselines and the accessibility route scan must
   be re-run against the prod stack.
2. **Take highlight.js 10 out of the export.** Upstream offers no in-range path (above), so
   the options are a webpack alias that stubs `react-syntax-highlighter/dist/esm/light`
   with `syntaxHighlight` turned off, or a different renderer. Either changes what
   `/swagger` shows, needs the prod stack, and re-baselines the swagger visual snapshots.
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
4. **Done: eleven dev-only transitives overridden within their major (#455).** Each is
   reachable only through build, lint or test tooling — none from the shipped export,
   `/swagger` included — and each `package.json` override is the lowest release that
   clears every advisory the census listed against it, so no parent is pushed past its
   major. `form-data` is the one that sits next to shipped code: it is a dependency of the
   `axios` that `/swagger` bundles, but axios's `browser` field maps its Node `FormData`
   class to an empty module, so the package never enters the export:
   - `fast-uri` 3.1.2 → **3.1.6**, via `ajv@8` (Mockoon, Spectral, webpack's
     `schema-utils`): GHSA-4c8g-83qw-93j6, GHSA-7p8r-x3mc-p8w7, GHSA-f65p-4m7j-42xc,
     GHSA-fph4-wmhf-6fwf, GHSA-jqff-g426-hqxp, GHSA-v2hh-gcrm-f6hx.
   - `ip-address` 10.2.0 → **10.3.1**, via `socks` (Puppeteer, Lighthouse CI):
     GHSA-mwp4-54f8-5fhr, GHSA-22jq-vg5j-6vgg, GHSA-4xrf-jv44-h6hh.
   - `joi` 18.2.1 / 18.2.3 → **18.2.5**, via `@mockoon/commons` and `wait-on`:
     GHSA-6w3j-5fw6-r9vr, GHSA-gg4h-3hg2-grpc.
   - `smol-toml` 1.5.2 → **1.7.1**, via `markdownlint-cli`: GHSA-7w5x-hrqm-74c2,
     GHSA-v3rj-xjv7-4jmq.
   - `markdown-it` 14.1.1 → **14.2.0**, via `markdownlint-cli`: GHSA-6v5v-wf23-fmfq.
   - `linkify-it` 5.0.1 → **5.0.2**, via `markdown-it`: GHSA-v245-v573-v5vm.
   - `postcss-selector-parser` 7.1.1 → **7.1.3**, via `css-loader` (Storybook's
     webpack): GHSA-w9m9-85wc-3x92.
   - `form-data` 4.0.5 → **4.0.6**, via `axios` (`^4.0.5`; `wait-on`, and the Node build
     of `@swagger-api/apidom-reference`): GHSA-hmw2-7cc7-3qxx.
   - `nanoid` 3.3.12 → **3.3.18**, via both `postcss` copies — the hoisted one under
     Storybook's webpack loaders (`^3.3.12`) and `next`'s own `postcss@8.4.31`
     (`^3.3.6`): GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8.
   - `browserslist` 4.28.2 → **4.28.7**, via Babel's `helper-compilation-targets`,
     `core-js-compat` and webpack: GHSA-73wf-gq98-2v4g, GHSA-c83g-rgw3-j3cx. Its own
     caret ranges move the `electron-to-chromium` and `node-releases` data packages and
     nest a newer `caniuse-lite` under it, because the hoisted copy `next` resolves is
     older than the `^1.0.30001806` browserslist 4.28.7 asks for.
   - `baseline-browser-mapping` 2.10.32 → **2.11.0**, via `next` (`^2.9.19`) and
     `browserslist` (`^2.10.44`): GHSA-w5vr-8v7q-w6rv.

   `smol-toml` and `markdown-it` step past `markdownlint-cli@0.47`'s tilde ranges
   (`~1.5.2`, `~14.1.0`) but not its majors; `markdownlint-cli@0.49` itself declares
   `~1.7.0` and `~14.3.0`, so drop both entries in the change that moves
   `markdownlint-cli` to 0.49 rather than leaving them as permanent out-of-range pins.

   Bun honours only top-level overrides, so a package the tree resolves at more than one
   major — `minimatch` 3/9/10, `brace-expansion` 1/2/5, `js-yaml` 3/4 — cannot be pinned
   this way without forcing a major on one of its consumers, and is left for its parents
   to move. Retire an entry once no parent's range can resolve below it.

   The overrides reach only what `bun.lock` resolves. `Mockoon.Dockerfile` installs
   `@mockoon/cli` globally with `npm`, outside the lockfile, so the e2e mock image still
   runs the `joi` 18.2.3 that `@mockoon/commons` pins exactly, while the in-process
   contract harness runs 18.2.5; its `fast-uri` floats to the newest 3.x under `ajv`'s
   `^3.0.1` at image-build time instead of following the pin. Advisories inside that image
   are invisible to the lockfile-based CVE gate and clear only when Mockoon moves `joi`.
