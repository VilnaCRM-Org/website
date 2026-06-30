# Scenario Types

`config.json` (default: `config.json.dist`) defines four profiles per endpoint. The
builders in `src/test/load/utils/` translate each profile into a K6 executor. All four run
in sequence, separated by `delayBetweenScenarios` seconds (30 by default), with start
times computed cumulatively so they never overlap.

## Executor shapes

```text
smoke    constant-arrival-rate   fixed rps for `duration` seconds
average  ramping-arrival-rate    rise -> plateau -> fall (target = rps)
stress   ramping-arrival-rate    rise -> plateau -> fall (target = rps)
spike    ramping-arrival-rate    rise -> fall (no plateau; target = rps)
```

Each scenario pre-allocates `vus` VUs, uses a `1s` time unit, and is tagged with
`test_type: <type>`. Average and stress share the rise/plateau/fall stage builder; spike
uses a rise/fall-only builder. K6 also auto-tags each scenario run with `scenario: <type>`,
which the check threshold keys on.

## Current values

These are the committed defaults in `config.json.dist`. `threshold` is the `p(99)`
`http_req_duration` budget in milliseconds; durations are in seconds.

```text
homepage  setupTimeoutInMinutes 10
  smoke    threshold 15000  rps 5    vus 5    duration 10
  average  threshold 5000   rps 15   vus 15   rise 5  plateau 30  fall 5
  stress   threshold 17000  rps 75   vus 75   rise 5  plateau 30  fall 5
  spike    threshold 44000  rps 150  vus 150  rise 30 fall 10

swagger   setupTimeoutInMinutes 15
  smoke    threshold 20000  rps 3    vus 3    duration 15
  average  threshold 8000   rps 10   vus 10   rise 5  plateau 45  fall 5
  stress   threshold 25000  rps 50   vus 50   rise 5  plateau 45  fall 5
  spike    threshold 60000  rps 100  vus 100  rise 30 fall 15
```

Change these only in a local `config.json` copy (see `configuration.md`); keep the
committed `config.json.dist` as the shared baseline so runs stay comparable.

## Selecting which scenarios run

With no environment flags set, all four scenarios run. The `run_smoke`, `run_average`,
`run_stress`, and `run_spike` environment variables are read in
`src/test/load/utils/scenarioUtils.js`, and the check is inverted: a scenario (and its
thresholds) is added only when its variable is **unset**, so setting `run_<type>` to any
value **skips** that scenario rather than enabling it. Despite the `run_` prefix they act
as skip toggles. To run the full smoke -> average -> stress -> spike sequence, leave all
four unset.

## What each scenario asserts

- `homepage.js` issues a single `GET` to the base URL and checks for status `200`.
- `swagger.js` loads `/swagger` and `/swagger-schema.json`, then exercises the mock REST
  API: `GET/POST/PUT/DELETE /api/users`, `/api/system/health`, `/api/system/status`,
  authenticated requests, error cases, content-type variants, a `http.batch` of
  concurrent reads, query-parameter combinations, and a response-time check. Each request
  is wrapped in `utils.checkResponse`, which feeds the `checks` threshold.
