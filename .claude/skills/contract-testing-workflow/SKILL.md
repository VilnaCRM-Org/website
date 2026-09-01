---
name: contract-testing-workflow
description: >-
  Use when touching the pinned user-service contracts — bumping
  USER_SERVICE_VERSION, editing a gql document under src/features, or fixing a
  red `make lint-contracts` / contract-testing.yml run. Covers the single
  upstream pin, the committed artifacts under contracts/, the spectral baseline
  ratchet, and the drift check. Triggers: "lint-contracts failed", "new spectral
  finding", "spectral finding is gone", "artifacts differ from the pinned tag",
  "bump the user-service version", "update-contracts", "Cannot query field", and
  edits to .env's USER_SERVICE_VERSION.
---

# Contract Testing Workflow

Every user-service contract this repo consumes comes from **one** pin —
`USER_SERVICE_VERSION` in [`.env`](../../../.env). It feeds the GraphQL schema
behind the Apollo mock, the OpenAPI spec behind the swagger page, and the
Mockoon fixture behind e2e. The fetched artifacts are committed under
[`contracts/`](../../../contracts) so `docker build` and `make start` never depend
on `raw.githubusercontent.com` being reachable.

```bash
make lint-contracts     # the gate (needs network — see below)
make lint-api-versions  # the pin invariant (hermetic; part of `make lint`)
make test-contract      # the Mockoon mock still matches that contract (#350)
make lint-openapi       # advisory: is the pin itself behind upstream? (#350)
make update-contracts   # re-fetch after bumping the pin, then commit the diff
```

`lint-contracts` sits outside `make lint` on purpose: its drift check re-fetches
the pinned tag, and `static-testing.yml` is otherwise hermetic. Its CI home is
`contract-testing.yml`. To check everything except drift without network:

```bash
node scripts/contracts/lint-contracts.mjs --offline
```

## The pin invariant (`make lint-api-versions`, issue #381)

The two contracts used to be pinned by **two** variables that had drifted two
releases apart: `/swagger` documented user-service v2.6.0 while the GraphQL
contract the product builds against sat on v2.4.1 (OWASP API9:2023). The single
pin closes that, and this check keeps it closed. It is hermetic, so unlike
`lint-contracts` it runs inside `make lint` on every PR. It fails when:

- the pin is missing or is not an exact `vMAJOR.MINOR.PATCH` tag;
- a **second** user-service version variable exists (that was the original shape);
- a consumer URL stops interpolating `${USER_SERVICE_VERSION}`, or points at a
  different repository or ref;
- a root config file (env files, Dockerfiles, compose files) hardcodes a
  user-service tag that is not the pin;
- `.env` and `.env.example` disagree — a stale example reintroduces the drift on
  the next clone.

When bumping the pin, change `USER_SERVICE_VERSION` in **both** `.env` and
`.env.example`, then run `make update-contracts`. `/swagger` renders the pin as
the document version (`info.version`) and exposes it as
`info['x-user-service-version']`; that stamping lives in
`scripts/patchSwaggerServer.mjs`.

## What the gate checks

| Layer     | What it does                                                                                                   | Fails when                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| GraphQL   | Parses every `gql` document under `src/features` and validates it against the committed schema with graphql-js | An operation references a field or input the pinned schema does not have       |
| OpenAPI   | Runs the **unmodified** `spectral:oas` ruleset over the committed spec and diffs findings against the baseline | A finding appears that is not baselined, **or** a baselined finding disappears |
| Integrity | Checks the pin is an immutable ref and each committed artifact against `contracts/user-service/checksums.json` | The pin is branch-shaped, an artifact was edited without refreshing its digest |
| Drift     | Re-fetches both artifacts from the pinned tag and compares                                                     | A committed artifact no longer matches the tag                                 |

