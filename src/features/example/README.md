# Example feature

A reserved feature slice kept as a naming/reference placeholder for the feature layout.

## Status

Scaffold only. This slice currently holds no components, hooks, or public API — the tracked
`.gitignore` placeholder keeps the reserved `i18n/` directory in git while the slice is
unimplemented. There is no barrel to import yet.

## Structure

- `i18n/` — reserved for localized copy (`en.json` / `uk.json`) once the slice is used.

## When you build this feature

Follow the bulletproof-react layout used by the `landing` and `swagger` slices: add an
`index.ts` barrel as the only public entry point, keep components under `components/`, and
place localized copy under `i18n/`. See [`agents.md`](../../../agents.md) and the
`architecture` skill for the import boundaries `make lint-deps` enforces.
