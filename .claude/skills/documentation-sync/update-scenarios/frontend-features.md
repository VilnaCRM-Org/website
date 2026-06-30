# Frontend Features

## New or changed feature

Update the feature's local README, or the closest owning doc, when a
`src/features/<feature>` change adds:

- A new route or navigation behavior (the `pages/` entry that wires the feature
  into the Next.js pages router).
- New i18n or validation copy (`src/features/<feature>/i18n/{en,uk}.json`).
- A new Apollo Client query or mutation, or a GraphQL schema / resolver
  interaction.
- A new public `index.ts` barrel export or a new shared-layer dependency
  (`src/components`, `src/hooks`, `src/lib`, `src/providers`, `src/shared`,
  `src/utils`, `src/config`, `src/types`).
- New test setup requirements.

## Verification to document

Mention the smallest useful commands:

```bash
make test-unit-client
make test-e2e
make test-visual
make lint
```