The integrity layer (#376) is the hermetic half: it needs no network, so a
tampered artifact fails on every lane — including an offline run and a
`raw.githubusercontent.com` outage that skips the drift check. The digest is
taken over the **parsed** OpenAPI document and the **verbatim** GraphQL SDL, so
Prettier reformatting the committed JSON never invalidates it, and one upstream
YAML document and its committed JSON artifact hash to the same value.

Only `src/features` is validated — those are the client's own operations. The
server suite is not scanned for `gql` documents: `src/test/apollo-server` builds
its servers from the committed schema (via `mock-server.ts`) or, in the legacy
`server.test.ts`, from a deliberate inline test double.

## The baseline is a ratchet, not a suppression list

`contracts/spectral-baseline.json` records findings that are **real defects in
the upstream spec**, which this repo does not control. No spectral rule is
disabled to accommodate them.

It fails in **both** directions, and the second one is the point:

- a **new** finding fails → a bump cannot introduce a regression unnoticed;
- a **baselined finding that disappears** fails → when upstream fixes something,
  the baseline must shrink in a reviewable commit rather than quietly rot.

Never hand-edit the baseline to make a run pass. Regenerate it only through
`make update-contracts`, and only as part of a deliberate pin bump.

**Never add a baseline entry for a defect in code this repo owns.** The baseline
exists solely for vendored upstream artifacts. Fix our own code instead.

## Repair sequences

**`new spectral finding: <rule> @ <path>`** — the upstream spec regressed, or the
pin moved. If you just bumped `USER_SERVICE_VERSION`, decide whether the new
defect is acceptable: if yes, `make update-contracts` records it and the diff
shows a reviewer exactly what got worse. If you did not bump, someone edited a
committed artifact by hand — restore it with `make update-contracts`.

**`spectral finding is gone: <rule> @ <path>`** — upstream fixed a defect. Run
`make update-contracts` so the baseline shrinks, and mention the improvement in
the commit message.

**`<file> differs from the pinned tag`** — a committed artifact drifted. Almost
always because someone edited `contracts/` directly, or bumped the pin without
refreshing. `make update-contracts` is the fix. Note that the OpenAPI comparison
is semantic (parsed), not byte-wise, so Prettier reformatting alone never trips
it.

**`<file>: sha256 … does not match the recorded …`** — a committed artifact was
edited without refreshing its digest. `make update-contracts` re-fetches and
re-records both; if the edit was deliberate, the digest change lands in the same
reviewable commit. Never hand-edit `checksums.json` to match a modified artifact —
that is the one move the gate exists to catch.

**`USER_SERVICE_VERSION="…" is not an immutable ref`** — the pin was repointed at
something that floats (`main`, `HEAD`, a short SHA). Use a `vMAJOR.MINOR.PATCH`
tag or a full 40-character commit SHA, so the committed digests keep meaning
something.

**`Upstream spec carries HTML markup at $…`** — `make update-contracts` refused to
vendor a spec whose `description`/`title`/`summary` contains a real HTML element.
Those fields are rendered as Markdown by swagger-ui on the public `/swagger` page,
so this is a deliberate stop-and-read, not a formatting nit: confirm upstream
meant it before doing anything else. The check matches HTML **element names**, not
"anything in angle brackets", so ordinary prose like `Array<User>` or
`maxLength < 10` passes.

**`Cannot query field "x" on type "Y"`** — a client operation and the pinned
schema disagree. The schema is authoritative: fix the operation (see
[`frontend-component-development`](../frontend-component-development/SKILL.md)),
or bump the pin if the field genuinely landed upstream.

## Bumping the pin

1. Edit `USER_SERVICE_VERSION` in `.env` — nowhere else. It must stay an
   immutable ref: a `vMAJOR.MINOR.PATCH` tag or a full 40-character commit SHA.
2. `make update-contracts` — re-fetches both artifacts, re-records their digests
   in `checksums.json`, and refreshes the spectral baseline.
3. `make lint-contracts` — expect green.
4. Commit `contracts/` together with `.env`. That diff **is** the record of what
   changed upstream; keep it in its own commit so it stays reviewable. The
   refreshed digests belong in the same commit — they are what makes the artifact
   diff attestable rather than merely present.

Mockoon serves the committed `contracts/user-service/openapi.json` directly (the
image COPYs it, no build-time download), so a pin bump changes what e2e mocks
only once you refresh that artifact. Check that every endpoint the app calls
still exists in the new spec before assuming a red e2e run is unrelated.

## Normalization at ingestion

`scripts/fetchSwaggerSchema.mjs` strips the invalid `maxLength: null` and
`format: null` keywords while converting the spec — and only those. Both are
invalid OpenAPI 3 (maxLength must be a non-negative integer, format a string) and
make spectral abort rather than report. The strip is scoped to those keys on
purpose: a blanket "drop every null" would also delete legitimate OpenAPI 3.1
metadata (`default: null`, `example: null`) and, because the drift check
normalizes both sides identically, that deletion would pass silently while
mutating the committed contract. This is a documented transformation at the
single point the document enters the repo — not a way to hide findings. If you
add another normalization, say why in the code and expect to justify it in review.

The same entry point **rejects** (rather than rewrites) HTML markup in
`description`, `title` and `summary`, and a non-`http(s)` `externalDocs.url`
(#376 F1). Rewriting was the obvious alternative and is unsafe: no tag regex can
tell `<b and c>` from prose containing `<`, so a stripper silently mutates
legitimate upstream text. Failing closed keeps the committed contract provably
markup-free without ever mangling it.

## The `servers[]` rebuild

`scripts/patchSwaggerServer.mjs` sets `servers` to exactly one build-controlled
entry rather than overwriting `servers[0]` (#376 F2). Extra entries used to
survive into `public/swagger-schema.json` and stayed selectable in the swagger
"Try it out" server dropdown, so an injected `servers[1]` was one click from
receiving a token typed into the live API console. The script exports its
functions and only patches when invoked as a script, so
`src/test/unit/swagger/patch-swagger.test.ts` exercises the real code — an
earlier version of that spec re-declared its own copies and kept passing while
the implementation drifted.

## The mock is gated too (#350)

`lint-contracts` proves the committed artifacts match the pin. It says nothing
about whether the **mock built from them** still behaves like the contract, and
the whole Playwright suite runs against that mock.

`make test-contract` closes that gap. The `TEST_ENV=contract` layer
(`tests/contract/**/*.contract.test.ts`) boots Mockoon in-process from
`contracts/user-service/openapi.json` and asserts, per documented operation:
the status served is documented, the body's media type is declared, the body
validates against that media type's schema, and the body carries **no property
the schema never declares**.

That last rule is stricter than OpenAPI's default on purpose, and it is
load-bearing: upstream puts `required` on the _array_ schema of `GET /api/users`
instead of on its `items`, so ajv alone accepts a response with every property
renamed. Do not "fix" a red run by dropping it.

Reading a red run:

- **`[undeclared-property]`** — the mock serves a field the contract does not
  declare. The contract is authoritative: refresh it, or fix the mock.
- **`[schema-violation]`** — Mockoon cannot generate a value the schema accepts.
  Usually a pin bump that added a constraint; read the new schema.
- **`[undocumented-status]`** — Mockoon's first-declared response moved, i.e. a
  response was reordered or removed upstream.
- **`[undocumented-media-type]`** — the status no longer declares the media type
  the mock serves.
- **`@mockoon/commons… matches the CLI…`** — the two Mockoon pins drifted. Move
  `Mockoon.Dockerfile` and `package.json` together, in the same commit.
- **`unsupportedResponseConstructs`** — upstream introduced a `$ref` or a
  composed schema (`allOf`, `oneOf`, `prefixItems`, …). Extend the parity rules;
  never extend the exemption list.

Seed a defect only into a **temporary copy** of the contract, never into the
committed file — `lint-contracts` guards it, and
`parity-detects-drift.contract.test.ts` already does this properly.

`make lint-openapi` answers the other question: is the pin itself behind? It
runs a pinned, SHA256-verified `oasdiff` against the newest upstream **release**
and is **advisory** — the nightly `openapi-drift.yml` files an `api-contract`
tracking issue rather than failing a check, because upstream moving on is not a
PR author's fault. Acting on that issue is a normal pin bump (see above).

## Related guides

- [`quality-standards`](../quality-standards/SKILL.md) — what each gate enforces.
- [`ci-workflow`](../ci-workflow/SKILL.md) — which suites to run before a PR.
- [`architecture`](../architecture/SKILL.md) — where a feature's `api/` code lives.
