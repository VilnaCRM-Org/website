# Frontend Refactoring Strategies

Each pattern below maps to a hard metric in
`config/metrics-policy.json`. Pick the
pattern that targets the breached metric reported by `make lint-metrics`.

## 1. Extract Helper

Target: cyclomatic, cognitive, and function size (LLOC / PLOC / SLOC).

Move dense boolean or data-shaping logic out of JSX and hooks into a pure,
testable function:

```ts
export function shouldShowRetry(status: SubmitStatus, attempts: number): boolean {
  return status === 'failed' && attempts < MAX_RETRIES;
}
```

Test the helper directly when it encodes business behavior, and assert the
user-visible result in the component test that consumes it.

## 2. Lookup Map

Target: cyclomatic and cognitive.

Replace an `if`/`switch` over a finite union with a typed `Record`:

```ts
const titleKeyByStatus: Record<SubmitStatus, string> = {
  idle: 'auth.idle',
  loading: 'auth.loading',
  failed: 'auth.failed',
  success: 'auth.success',
};
```

Render the resolved i18n key with `t(titleKeyByStatus[status])`. Hoist the map to
module scope so it is not rebuilt on every render.

## 3. Typed Options Object

Target: NARGS (the per-function argument budget is small — see the policy).

Collapse several positional arguments into one typed parameter object:

```ts
type RenderCardArgs = {
  title: string;
  subtitle: string;
  iconAlt: string;
  isActive: boolean;
};

function renderCard({ title, subtitle, iconAlt, isActive }: RenderCardArgs) {
  // build the card from the destructured options
}
```

This also makes call sites self-documenting and order-independent.

## 4. Split File

Target: file NOM / LLOC / PLOC / SLOC and maintainability index (MI).

Split a large component into a container and a presentational view, keeping data
fetching, mutations, and form state in the container:

```tsx
function AuthForm() {
  const form = useAuthForm();
  return <AuthFormView {...form} />;
}
```

For an oversized `styles.ts`, split it by concern into focused modules instead of
one file — for example a barrel that re-exports layout, responsive, and shape
styles:

```text
src/features/<feature>/components/<Component>/
  styles.ts          # re-exports the modules below
  styles.layout.ts   # grid, spacing, container rules
  styles.screens.ts  # responsive / breakpoint variants
  styles.shapes.ts   # decorative shape styles
```

Split by responsibility, not by line count. Do not split a component if the
resulting files still share the same state and side effects.

## 5. Consolidate Exits

Target: NEXITS (the per-function exit budget is small — see the policy).

Replace scattered early returns with a single resolved return — typically a lookup
map with a `??` fallback, as below:

```ts
function resolveLabel(status: SubmitStatus): string {
  return titleKeyByStatus[status] ?? 'auth.idle';
}
```

## 6. Reduce Style File Weight

When a styles module trips file budgets:

- Reuse identical `sx` / style objects instead of repeating them.
- Extract repeated media queries and breakpoint values into shared constants.
- Move static style objects to module scope so they are stable across renders.

## 7. Avoid False Refactors

Passing the gate is a floor, not the goal. Prefer readable named helpers over
arbitrary file slicing. If a split makes the code harder to follow, choose a
different responsibility boundary.
