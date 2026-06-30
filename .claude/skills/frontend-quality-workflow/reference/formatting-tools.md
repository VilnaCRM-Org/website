# Formatting Tools

## Make Target

```bash
make format
```

`make format` is the only formatting entry point on this repo. It runs **Prettier**
(there is no `qlty`, `jscpd`, or separate `fmt-prettier` / `fmt-qlty` target here) across
the repo's source, style, JSON, and Markdown files and writes changes in place:

```bash
prettier "**/*.{js,jsx,ts,tsx,json,css,scss,md}" --write --ignore-path .prettierignore
```

Run it after the last edit and before any lint gate, so the read-only gates validate
already-formatted code. By default the target executes inside the dev container; prefix
`CI=1` to run Prettier directly on the host without Docker:

```bash
CI=1 make format
```

## Prettier Configuration

The rules in `.prettierrc` are the source of truth — do not pass ad-hoc flags or add
`prettier-ignore`:

- `printWidth: 100`
- `singleQuote: true`
- `semi: true`
- `trailingComma: 'es5'`
- `tabWidth: 2`, `useTabs: false`
- `arrowParens: 'avoid'`
- `bracketSpacing: true`
- `endOfLine: 'lf'`

`proseWrap` is left at its default (`preserve`), so Prettier does not re-wrap Markdown
prose — keep lines readable by hand.

## Markdown And Embedded Code

Prettier formats committed Markdown, including code fences it can parse. That includes the
`.claude/skills/**` docs (which markdownlint skips because the dot-directory is outside its
`**/*.md` glob). Practical rules:

- Keep embedded `ts`, `tsx`, and `json` fences valid and Prettier-clean, or Prettier will
  rewrite them and produce a diff.
- Use a `text` fence for partial or pseudo snippets that would not parse.
- `bash` fences are left untouched by Prettier, so shell commands are safe as written.
  The bash-only fence restriction (markdownlint MD040) applies only to markdownlint-scanned
  top-level docs (README.md, CONTRIBUTING.md, agents.md, cursor-project-guide.md); the
  `.claude/skills/**` tree and `CLAUDE.md` are not scanned, so `ts`/`tsx`/`json`/`text`
  fences are allowed here.

## Do Not

- Do not hand-format to "beat" Prettier — re-run `make format` and accept its output.
- Do not introduce a second formatter or a `qlty` config; the repo standard is Prettier
  via `make format`.
