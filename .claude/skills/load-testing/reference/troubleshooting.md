# Load Testing Troubleshooting

## Prod service is not healthy

Both load targets chain `start-prod` and `wait-for-prod-health`, so a run that hangs at
startup is usually the prod container not reaching a healthy state. Re-check it:

```bash
make wait-for-prod-health
```

If the health check times out, inspect the prod container's logs. No make target exposes
the prod/test stack logs — `make logs` only follows the `dev` service — so query the test
compose stack directly:

```bash
docker compose -f common-healthchecks.yml -f docker-compose.test.yml logs --follow
```

You can also rely on the K6 console output already covered below.

## Results file is missing

Confirm the output path is a container path under `/loadTests/results/` and that you are
reading the host path `src/test/load/results/`. The directory is committed (it holds only
a `.gitignore`), so a missing `homepage.html` / `swagger.html` means the run did not reach
the export step — check the K6 console output for an earlier threshold or setup failure.

## High failure rate or a breached threshold

A failing `checks{scenario:<type>}` (`rate <= 0.99`) or `http_req_duration` `p(99)` over
the profile budget is a real signal, not a tuning nuisance.

1. Verify the flow works correctly outside load first (browser, or `make test-e2e` for the
   page). This separates a broken flow from load pressure.
2. If the flow is correct, reduce load in a local `config.json` (lower `rps`, `vus`, or
   `duration`) to find the point where latency degrades.
3. Fix the code, data, or capacity. Never raise the `threshold` or lower the check rate to
   make a run pass — that weakens the gate (see the ci-workflow skill).

## A scenario did not run

`run_smoke`, `run_average`, `run_stress`, and `run_spike` gate the scenarios in
`src/test/load/utils/scenarioUtils.js`: setting a flag drops that scenario from the run.
To run the full smoke -> average -> stress -> spike sequence, leave all four unset.

## K6 image needs rebuilding

The K6 binary is built with xk6 extensions in `src/test/load/Dockerfile`. If the image is
stale or missing, rebuild it before a run:

```bash
make build-k6
```
