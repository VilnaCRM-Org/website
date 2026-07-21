# Documentation Sync — Workflow Checklist

1. Identify the user- or contributor-visible behavior that changed.
2. Search for existing mentions before editing:

   ```bash
   rg "make test-e2e" --glob '!node_modules'
   ```

3. Update the closest owning doc first (the feature-local README, then root
   docs).
4. Touch `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, or
   `.claude/skills` only when the change is cross-cutting.
5. Run `make format`, then `make lint-md`.
6. Run `make lint` when docs changed alongside code.

`make format` is Prettier only. `make lint-md` covers the markdownlint-scanned
docs; `.claude/skills/**` and `CLAUDE.md` are excluded from that scan, so rely on
`make format` to keep them clean.
