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
`USER_SERVICE_VERSION` in [`.env`](../../.env). It feeds the GraphQL schema
behind the Apollo mock, the OpenAPI spec behind the swagger page, and the
Mockoon fixture behind e2e. The fetched artifacts are committed under
[`contracts/`](../../contracts) so `docker build` and `make start` never depend
on `raw.githubusercontent.com` being reachable.

```bash
make lint-contracts    # the gate (needs network — see below)
make update-contracts  # re-fetch after bumping the pin, then commit the diff
```

`lint-contracts` sits outside `make lint` on purpose: its drift check re-fetches
the pinned tag, and `static-testing.yml` is otherwise hermetic. Its CI home is
`contract-testing.yml`. To check everything except drift without network:

```bash
node scripts/contracts/lint-contracts.mjs --offline
```

## What the gate checks

| Layer   | What it does                                                                                                   | Fails when                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| GraphQL | Parses every `gql` document under `src/features` and validates it against the committed schema with graphql-js | An operation references a field or input the pinned schema does not have       |
| OpenAPI | Runs the **unmodified** `spectral:oas` ruleset over the committed spec and diffs findings against the baseline | A finding appears that is not baselined, **or** a baselined finding disappears |
| Drift   | Re-fetches both artifacts from the pinned tag and compares                                                     | A committed artifact no longer matches the tag                                 |

Only `src/features` is validated. `src/test/apollo-server` defines its own inline
SDL as a deliberate test double — validating it against upstream would compare
the mock to the thing it stands in for.

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

**`Cannot query field "x" on type "Y"`** — a client operation and the pinned
schema disagree. The schema is authoritative: fix the operation (see
[`frontend-component-development`](../frontend-component-development/SKILL.md)),
or bump the pin if the field genuinely landed upstream.

## Bumping the pin

1. Edit `USER_SERVICE_VERSION` in `.env` — nowhere else.
2. `make update-contracts` — re-fetches both artifacts and refreshes the baseline.
3. `make lint-contracts` — expect green.
4. Commit `contracts/` together with `.env`. That diff **is** the record of what
   changed upstream; keep it in its own commit so it stays reviewable.

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

## Related guides

- [`quality-standards`](../quality-standards/SKILL.md) — what each gate enforces.
- [`ci-workflow`](../ci-workflow/SKILL.md) — which suites to run before a PR.
- [`architecture`](../architecture/SKILL.md) — where a feature's `api/` code lives.
