# Bats Suite

This suite covers Makefile targets and `scripts/ci` helper flows that are not already
exercised by the pull request workflows.

## Run locally

```bash
make test-bats
```

Use `BATS_FORMATTER=tap` when you want CI-style output:

```bash
make test-bats BATS_FORMATTER=tap
```

## Maintain coverage

1. Update `tests/bats/make-target-coverage.tsv` whenever a Makefile target is added,
   removed, or reclassified.
2. If a target is not already exercised by a PR workflow, add or update the Bats test
   that covers its shell behavior.
3. If a workflow already exercises the target, document that workflow in
   `tests/bats/make-target-coverage.tsv` instead of duplicating the coverage.
