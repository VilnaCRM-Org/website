# Documentation Verification Checklist

Clear every item before committing a doc. Items are grounded in the live website gates,
not generic Markdown advice.

## Facts And Commands

- [ ] Every referenced path exists in the repo, or is clearly flagged as a proposed new
      file.
- [ ] Every command is a real `Makefile` target (no raw `bun`/`next`/`jest` calls that
      bypass the target surface).
- [ ] No absent tooling is mentioned (no Bun, Zustand, Redux, tsyringe/DI, React Router,
      jscpd, `make fmt-qlty`, or `make lint-dup`).
- [ ] Feature claims match `.dependency-cruiser.js`: kebab-case feature names, public-API
      barrel imports, and only the allowed feature-root folders.

## Markdown Class Rules

- [ ] For markdownlint-scanned docs (feature READMEs, most repo `.md`): fences use only
      the `bash` language (MD040), lines are ≤100 chars (MD013), exactly one H1 (MD025),
      and blank lines wrap every heading, list, and fence (MD022/MD031/MD032).
- [ ] For skill docs under `.claude/skills/**`: any embedded `ts`/`tsx`/`json` block is
      valid and prettier-clean per `.prettierrc`; partial snippets use a `text` fence.
- [ ] Files end with exactly one trailing newline, use LF endings, and have no trailing
      whitespace.

## Workflow And Cross-References

- [ ] Workflow docs run `make format` before `make lint`, and name the test layers a
      code change touches (`make test-unit-client`, `make test-e2e`, `make test-visual`).
- [ ] `make lint-md` passes for any scanned doc; `make format` leaves skill docs
      unchanged on a re-run.
- [ ] The doc links to `agents.md` for the coverage policy instead of restating it.
- [ ] BMAD/planning references point at `.claude/commands/` and `_bmad/` (local-only) and
      are NOT duplicated into `.claude/skills/`.
- [ ] No linter is disabled or suppressed (no `eslint-disable`, `prettier-ignore`,
      markdownlint disable comments, or lowered thresholds).
