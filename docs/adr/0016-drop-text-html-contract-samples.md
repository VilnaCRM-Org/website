# ADR 0016: Drop text/html samples from the vendored contract before the markup scan

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** repository maintainer (approved on issue #446)
- **Related:** issue #446; issue #376 (F1, the markup guard)

## Context

`scripts/fetchSwaggerSchema.mjs` is the one place the user-service OpenAPI document
enters this repository. Since #376 F1 `assertNoMarkup` refuses the refresh when any
string or key in the document holds an HTML element, a comment or a Markdown image,
because swagger-ui renders large parts of the document as Markdown on the public
`/swagger` page. It checks every string on purpose: three earlier attempts to carve out
"payload" positions by key name each closed one bypass and opened another, since
OpenAPI reuses `example`, `default` and `summary` as keywords in some positions and as
user-chosen names in others.

user-service `v0.8.0` (upstream restarted its tag numbering at `v0.1.0` after
`v2.8.0`) documents `GET /api/oauth/authorize` with a `200` response whose only media
type is `text/html`, and whose `example` is a complete HTML document. That is a correct
sample of an HTML response — and it is byte-for-byte indistinguishable from injected
markup, so `make update-contracts` refused `v0.8.0` and the pin stayed on `v2.6.0`.

The options were: stay on `v2.6.0` indefinitely; exempt the position from the scan; or
remove the sample before the scan.

## Decision

We drop the `example` and `examples` keys of a `text/html` Media Type Object inside
`normalizeSpec`, before `assertNoMarkup` runs, and change nothing else.

- **Which media types.** The media type key is compared the way RFC 9110 compares
  one: the part before any `;` parameter, trimmed, case-insensitively, must equal
  `text/html`. `text/html; charset=utf-8` and `TEXT/HTML` qualify; `text/*`, `*/*`,
  `application/xhtml+xml` and `text/htmlx` do not.
- **Which positions.** Only content maps reached by position: the `content` of a
  Response, a Request Body or a Parameter under `paths` (operation and path-level
  parameters) or under `components.responses`, `components.requestBodies` and
  `components.parameters`. A key merely named `content` — a schema property, for
  example — is never touched. Headers, callbacks and webhooks are out of scope and
  keep failing closed.
- **Which keys.** Only `example` and `examples`. The media type's `schema` (including
  a `schema.example`) and `encoding` are kept and are still scanned, and the media
  type key itself is still scanned.

Because `normalizeSpec` is also the canonical form the drift check
(`scripts/contracts/lint-contracts.mjs`) and the digests
(`scripts/contracts/checksums.mjs`) are computed over, the upstream YAML and the
committed JSON keep comparing equal. The specs live in
`src/test/unit/swagger/fetch-swagger.test.ts`.

## Consequences

### What this buys

- The pin can follow upstream again: `v0.8.0` is vendored and every later release
  that keeps documenting HTML responses this way can be too.
- The scan itself still has no exemptions. Nothing upstream writes in a dropped
  position reaches the committed artifact, the swagger page or the Mockoon image, so
  the drop cannot become a bypass — an exemption would have let the markup through.

### What this costs

- The swagger page and the Mockoon mock lose the illustrative HTML page for the OAuth
  authorize response; Mockoon serves that `200` with an empty body.
- The committed `openapi.json` is no longer a pure re-serialization of upstream: one
  more documented transformation sits beside the `maxLength: null` / `format: null`
  strip, and a reader diffing it against upstream has to know about both.
- The committed-artifact digest in `checksums.json` is taken over the normalized form,
  so on its own it cannot see a slot `normalizeSpec` drops: a text/html `example`
  hand-edited into the committed `openapi.json` would leave the digest unchanged. The
  offline integrity step of `make lint-contracts` therefore also requires the committed
  document to be a fixed point of normalization (`verifyNormalizedArtifact` in
  `scripts/contracts/checksums.mjs`); that assertion, not the digest, is what keeps the
  dropped slot tamper-evident.
- One more rule to keep narrow. The pressure to "just add" another media type or key
  the next time a refresh fails is the failure mode this record exists to resist.

### What would reverse it

Upstream stops shipping HTML samples (the drop then removes nothing and can be
deleted), or a need appears to show the HTML sample on `/swagger` — which would need a
rendering path that provably escapes it, not a scan exemption. Widening the drop to any
other media type, key or position requires a new ADR.
