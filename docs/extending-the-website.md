# Extending the website

Practical recipes for the three most common changes in this repo: adding a page,
adding a feature, and adding a locale. They complement [`agents.md`](../agents.md)
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

## Add a page

Pages live under `pages/` (Next.js pages router, static export).

1. Create `pages/<route>.tsx` exporting a default React component.
2. Keep presentational UI in a feature (`src/features/<feature>`); the page file
   should mostly compose feature components.
3. Use `useTranslation()` and per-feature i18n keys for copy — never hardcode
   user-facing English (see "Add a locale").
4. Add tests per [`agents.md`](../agents.md): a client render test and, when the
   route has behaviour, a Playwright e2e spec under `src/test/e2e`.

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
3. Locale is a build-time input of the static export. Set the active and fallback
   languages with `NEXT_PUBLIC_MAIN_LANGUAGE` and `NEXT_PUBLIC_FALLBACK_LANGUAGE`
   (validated in `src/config/env.ts`); they gate `<html lang>` and i18next.
4. Assert localized strings in tests through the `t()` helper, not hardcoded text.
