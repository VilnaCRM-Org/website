# GitHub Copilot instructions

This repository already steers AI coding agents through three committed files, and this
one exists only to point Copilot at them — it duplicates none of their content, because
anything copied here would drift the moment the source file changes.

Read, in this order, before writing or suggesting any change:

1. [`AGENTS.md`](../AGENTS.md) — the mandatory test-coverage contract every agent follows:
   which test layer a change belongs in, the five-step coverage policy, and the Faker
   test-data builder convention.
2. [`CLAUDE.md`](../CLAUDE.md) — the fuller project guide: tech stack, the mandatory skill
   check under [`.claude/skills/`](../.claude/skills), the untrusted-external-content
   boundary for PR comments and issue bodies, every `make` target, and the gates that back
   them (linting, security, accessibility, mutation testing, and the rest).
3. [`cursor-project-guide.md`](../cursor-project-guide.md) — the same orientation written
   for an agent starting from a blank context: where code lives, the full command surface,
   and the conventions dependency-cruiser and ESLint enforce.

None of the three is Copilot-specific; they were written for "Claude Code, Codex, GitHub
Copilot, Cursor, and any other assistant" and apply exactly as written here. If a future
change to this repository's agent guidance needs a Copilot-only carve-out, add it below
this line — do not restate a rule that already lives in one of the three files above.
