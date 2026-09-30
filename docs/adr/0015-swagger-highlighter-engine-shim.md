# ADR 0015: /swagger highlights through a lowlight 3 shim on highlight.js 11

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** website maintainers
- **Related:** issue #379 (finding F3); ADR 0005;
  [`docs/swagger-highlighter-surface.md`](../swagger-highlighter-surface.md),
  [`src/features/swagger/helpers/lowlight-compat.ts`](../../src/features/swagger/helpers/lowlight-compat.ts),
  [`next.config.js`](../../next.config.js)

## Context

`/swagger` renders every example body and request snippet through `swagger-ui-react`,
which highlights them with `react-syntax-highlighter`'s light build. That build imports
`lowlight/lib/core` — lowlight 1.x — and lowlight 1 pins `highlight.js ~10.7.0`. The
highlight.js project marks 10.7.x "No longer supported" and fixes only 11.x, so the page
served an end-of-life engine to every visitor. No release in range moves it: the newest
`react-syntax-highlighter` (16.1.1) still declares `highlight.js ^10.4.1` and
`lowlight ^1.17.0`, and the newest `swagger-ui-react` (5.33.0) still declares
`react-syntax-highlighter ^16.0.0`.

An override of highlight.js alone does not work: lowlight 1 drives highlight.js through
the 10.x emitter (`addKeyword`, `openNode`), so 11.x under it fails at runtime. The
options that remained were to turn highlighting off (an alias that stubs the light
build, with `syntaxHighlight.activated: false`), to fork or replace swagger-ui's
highlighter component, or to replace only the module that speaks the old API. The first
two change what the page shows; the third does not, because the light build touches
lowlight through four functions and one return shape.

## Decision

We serve `lowlight/lib/core` from a shim over lowlight 3 and override the tree onto
lowlight 3.3.0 and highlight.js 11.12.0.

- `src/features/swagger/helpers/lowlight-compat.ts` wraps one `createLowlight()`
  instance and exports lowlight 1's `registerLanguage`, `listLanguages`, `highlight` and
  `highlightAuto`, returning `{ value, language, relevance }` with hast children as
  `value` and `language: null` when auto-detection finds nothing — the value the
  renderer reads as "plain text". It renames no highlight.js 11 scope: the renderer
  merges the style of every class a token carries, and the prefixed class is always one
  of them.
- `next.config.js` aliases the exact request `lowlight/lib/core` to the shim, for the
  webpack build (`resolve.alias`) and for `next dev` (`turbopack.resolveAlias`).
- `package.json` overrides `highlight.js` and `lowlight` to 11.12.0 and 3.3.0 and lists
  both as dependencies. `bun.lock` keeps one entry of each; lowlight 1, highlight.js 10,
  and `fault` and `format` leave the tree.
- `src/test/unit/swagger/lowlight-compat.test.ts` pins the contract and the
  highlight.js major; `tests/integration/coverage/swagger/lowlight-compat.integration.test.ts`
  runs the seven grammars swagger-ui registers through it. `jest.config.ts` and
  `jest.mutation.config.ts` let babel-jest transform `lowlight` and `devlop`, which ship
  only ESM.

Out of scope: bumping `swagger-ui-react`, the agate theme's own contrast (#423), and the
`prismjs`/`refractor` half of `react-syntax-highlighter`, which never ships.

## Consequences

### What this buys

The page runs a supported highlighter without losing highlighting, the renderer or the
theme. Three token groups change colour, each to an agate colour already on the page
that clears 4.5:1 on the code background. The lockfile loses three packages, and a
future highlight.js 11 fix reaches the page as an ordinary in-range bump.

### What this costs

The site now owns a compatibility layer inside a third-party component. It is written
against `react-syntax-highlighter`'s current use of lowlight — the `lowlight/lib/core`
path, the four members, `.value` read as hast children, `language === null` as the
plain-text signal — and no upstream test guards that contract. A
`react-syntax-highlighter` or `swagger-ui-react` bump must re-read `dist/esm/light.js`,
`highlight.js` and `checkForListedLanguage.js` before it lands; the swagger e2e journeys
that read the rendered request and response blocks are the only runtime check. Both
overrides force packages across their consumers' declared majors, which is invisible to
a reader of `react-syntax-highlighter`'s manifest, and the highlight.js override sits one
minor past lowlight 3.3.0's `~11.11.0`. The alias has to be kept in two bundler configs.
Anything that reaches `lowlight/lib/core` without the alias fails to resolve rather than
degrading, which is deliberate: lowlight 3 exports only its root.

### What would reverse it

A `react-syntax-highlighter` release that depends on lowlight 3 or later and calls it
itself, or a `swagger-ui-react` release that drops `react-syntax-highlighter`. Either
retires the alias, the shim and its specs, and both overrides together. A change to the
light build's use of lowlight that the shim cannot follow would reopen the choice
between turning highlighting off and replacing the renderer.
