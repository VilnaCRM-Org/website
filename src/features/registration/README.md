# Registration feature

A reserved feature slice for a dedicated registration flow.

## Status

Scaffold only. This slice currently holds no components, hooks, or public API — the tracked
`.gitignore` placeholder keeps the reserved `i18n/` directory in git while the feature is
unimplemented. Today the sign-up form lives in the `landing` slice
(`components/auth-section`); this slice is reserved for a standalone registration feature.
There is no barrel to import yet.

## Structure

- `i18n/` — reserved for localized copy (`en.json` / `uk.json`) once the feature exists.

## When you build this feature

Follow the bulletproof-react layout used by the `landing` and `swagger` slices: add an
`index.ts` barrel as the only public entry point, keep components under `components/`, and
place localized copy under `i18n/`. See [`agents.md`](../../../agents.md) and the
`architecture` skill for the import boundaries `make lint-deps` enforces.
