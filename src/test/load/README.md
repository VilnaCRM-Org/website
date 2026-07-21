# K6 load test thresholds

`config.json.dist` is the committed load-test configuration. `utils.js` prefers a
local, git-ignored `config.json` and falls back to `config.json.dist`, so CI (which
has no `config.json`) runs against the `.dist` values below.

Each scenario's `threshold` is the K6 `http_req_duration` **p(99)** ceiling in
milliseconds (see `utils/thresholdsBuilder.js`); every scenario also enforces a
`checks{scenario:…} rate>0.99` gate.

## Ratchet rule

The site is a statically exported page served by `serve`, so request latency is a
few milliseconds even under load. Thresholds may only move in the **stricter**
direction (lower `p(99)` ceiling). Never loosen a threshold to get a run green —
re-baseline instead, and lower the ceiling as latency improves.

## CI baseline

Measured p(99) from a 3-run CI load suite (PR #332). The ceilings keep a wide
safety margin over these numbers so shared-runner variance cannot flake the gate,
while still catching a materially larger latency regression (a static file that
starts answering in hundreds of ms instead of a few ms is clearly broken). Ratchet
the ceilings down as the margin allows.

| Scenario | Homepage p(99) | Homepage ceiling | Swagger p(99) | Swagger ceiling |
| -------- | -------------- | ---------------- | ------------- | --------------- |
| smoke    | 2.8 ms         | 2000 ms          | 4.8 ms        | 3000 ms         |
| average  | 2.5 ms         | 1500 ms          | 5.2 ms        | 2500 ms         |
| stress   | 2.0 ms         | 3000 ms          | 4.9 ms        | 4000 ms         |
| spike    | 2.1 ms         | 5000 ms          | 4.9 ms        | 8000 ms         |

## Re-baselining

Run `make test-load` / `make test-load-swagger`, read the `p(99)` for each
`test_type` from the K6 summary, and tighten the `threshold` values toward the new
envelope. Record the run these numbers came from when you change them.
