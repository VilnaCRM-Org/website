# Load Test Configuration

## Path convention

K6 runs inside the `--profile load` Compose service, where the host directory
`src/test/load/` is mounted as `/loadTests/` (see the `k6` service in
`docker-compose.test.yml`). The Makefile `K6_*` variables use the **container** path
(the `/loadTests/...` form). The HTML report written to `/loadTests/results/` lands on the
host under `src/test/load/results/`.

```text
Where you set it    Path form        Example
Makefile / env      container path   /loadTests/homepage.js
Reading results     host path        src/test/load/results/homepage.html
```

## Makefile variables

Defined in the repository `Makefile`; override with container paths.

```text
K6_TEST_SCRIPT           default /loadTests/homepage.js
K6_RESULTS_FILE          default /loadTests/results/homepage.html
K6_SWAGGER_TEST_SCRIPT   default /loadTests/swagger.js
K6_SWAGGER_RESULTS_FILE  default /loadTests/results/swagger.html
```

```bash
K6_TEST_SCRIPT=/loadTests/homepage.js make test-load
K6_RESULTS_FILE=/loadTests/results/homepage.html make test-load
K6_SWAGGER_TEST_SCRIPT=/loadTests/swagger.js make test-load-swagger
```

The run command adds `--summary-trend-stats="avg,min,med,max,p(95),p(99)"` and
`--out "web-dashboard=period=1s&export=<results file>"`, so the console summary and the
HTML report are produced in one run.

## Target host

`config.json` sets `protocol`, `host`, and `port` (`http`, `prod`, `3001`), so K6 targets
`http://prod:3001` — the production Compose service on the external `website-network`.
Because the host is the service name, both load targets first run `start-prod` and
`wait-for-prod-health`; there is no `BASE_URL`/`VUS`/`DURATION` override — load is shaped
entirely by `config.json`.

## Tuning load with config.json

`Utils.getConfig()` loads `config.json` first and falls back to `config.json.dist`. The
committed default is `config.json.dist`; to change `rps`, `vus`, `duration`, `threshold`,
or `delayBetweenScenarios` locally, copy it and edit the copy:

```bash
cp src/test/load/config.json.dist src/test/load/config.json
```

Keep `config.json.dist` as the shared baseline so CI and other contributors compare
against the same numbers. The current per-profile values are listed in
[scenario-types.md](scenario-types.md).

## Result location

```text
src/test/load/results/
```

This directory is gitignored except its own `.gitignore`. After a run, open the generated
`homepage.html` or `swagger.html` there to inspect per-scenario latency and check rates.
