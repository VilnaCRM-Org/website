# Documentation feature

A reserved feature slice for VilnaCRM product documentation.

## Status

Scaffold only. This slice currently holds no components, hooks, or public API — the tracked
`.gitignore` placeholders keep the reserved directory (and its `i18n/` folder) in git while
the feature is unimplemented. There is no barrel to import yet.

## Structure

- `i18n/` — reserved for localized copy (`en.json` / `uk.json`) once the feature exists.

## When you build this feature

Follow the bulletproof-react layout used by the `landing` and `swagger` slices: add an
`index.ts` barrel as the only public entry point, keep components under `components/`, and
place localized copy under `i18n/`. See [`agents.md`](../../../agents.md) and the
`architecture` skill for the import boundaries `make lint-deps` enforces.
