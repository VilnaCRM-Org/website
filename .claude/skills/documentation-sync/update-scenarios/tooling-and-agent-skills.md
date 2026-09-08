# Tooling and Agent Skills

## When tooling changes

Update:

- Makefile help text — the `## ...` description after the changed target.
- `CLAUDE.md` command, quality, or testing sections.
- `AGENTS.md` workflow guidance when the change affects the test-coverage policy
  or Definition of Done.
- `README.md` or `CONTRIBUTING.md` when the change is contributor-facing.
- The relevant `.claude/skills/<skill>/SKILL.md` and its support files.

Concrete example: when a new Makefile target lands — such as the
complexity/metrics gate from issue #224 (rust-code-analysis) — add it to the
Makefile help text, document it in `CLAUDE.md`, and update the
complexity-management skill, pointing thresholds at `config/metrics-policy.json`
rather than hardcoding numbers in prose.

## When skill layout changes

Keep these surfaces distinct:

- `.claude/skills/` — website implementation skills (this tree).
- `_bmad/`, `bmalph/`, `.claude/commands/` — the bmalph/BMAD planning surface.
  It is generated and local-only; reference it, never duplicate it into a skill.

After editing skill files, run `make format` (Prettier formats the skill
markdown). Run `make lint-md` only when you also touched a markdownlint-scanned
doc such as `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, or
`cursor-project-guide.md`:

```bash
make format
make lint-md
```
