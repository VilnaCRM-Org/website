# Extending the website

Practical recipes for the three most common changes in this repo: adding a page,
adding a feature, and adding a locale. They complement [`AGENTS.md`](../AGENTS.md)
(the test-coverage contract) and the skills under [`.claude/skills/`](../.claude/skills).

## Configuration is typed and validated

Every environment variable the app reads goes through the Zod-validated module
[`src/config/env.ts`](../src/config/env.ts). Import `env` from there; never read
`process.env` directly under `src/` or `pages/` — an ESLint rule blocks it, and
`next build` fails fast on a missing or malformed value.

- Add a new variable to `clientEnvSchema` in `src/config/env.ts` (use a literal
  `process.env.NEXT_PUBLIC_X` reference so the static export inlines it).
- Document it in [`.env.example`](../.env.example) and set per-environment values
  in [`.env`](../.env) (dev) and [`.env.production`](../.env.production).
- Only `NEXT_PUBLIC_*` variables reach the browser bundle.

Why the module is shaped the way it is (issues #212, #328, #378):

- **Validation runs once at module load**, so an invalid or missing variable fails
  `next build` fast with a descriptive error instead of shipping a silent production
  no-op (a placeholder GA id, the dev GraphQL endpoint).
- **Every variable is referenced literally.** The site builds with `output: 'export'`,
  where Next.js inlines `NEXT_PUBLIC_*` values at build time only for literal
  `process.env.NEXT_PUBLIC_X` member expressions. Read one dynamically
  (`process.env[name]`) and the browser bundle inlines `undefined`.
- **The credential endpoints must be encrypted or loopback.** `NEXT_PUBLIC_GRAPHQL_API_URL`
  carries the sign-up password and `NEXT_PUBLIC_API_URL` is a Sentry trace-propagation
  target; both refuse a remote `http://` host (see
  [`docs/sign-up-hardening.md`](sign-up-hardening.md)). The check is one regular
  expression, `ENCRYPTED_OR_LOOPBACK`, rather than a `new URL()` inspection, so it is
  total: no try/catch for an unparseable value and no branch that can fall open. Anything
  it does not recognise — a remote `http://` host, a lookalike such as
  `http://localhost.example.com`, `http://user:pass@localhost` — is rejected, which is the
  safe direction. The host alternatives are anchored by an optional port and then a path,
  query, fragment or end of string, so `localhost.example.com` cannot pass as loopback
  while `http://localhost:4000?trace=1` still can.
- **The locale variables are required and non-empty**, so `<html lang>` never collapses
  to `''` (WCAG 3.1.1). The observability variables are optional: an empty value disables
  the feature (Sentry no-ops, Google Analytics is not rendered) rather than failing.
- **`NODE_ENV` stays out of the schema.** It is a Next/webpack build-time constant
  inlined into the export, not runtime configuration. `isProductionBuild()` centralises
  the read in this rule-exempt module so feature code stays free of `process.env`, and it
  is a function rather than a constant so callers observe the ambient value at call time.
- `src/config/site.ts` is the one other build-time identity value, and it is a committed
  constant on purpose — see [`docs/seo-surface.md`](seo-surface.md).
- `src/config/social-links.ts` is the single source of the social profile URLs, consumed
  by both the shared footer and the landing header so the two link sets cannot drift. It
  lives in `src/config` (a shared layer) because features import config, never the
  reverse (`no-shared-layers-to-features`).

## Styles live in a sibling `styles.ts`

Every component styles itself through MUI `sx` (or, for the offline document only, a
plain `style` attribute) and the values come from a co-located `styles.ts` that
default-exports an object of style fragments:

```tsx
import styles from './styles';

<Stack sx={styles.wrapper}>
<UiButton sx={[styles.button, styles.secondary]}>
<Box sx={styles.vector(imageSrc)}>
```

An object literal anywhere inside `sx` or `style` — bare, spread, inside an array, inside
a theme callback — fails `make lint-next` (`no-restricted-syntax`, ADR 0005). A style that
depends on a runtime value is a function in `styles.ts`, as `vector` above is; never
`Object.assign` onto a shared style object, which mutates it for every other render.
Pages cannot hold a `styles.ts` (a non-route module under `pages/` is not allowed), which
is one more reason a page composes a feature component rather than rendering markup.

## No comments in production source

`src/` and `pages/` carry no comments — line, block, JSDoc or JSX — and `make lint-next`
enforces it (`vilnacrm/no-comments`, ADR 0005). Specs, stories, `scripts/` and the root
configs keep theirs. Rationale goes, in order of preference, into an ADR, a design note
under `docs/`, the spec that pins the behaviour, or the commit message; component-level
notes that belong to one feature go in its README. The design notes that exist today:

- [`docs/seo-surface.md`](seo-surface.md) — titles, descriptions, canonical, social tags,
  structured data, the canonical origin, error documents.
- [`docs/offline-shell.md`](offline-shell.md) — the offline document and service-worker
  registration.
- [`docs/sign-up-hardening.md`](sign-up-hardening.md) — the #378 / #382 findings behind
  the form, the shared input primitives, link hardening and telemetry.
- [`docs/security-headers.md`](security-headers.md) — the edge header policy.
- The observability skill's
  [`web-vitals.md`](../.claude/skills/observability-instrumentation/reference/web-vitals.md)
  — the field-vitals forwarding gate.

## Composition at the routing root

`pages/_app.tsx` composes the landing `Header` into the shared `Layout` so that
`src/components/layout` stays feature-agnostic and never imports from `src/features`
(dependency-cruiser enforces the boundary; the routing root is the one place allowed to
cross it). The same file keeps two orchestrators to a single call each: service-worker
registration (see [`docs/offline-shell.md`](offline-shell.md)) and the `reportWebVitals`
named export Next.js calls for every metric, whose gate and PII-free payload live in
`src/lib/web-vitals`.

## TypeScript strictness idioms

`tsconfig.json` enables `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
(issue #334), and the integration layer collects coverage over the whole product source at
a global 100%. Three consequences recur:

- **An unreachable branch is a coverage failure.** Prefer a non-null assertion over a
  `?? ''` fallback when a guard has already made the value definite — `header.tsx` splits
  on `#` only after `includes('#')` proved a second segment exists, and the `og:locale`
  mapping strips a region with `replace` rather than `split(...)[0]` for the same reason.
- **Prefer concrete keys to `Record<string, T>`** for lookup tables (for example the
  breakpoint map in `notification/constants.ts`): an index signature widens every access
  to `T | undefined` and breaks the MUI `sx` typing.
- **Key optimized-image props off the optimizer's own return type.** The props
  `next-export-optimize-images` emits differ from `next/image`'s `ImageProps` under
  `exactOptionalPropertyTypes`, so `main-image.tsx` and `background-images.tsx` type them
  as `ReturnType<typeof getOptimizedImageProps>['props']` instead of the stricter
  `next/image` type.
- **Split a long union into two short ones** rather than letting it wrap: a union that
  fits on one line is wrapped differently by the repo's Prettier and Qlty's, so the split
  keeps the file stable under both (`ui-typography/types.ts`).

## Add a page

Pages live under `pages/` (Next.js pages router, static export).

1. Create `pages/<route>.tsx` exporting `withSeo(spec, Body)` from
   `src/components/seo/with-seo` — the spec carries the i18n keys of the title and
   description, the route path, the `noindex` / `siteSchema` flags and, for a page that
   exists in more than one language, its `alternates`.
2. Keep presentational UI in a feature (`src/features/<feature>`); `Body` is that
   feature's component, and the page file holds nothing else.
3. Use `useTranslation()` and per-feature i18n keys for copy — never hardcode
   user-facing English (see "Add a locale").
4. Regenerate the route manifest with `make generate-routes` (host-only; it runs
   `node scripts/ci/generate-route-manifest.mjs`) and commit the resulting
   [`config/routes.json`](../config/routes.json).
5. Add tests per [`AGENTS.md`](../AGENTS.md): a client render test and, when the
   route has behaviour, a Playwright e2e spec under `src/test/e2e`.

The static export is flat: `pages/contact.tsx` becomes `out/contact.html`, not
`out/contact/index.html`. Reaching it as `/contact` therefore depends on the CloudFront
edge function — [`scripts/cloudfront_routing.js`](../scripts/cloudfront_routing.js)
hard-404s any extensionless single-segment path that is not in its `ROUTE_MAP`, so a
new top-level route needs an entry there mapping `/contact` to `/contact.html` (and a
row in the edge spec, which is gated at 100% coverage). Match the flat filename the
export really writes, the way the nested `/en/docs/api` route maps to
`/en/docs/api.html` and `/en` — a directory index under `pages/`, but still a flat
`out/en.html` — maps to `/en.html`; a target the export never produces rewrites to a
missing S3 key. A root-level `.html` also needs its own `ALLOWED_FILES` entry: root files
are exact-matched rather than extension-matched, so `/en.html` is not covered by the `en`
directory entry that serves `/en/docs/api.html`.
A page that is only ever fetched with its `.html` extension — like `pages/offline.tsx`,
which the service worker serves from cache as `/offline.html` — needs no edge change,
but it still belongs in the manifest, which records it as a documented exemption.

The edge function is published by the infra repository from `main`, not by the website
deploy, so the new entry is live on the CDN only after a Terraform apply there — see
"How the edge functions reach CloudFront" in the
[deployment runbook](deployment-runbook.md). Keep additions to the tables themselves:
the file is capped at 10 KB by CloudFront, and its rationale lives in
[`edge-routing.md`](edge-routing.md).

Both surfaces are gated together by
[`src/test/unit/routes/route-manifest.test.ts`](../src/test/unit/routes/route-manifest.test.ts):
it re-runs the generator in `--check` mode and fails unless the committed
`config/routes.json` matches `pages/` byte for byte, then fails again if a manifest
route has no `ROUTE_MAP` entry (bar the recorded exemptions) or a `ROUTE_MAP` target is
not a path the manifest lists. Skipping step 4 reds the client unit suite.

## Add a feature

Features follow the bulletproof-react layout, enforced by dependency-cruiser
(`make lint-deps`).

1. Create a kebab-case directory `src/features/<feature>/`.
2. Use only the allowed folders (`feature-allowed-folders`): `components`, `api`,
   `hooks`, `helpers`, `i18n`, `types`, `constants`, plus the `index.ts` barrel.
3. Export the feature's public surface from `src/features/<feature>/index.ts`.
   Import a feature only through that barrel (`features-import-via-public-api`);
   never reach across features by deep path (`no-cross-feature-imports`).
4. Shared code lives in shared layers (`src/components`, `src/hooks`, `src/lib`,
   `src/config`, ...). Shared layers must not import features
   (`no-shared-layers-to-features`).
5. Run `make lint-deps` to verify the boundaries.

## Add a locale

Translations are per-feature JSON merged into a single bundle at build time.

1. Add `src/features/<feature>/i18n/<lang>.json` for every feature with copy, with
   exact key parity across languages (for example `en.json` and `uk.json`).
2. The build merges them into `pages/i18n/localization.json` via
   [`scripts/localizationGenerator.js`](../scripts/localizationGenerator.js). That
   file is generated and gitignored — never edit it by hand. The next.config
   webpack hook and the Jest `globalSetup` regenerate it.
3. Locale is a build-time input of the static export, and it is a function of the
   route alone. `NEXT_PUBLIC_MAIN_LANGUAGE` (validated in `src/config/env.ts`) is the
   language of every route that carries no locale prefix; `NEXT_PUBLIC_FALLBACK_LANGUAGE`
   is what i18next falls back to for a missing key. The English landing lives at `/en`
   (`pages/en/index.tsx`), and `src/config/locales.ts` is the single rule that maps a
   pathname to its language — see "Route-scoped locale" below.
4. Assert localized strings in tests through the `t()` helper, not hardcoded text.

### Route-scoped locale

Next's built-in i18n routing is unavailable under `output: 'export'`, so the locale
prefix is an ordinary directory under `pages/` and the language is derived from the
pathname at render time:

- `resolveRouteLocale(pathname)` in `src/config/locales.ts` returns `en` for `/en` and
  everything beneath it, `en` for `/swagger` (the OpenAPI reference it embeds is
  English-only, which used to be a `changeLanguage('en')` effect inside the swagger
  component and fought any route-level rule), and the main language for everything
  else. A trailing slash is ignored; case is not, because neither the export nor the
  edge handler folds case.
- `useRouteI18n()` in `src/hooks/use-route-i18n.ts` runs once at the routing root
  (`pages/_app.tsx`). It clones the global i18next instance with the route's language
  and hands the clone to `I18nextProvider`, so every `useTranslation()` in the tree —
  including the SSR pass that writes the exported HTML — renders in that language with
  no flash of the main language and no hydration mismatch. The clone shares the resource
  store, so nothing is loaded twice. It then syncs the **global** instance in an effect,
  because the form validators and `src/shared/clientErrorMessages.ts` call `t` from
  `i18next` directly and the Apollo link reads `i18n.language` per request; both only
  run after user interaction, so the effect is early enough. The sync is deliberately
  not done during render: `changeLanguage` notifies every mounted `useTranslation`
  subscriber, and doing that inside another component's render is the
  "cannot update a component while rendering a different component" warning.
- `pages/_document.tsx` derives `<html lang>` from the same function, through
  `__NEXT_DATA__.page`, so the document language, the rendered copy, `og:locale` and the
  hreflang alternates cannot disagree.
- Internal navigation must stay inside the current locale prefix. The landing header
  resolves the landing path with `landingPathOf(pathname)` for the logo link and for
  anchor navigation from a non-landing route (`/en/docs/api` → `/en#Contacts`, never
  `/#Contacts`), and `isLandingPath` treats both `/` and `/en` as "already on the
  landing", where an anchor click scrolls instead of navigating. The prefix, not the
  display language, decides: `/swagger` renders in English but its logo still leads to
  `/`, because no visitor chose a locale to get there.
- The two landings declare each other as `hreflang` alternates (`LANDING_ALTERNATES`),
  with `x-default` on the root; `docs/seo-surface.md` records why.

Adding a third locale means a new prefix in `src/config/locales.ts`, a new
`pages/<prefix>/index.tsx`, and the same route registrations a new page needs (manifest,
edge `ROUTE_MAP` and `ALLOWED_FILES`, the a11y route registry, the sitemap).
