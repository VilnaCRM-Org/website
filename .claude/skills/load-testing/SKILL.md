---
name: load-testing
description: >-
  Use when creating, running, or debugging K6 load tests under src/test/load
  (homepage.js, swagger.js) with make test-load / make load-tests / make
  test-load-swagger — covering the smoke, average, stress, and spike scenario types,
  config.json tuning, p(99) duration and check-rate thresholds, the prod Docker Compose
  target, and the web-dashboard HTML results.
---

# Load Testing

K6 load tests live under `src/test/load/`. They drive the running **prod** container
(Next.js pages-router build) over the Docker `website-network` and assert latency and
correctness budgets per scenario. Two scenarios ship today: `homepage.js` (landing page
load) and `swagger.js` (the `/swagger` feature page plus its mock REST API).

## When to use

- You added or changed a page or API surface that should hold up under concurrent traffic.
- You are editing a scenario script, the scenario/threshold builders, or `config.json`.
- A load run failed in CI (`ci-test-load`) and you need to read the summary and HTML report.

## Commands

```bash
make test-load            # homepage scenario (alias of load-tests)
make test-load-swagger    # swagger scenario (alias of load-tests-swagger)
make load-tests           # same as test-load
make load-tests-swagger   # same as test-load-swagger
```

Each target runs `start-prod` then `wait-for-prod-health`, then executes K6 through the
`--profile load` Compose service. `ci-test-load` runs the homepage scenario in CI after
`ci-prod-setup` has already started prod, so it skips the startup steps.

## How a scenario script is built (config-driven)

Unlike a flat K6 script with inline `options`, every website scenario assembles its
`options` from `config.json` through small builders. A scenario file is thin:

- It names itself (`const scenarioName = 'homepage';`).
- It instantiates `Utils` (reads `config.json`, exposes `getBaseUrl`, `getParams`,
  `checkResponse`) and `ScenarioUtils` (builds scenarios + thresholds for that name).
- It exports `options = scenarioUtils.getOptions()` and a default function with the
  actual requests and `utils.checkResponse(...)` assertions.

See [`src/test/load/homepage.js`](../../../src/test/load/homepage.js),
[`src/test/load/swagger.js`](../../../src/test/load/swagger.js), and the builders in
[`src/test/load/utils/`](../../../src/test/load/utils/). Config defaults live in
[`src/test/load/config.json.dist`](../../../src/test/load/config.json.dist).

## Scenario types (smoke / average / stress / spike)

`config.json` defines four profiles per endpoint. All four run by default, back to back,
separated by `delayBetweenScenarios` seconds; `ScenariosBuilder` turns each into a K6
executor (see [reference/scenario-types.md](reference/scenario-types.md) for the shapes):

- **smoke** — `constant-arrival-rate` at a low fixed RPS for a few seconds. Sanity-checks
  that the flow works at all before heavier load.
- **average** — `ramping-arrival-rate` rising to the target RPS, holding a plateau, then
  falling. Models expected normal traffic.
- **stress** — `ramping-arrival-rate` at a much higher RPS (same rise/plateau/fall shape).
  Pushes past normal demand to find where latency degrades.
- **spike** — `ramping-arrival-rate` with only a sharp rise then fall (no plateau).
  Models a sudden surge and recovery.

`rps`, `vus` (pre-allocated VUs), `duration`, and `threshold` are read per profile from
`config.json`. Edit values there, never inside the scenario scripts.

## Thresholds and checks

`ThresholdsBuilder` registers two budgets per scenario type, both hard pass/fail:

- `http_req_duration{test_type:<type>}` must keep `p(99)` under the profile's `threshold`
  (milliseconds).
- `checks{scenario:<type>}` must keep a pass `rate` above `0.99` — at most 1% of
  `utils.checkResponse` assertions may fail.

A breached threshold fails the run. Treat that as a real regression signal — fix the code
or the data, never raise the threshold to make a run green (see the ci-workflow skill's
no-weakening rule).

## Scenario discipline

- Keep runs comparable: tune load only through `config.json`, leave the committed
  `config.json.dist` as the shared baseline.
- Model realistic journeys (page load, schema fetch, REST CRUD), not isolated internals.
- Generated test data is per-VU/iteration and unique
  ([`utils/test-data.js`](../../../src/test/load/utils/test-data.js)); the swagger
  scenario exercises the local mock API, so no real records persist, but keep generated
  ids/emails unique to avoid cross-iteration collisions.
- Run the smallest profile that exercises the changed flow (smoke) before stress or spike.
- Result artifacts land under `src/test/load/results/` (gitignored except `.gitignore`).

## Results

K6 writes a `web-dashboard` HTML report and prints a console summary with
`avg,min,med,max,p(95),p(99)` trend stats. The report path is a container path
(`/loadTests/results/homepage.html`) that maps to the host at
`src/test/load/results/homepage.html`. Open that HTML to inspect per-scenario latency and
check rates. Path forms and the Makefile `K6_*` variables are in
[reference/configuration.md](reference/configuration.md).

## Verification

Run the smallest scenario that covers the changed flow, then confirm: the K6 summary shows
no failed thresholds, the `checks` pass rate is above `0.99`, and the `p(99)` duration is
within the profile's `threshold`. Inspect the generated HTML report for the affected
scenario before declaring the change safe.

## Related Guides

Before applying this skill, confirm the active task against
[../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md) so every relevant skill is
consulted. The root `agents.md` test-coverage policy still applies to any behavior a load
scenario touches.

## Line Length Disclosure

Prettier `printWidth` is 100. Before presenting changes, check changed text files for
lines longer than 100 characters. If any exist, tell the user each `path:line` and the
measured character count. Treat this as disclosure, not failure, unless a project gate
fails.

## Supporting Files

- [reference/scenario-types.md](reference/scenario-types.md): executor shapes and the
  current per-profile rps/vus/duration/threshold values for both endpoints.
- [reference/configuration.md](reference/configuration.md): Makefile `K6_*` variables,
  container vs host paths, `config.json` overrides, and the prod target.
- [reference/troubleshooting.md](reference/troubleshooting.md): health, missing results,
  high failure rate, and scenario-gating recovery.
- [examples/homepage-flow.js](examples/homepage-flow.js): minimal config-driven page-load
  scenario.
- [examples/swagger-flow.js](examples/swagger-flow.js): trimmed config-driven API
  scenario.
