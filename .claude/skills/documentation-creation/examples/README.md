# Documentation Examples

Two worked examples — one per documentation class — that match how this repo is laid out.

## Feature README (markdownlint-scanned)

Use for contributor-facing guidance on a single feature. Place it at the feature root:

```text
src/features/registration/README.md
```

Cover the purpose, the entry barrel (`src/features/registration/index.ts`), the
`components/` and `api/` folders, the `i18n/en.json` + `i18n/uk.json` translations, and a
`bash`-fenced verification block. Because this file is markdownlint-scanned, keep lines
≤100 chars and use only `bash` code fences. Existing features to mirror in style:
`landing`, `swagger`, `registration`, `documentation`.

## Skill Reference Doc (skill-doc class)

Use for one focused slice of reusable agent guidance, linked from the owning `SKILL.md`:

```text
.claude/skills/<skill>/reference/<topic>.md
```

Keep it to a single topic — for example, how to mock the Apollo GraphQL layer with
Mockoon for `make test-e2e`, or how i18next `t()` strings are asserted in tests. Here
`ts`/`tsx`/`json` fences are allowed but are prettier-formatted, so every embedded snippet
must be valid and clean. Link back to the parent `SKILL.md` so the two stay discoverable
together.
