#!/usr/bin/env bats
#
# Coverage for scripts/ci/scan-secrets.sh and the .gitleaks.toml allowlist
# (issue #353) -- the committed-secrets gate -- plus its job-log leg (#375 F4):
# scripts/ci/fetch-run-logs.sh and job-log-secrets-scan.yml, and the token
# scope of both scanning workflows (#337), read from the parsed YAML.
#
# Two layers, because they fail in different ways:
#
#   * Contract tests with docker stubbed. These pin what the script HANDS the
#     scanner: the digest-pinned image, the committed config, `--exit-code 1`,
#     `--redact`, and the one flag that distinguishes the two modes (`--no-git`).
#     Every one of those is silent when wrong -- a dropped `--exit-code 1` still
#     prints findings and still exits 0, leaving a green check that scans
#     everything and blocks nothing.
#
#   * A seeded-defect test against the REAL pinned image (AC3). A gate nobody
#     has watched go red is a gate nobody knows works, and stubs cannot prove
#     gitleaks itself still matches on the ruleset this repo ships.
#
# The allowlist gets its own invariant: every build-output path exempted in
# .gitleaks.toml must genuinely be gitignored. That is the entire justification
# for exempting them -- a path git can never commit cannot hide a committed
# secret -- so it is asserted rather than left as a comment that rots.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/scan-secrets.sh'

DIGEST_IMAGE='ghcr.io/gitleaks/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f'

setup() {
  # Captured BEFORE the stub dir is prepended to PATH. The seeded-defect tests
  # below must reach the REAL docker; without this they inherit the stub, which
  # exits 0 for every command -- so the "credential is detected" case would fail
  # while the "clean tree is green" case passed vacuously.
  REAL_PATH="$PATH"
  setup_stub_dir
  create_docker_stub
  WORKSPACE="$BATS_TEST_TMPDIR/ws"
  mkdir -p "$WORKSPACE"
  cp "$PROJECT_ROOT/.gitleaks.toml" "$WORKSPACE/.gitleaks.toml"
}

run_scan() {
  run env \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    GITLEAKS_IMAGE="${GITLEAKS_IMAGE-$DIGEST_IMAGE}" \
    SECRETS_MODE="${SECRETS_MODE-}" \
    LOG_DIR="${LOG_DIR-}" \
    GITHUB_WORKSPACE="$WORKSPACE" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
}

seed_log_dir() {
  LOG_DIR="$BATS_TEST_TMPDIR/run-logs"
  mkdir -p "$LOG_DIR/deploy"
  printf 'step output\n' >"$LOG_DIR/deploy/1_Set up job.txt"
}

# --- mode contract ----------------------------------------------------------

@test "tree mode passes --no-git and the committed config, and fails closed on findings" {
  SECRETS_MODE=tree run_scan
  [ "$status" -eq 0 ]
  run cat "$COMMAND_LOG"
  [[ "$output" == *"--no-git"* ]]
  [[ "$output" == *"--config /repo/.gitleaks.toml"* ]]
  [[ "$output" == *"--exit-code 1"* ]]
  [[ "$output" == *"--redact"* ]]
  [[ "$output" == *"$DIGEST_IMAGE"* ]]
  [[ "$output" == *"-v $WORKSPACE:/repo"* ]]
}

@test "tree is the default mode when SECRETS_MODE is unset" {
  run_scan
  [ "$status" -eq 0 ]
  run cat "$COMMAND_LOG"
  [[ "$output" == *"--no-git"* ]]
}

@test "history mode drops --no-git so git history is actually walked" {
  git -C "$WORKSPACE" init -q
  SECRETS_MODE=history run_scan
  [ "$status" -eq 0 ]
  run cat "$COMMAND_LOG"
  # The whole point of the history leg. If --no-git leaked in here the job
  # would scan the tip checkout twice and report a clean history it never read.
  [[ "$output" != *"--no-git"* ]]
  [[ "$output" == *"--exit-code 1"* ]]
}

@test "history mode exempts the mount from git's dubious-ownership refusal" {
  git -C "$WORKSPACE" init -q
  SECRETS_MODE=history run_scan
  [ "$status" -eq 0 ]
  run cat "$COMMAND_LOG"
  # In CI the checkout is owned by the runner user and the container runs as
  # root; without this git aborts and the scan reports a tooling failure.
  [[ "$output" == *"GIT_CONFIG_COUNT=1"* ]]
  [[ "$output" == *"GIT_CONFIG_KEY_0=safe.directory"* ]]
  [[ "$output" == *"GIT_CONFIG_VALUE_0=/repo"* ]]
}

@test "tree mode does not pass the git ownership exemption it does not need" {
  SECRETS_MODE=tree run_scan
  [ "$status" -eq 0 ]
  run cat "$COMMAND_LOG"
  [[ "$output" != *"GIT_CONFIG_COUNT"* ]]
}

@test "logs mode scans LOG_DIR read-only as plain files with the committed config" {
  seed_log_dir
  SECRETS_MODE=logs run_scan
  [ "$status" -eq 0 ]
  run cat "$COMMAND_LOG"
  [[ "$output" == *"-v $LOG_DIR:/logs:ro"* ]]
  [[ "$output" == *"--source /logs --no-git"* ]]
  [[ "$output" == *"--config /repo/.gitleaks.toml"* ]]
  [[ "$output" == *"--exit-code 1"* ]]
  [[ "$output" == *"--redact"* ]]
  [[ "$output" == *"$DIGEST_IMAGE"* ]]
  [[ "$output" != *"--source /repo"* ]]
  [[ "$output" != *"GIT_CONFIG_COUNT"* ]]
}

@test "logs mode resolves a relative LOG_DIR to the absolute path docker needs" {
  seed_log_dir
  cd "$BATS_TEST_TMPDIR"
  LOG_DIR=run-logs SECRETS_MODE=logs run_scan
  [ "$status" -eq 0 ]
  run cat "$COMMAND_LOG"
  [[ "$output" == *"-v $(cd "$BATS_TEST_TMPDIR" && pwd -P)/run-logs:/logs:ro"* ]]
}

@test "logs mode propagates gitleaks' own exit status" {
  seed_log_dir
  # 3, not 1: every refusal in the script exits 1, so only a status the script
  # never produces itself proves the scanner's verdict is what reached the job.
  cat >"$STUB_BIN_DIR/docker" <<'EOF'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >>"${COMMAND_LOG:?}"
exit 3
EOF
  chmod +x "$STUB_BIN_DIR/docker"
  SECRETS_MODE=logs run_scan
  [ "$status" -eq 3 ]
  run grep -c '^docker ' "$COMMAND_LOG"
  [ "$output" = "1" ]
}

# --- fail-closed guards -----------------------------------------------------

@test "a tag instead of a digest is refused" {
  GITLEAKS_IMAGE='ghcr.io/gitleaks/gitleaks:v8.30.1' SECRETS_MODE=tree run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"not digest-pinned"* ]]
}

@test "a truncated digest is refused" {
  GITLEAKS_IMAGE='ghcr.io/gitleaks/gitleaks@sha256:c00b6bd0aeb' SECRETS_MODE=tree run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"64 lowercase hex"* ]]
}

@test "an unknown mode is refused rather than silently scanning the tree" {
  SECRETS_MODE=deep run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"must be 'tree', 'history' or 'logs'"* ]]
}

@test "logs mode without LOG_DIR is refused" {
  SECRETS_MODE=logs run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"needs LOG_DIR"* ]]
  [ ! -s "$COMMAND_LOG" ]
}

@test "logs mode refuses a LOG_DIR that does not exist" {
  LOG_DIR="$BATS_TEST_TMPDIR/absent" SECRETS_MODE=logs run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"is not a directory"* ]]
  [ ! -s "$COMMAND_LOG" ]
}

@test "logs mode refuses an empty LOG_DIR instead of reporting a clean scan of nothing" {
  mkdir -p "$BATS_TEST_TMPDIR/empty/deploy"
  LOG_DIR="$BATS_TEST_TMPDIR/empty" SECRETS_MODE=logs run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"no non-empty file"* ]]
  [ ! -s "$COMMAND_LOG" ]
}

@test "logs mode refuses a LOG_DIR holding only empty files" {
  mkdir -p "$BATS_TEST_TMPDIR/hollow"
  : >"$BATS_TEST_TMPDIR/hollow/1_deploy.txt"
  LOG_DIR="$BATS_TEST_TMPDIR/hollow" SECRETS_MODE=logs run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"no non-empty file"* ]]
  [ ! -s "$COMMAND_LOG" ]
}

@test "a missing config is refused rather than falling back to gitleaks defaults" {
  rm -f "$WORKSPACE/.gitleaks.toml"
  SECRETS_MODE=tree run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"not found"* ]]
}

@test "history mode without a git directory is refused, not passed vacuously" {
  SECRETS_MODE=history run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"fetch-depth: 0"* ]]
}

@test "history mode refuses a shallow clone instead of scanning past the graft" {
  # The dangerous case is not a MISSING .git but a shallow one: the directory
  # exists, gitleaks runs, every commit it can see is clean, and the job reports
  # green while everything before the graft boundary was never opened.
  local origin="$BATS_TEST_TMPDIR/origin"
  mkdir -p "$origin"
  git -C "$origin" init -q
  git -C "$origin" config user.email t@example.com
  git -C "$origin" config user.name Test
  printf 'one\n' >"$origin/a.txt"
  git -C "$origin" add a.txt
  git -C "$origin" commit -qm 'first'
  printf 'two\n' >"$origin/b.txt"
  git -C "$origin" add b.txt
  git -C "$origin" commit -qm 'second'

  rm -rf "$WORKSPACE"
  git clone -q --depth 1 "file://$origin" "$WORKSPACE"
  cp "$PROJECT_ROOT/.gitleaks.toml" "$WORKSPACE/.gitleaks.toml"
  [ "$(git -C "$WORKSPACE" rev-parse --is-shallow-repository)" = "true" ]

  SECRETS_MODE=history run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"shallow"* ]]

  # It must refuse BEFORE spending a scan. A run that reached gitleaks and then
  # exited 0 on the visible commits is the vacuous pass this guard exists to stop.
  run grep -c 'docker' "$COMMAND_LOG"
  [ "$output" = "0" ]
}

# --- allowlist invariant ----------------------------------------------------

@test "every build-output path exempted in .gitleaks.toml is genuinely gitignored" {
  # The exemption is only defensible because git cannot commit these paths.
  #
  # Probe a path INSIDE each directory, never the bare directory name. All three
  # patterns are written directory-only (`/.next/`), and `git check-ignore` only
  # matches such a pattern against a name that is actually a directory on disk.
  # A developer's tree has them, a clean CI checkout does not -- so the bare form
  # passes locally and fails in CI for a reason that has nothing to do with the
  # allowlist. The nested form is decided by the ignore rules alone.
  for path in .next out storybook-static-ci; do
    grep -qF "(/repo/)?${path//./\\.}/" "$PROJECT_ROOT/.gitleaks.toml" \
      || { echo "expected $path to be exempted in .gitleaks.toml"; false; }
    run git -C "$PROJECT_ROOT" check-ignore -q "$path/probe"
    [ "$status" -eq 0 ] || { echo "$path is exempted but NOT gitignored"; false; }
  done
}

# --- fetching a run's logs (#375 F4) ----------------------------------------

FETCH_REL='scripts/ci/fetch-run-logs.sh'

# gh double for the logs endpoint: records the call, then either fails like an
# HTTP error (FAKE_GH_EXIT) or writes FAKE_LOG_ARCHIVE to stdout as gh api does.
create_logs_gh_stub() {
  cat >"$STUB_BIN_DIR/gh" <<'EOF'
#!/usr/bin/env bash
printf 'gh %s\n' "$*" >>"${COMMAND_LOG:?}"
if [ -n "${FAKE_GH_EXIT:-}" ]; then
  printf 'gh: HTTP 410: Gone\n' >&2
  exit "$FAKE_GH_EXIT"
fi
if [ -n "${FAKE_LOG_ARCHIVE:-}" ]; then
  cat "$FAKE_LOG_ARCHIVE"
fi
EOF
  chmod +x "$STUB_BIN_DIR/gh"
}

# A zip laid out like the real archive: a top-level per-job file plus a
# directory of per-step files.
build_log_archive() {
  local src="$BATS_TEST_TMPDIR/archive-src"
  mkdir -p "$src/deploy"
  printf 'job output\n' >"$src/1_deploy.txt"
  printf 'step output\n' >"$src/deploy/1_Set up job.txt"
  (cd "$src" && python3 -m zipfile -c "$BATS_TEST_TMPDIR/logs.zip" 1_deploy.txt deploy)
  FAKE_LOG_ARCHIVE="$BATS_TEST_TMPDIR/logs.zip"
}

run_fetch() {
  run env \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    GH_REPO="${GH_REPO-VilnaCRM-Org/website}" \
    GITHUB_REPOSITORY= \
    RUN_ID="${RUN_ID-35918649858}" \
    LOG_DIR="${LOG_DIR-$BATS_TEST_TMPDIR/run-logs}" \
    RUNNER_TEMP="$BATS_TEST_TMPDIR" \
    FAKE_GH_EXIT="${FAKE_GH_EXIT-}" \
    FAKE_LOG_ARCHIVE="${FAKE_LOG_ARCHIVE-}" \
    bash "$PROJECT_ROOT/$FETCH_REL"
}

@test "fetch-run-logs downloads the run's archive and extracts every log file" {
  create_logs_gh_stub
  build_log_archive
  run_fetch
  [ "$status" -eq 0 ]
  [[ "$output" == *"2 log file(s)"* ]]
  [ -s "$BATS_TEST_TMPDIR/run-logs/deploy/1_Set up job.txt" ]
  assert_log_contains 'gh api repos/VilnaCRM-Org/website/actions/runs/35918649858/logs'
  # The downloaded zip is removed; only the extracted logs remain.
  [ -z "$(find "$BATS_TEST_TMPDIR" -maxdepth 1 -name 'run-logs.*' -print -quit)" ]
}

@test "fetch-run-logs fails closed when the download fails" {
  create_logs_gh_stub
  FAKE_GH_EXIT=1 run_fetch
  [ "$status" -eq 1 ]
  [[ "$output" == *"could not download the logs of run 35918649858"* ]]
}

@test "fetch-run-logs refuses an empty download" {
  create_logs_gh_stub
  run_fetch
  [ "$status" -eq 1 ]
  [[ "$output" == *"archive of run 35918649858 is empty"* ]]
}

@test "fetch-run-logs refuses a download that is not a zip" {
  create_logs_gh_stub
  printf '{"message":"Not Found"}' >"$BATS_TEST_TMPDIR/not-a-zip"
  FAKE_LOG_ARCHIVE="$BATS_TEST_TMPDIR/not-a-zip" run_fetch
  [ "$status" -eq 1 ]
  [[ "$output" == *"not a readable zip"* ]]
}

@test "fetch-run-logs refuses a run id that is not a number before calling gh" {
  create_logs_gh_stub
  for bad in '' '123/../../../user' '12 3' '-1'; do
    RUN_ID="$bad" run_fetch
    [ "$status" -eq 1 ]
    [[ "$output" == *"RUN_ID must be a numeric run id"* ]]
  done
  [ ! -s "$COMMAND_LOG" ]
}

@test "fetch-run-logs refuses a malformed repository before calling gh" {
  create_logs_gh_stub
  GH_REPO='VilnaCRM-Org/website/../other' run_fetch
  [ "$status" -eq 1 ]
  [[ "$output" == *"must be owner/name"* ]]
  [ ! -s "$COMMAND_LOG" ]
}

@test "fetch-run-logs refuses a LOG_DIR that already holds another run's logs" {
  create_logs_gh_stub
  build_log_archive
  mkdir -p "$BATS_TEST_TMPDIR/run-logs"
  printf 'stale\n' >"$BATS_TEST_TMPDIR/run-logs/0_build.txt"
  run_fetch
  [ "$status" -eq 1 ]
  [[ "$output" == *"is not empty"* ]]
  [ ! -s "$COMMAND_LOG" ]
}

# --- the job-log scan workflow (#375 F4) -------------------------------------

LOG_WORKFLOW="$PROJECT_ROOT/.github/workflows/job-log-secrets-scan.yml"

# Evaluates a JS expression over the parsed workflows: `wf` is the log-scan
# workflow, `alerts` is ci-health-alerts.yml, `names` every workflow `name:`.
workflow_fact() {
  PROJECT_ROOT="$PROJECT_ROOT" node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const path = require("path");
    const dir = path.join(process.env.PROJECT_ROOT, ".github/workflows");
    const load = (f) => yaml.load(fs.readFileSync(path.join(dir, f), "utf8"));
    const names = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => load(f).name);
    const wf = load("job-log-secrets-scan.yml");
    const alerts = load("ci-health-alerts.yml");
    const steps = Object.values(wf.jobs).flatMap((j) => j.steps || []);
    const out = eval(process.argv[1]);
    process.stdout.write((typeof out === "string" ? out : JSON.stringify(out)) + "\n");
  ' "$1"
}

@test "the log-scan workflow grants nothing at workflow level and actions+contents read to its job" {
  run permission_rows "$LOG_WORKFLOW"
  [ "$status" -eq 0 ]
  [ "$output" = "$(printf '%s\n' 'workflow|{}' 'scan|{"actions":"read","contents":"read"}')" ]
}

@test "the log-scan workflow never runs on a pull-request or push trigger" {
  # A pull_request trigger would also make it a PR check that
  # config/main-ruleset.json has to classify.
  run workflow_fact 'Object.keys(wf.on).sort().join(",")'
  [ "$status" -eq 0 ]
  [ "$output" = "workflow_dispatch,workflow_run" ]
}

@test "the log-scan workflow follows every privileged workflow by its exact name" {
  run workflow_fact 'wf.on.workflow_run.workflows.join("|")'
  [ "$output" = "website|Generate Changelog and Create Release|sandbox|Trigger Sandbox Deletion" ]
  run workflow_fact 'wf.on.workflow_run.types.join(",")'
  [ "$output" = "completed" ]
  # A listed name no workflow carries is a silently dead trigger.
  run workflow_fact 'wf.on.workflow_run.workflows.filter((n) => !names.includes(n)).join("|")'
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "a finding in the log scan reaches the ci-alert issue" {
  run workflow_fact 'alerts.on.workflow_run.workflows.includes(wf.name)'
  [ "$output" = "true" ]
}

@test "the log-scan workflow keeps event data out of run bodies and credentials off disk" {
  run workflow_fact 'steps.filter((s) => s.run && s.run.includes("${{")).length'
  [ "$output" = "0" ]
  run workflow_fact 'steps.filter((s) => /^actions\/checkout@/.test(s.uses || "")).map((s) => [/@[0-9a-f]{40}$/.test(s.uses), s.with && s.with["persist-credentials"]].join(":")).join(",")'
  [ "$output" = "true:false" ]
  run workflow_fact 'steps.map((s) => s.run).filter(Boolean).join("|")'
  [ "$output" = 'bash scripts/ci/fetch-run-logs.sh|make scan-secrets-logs LOG_DIR="$LOG_DIR"' ]
}

# --- workflow token scope (#337) --------------------------------------------

# `<scope>|<permissions>` per line: the workflow first, then each job in file
# order, keys sorted. Parsed with js-yaml so the verdict is what GitHub reads,
# not how the block is spelled; an absent key prints `<unset>` (GitHub then
# falls back to the repository default token, the opposite of `{}`).
permission_rows() {
  PROJECT_ROOT="$PROJECT_ROOT" node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const show = (p) => {
      if (p === undefined) return "<unset>";
      if (p && typeof p === "object") return JSON.stringify(Object.fromEntries(Object.entries(p).sort()));
      return JSON.stringify(p);
    };
    process.stdout.write("workflow|" + show(doc.permissions) + "\n");
    for (const [id, job] of Object.entries(doc.jobs || {})) {
      process.stdout.write(id + "|" + show(job.permissions) + "\n");
    }
  ' "$1"
}

@test "secrets-scanning.yml grants nothing at workflow level and contents: read to each job" {
  run permission_rows "$PROJECT_ROOT/.github/workflows/secrets-scanning.yml"
  [ "$status" -eq 0 ]
  # Exact, so a widened scope, a new job without its own block, or a renamed
  # job id (`gitleaks` is a required check in config/main-ruleset.json) all fail.
  [ "$output" = "$(printf '%s\n' 'workflow|{}' 'gitleaks|{"contents":"read"}' 'history|{"contents":"read"}')" ]
}

# --- the gate actually reddens (AC3) ----------------------------------------

real_docker_or_skip() {
  PATH="$REAL_PATH" command -v docker >/dev/null 2>&1 || skip 'docker not installed'
  PATH="$REAL_PATH" docker info >/dev/null 2>&1 || skip 'docker daemon not running'
}

run_real_scan() {
  run env \
    PATH="$REAL_PATH" \
    GITLEAKS_IMAGE="$DIGEST_IMAGE" \
    SECRETS_MODE=tree \
    GITHUB_WORKSPACE="$WORKSPACE" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
}

@test "real gitleaks: a seeded credential turns the gate red" {
  real_docker_or_skip
  # A fabricated GitHub PAT -- the credential class this repo actually leaked
  # once (#135), and one gitleaks' bundled `github-pat` rule matches reliably.
  #
  # The literal is ASSEMBLED AT RUNTIME and never appears whole in this file.
  # Writing it out would make the fixture a finding in the repo's own working
  # tree, so `make lint-secrets` would go red on the test that proves it works
  # -- and the only ways out of that would be exempting the test file or
  # weakening the rule, i.e. blunting the gate to keep its own test green.
  local token="ghp_$(printf '%s' '9Xk2LmQ4vRt7WyZa1BcDeFgHiJkLmN0oPqRs')"
  printf 'github_token = %s\n' "$token" >"$WORKSPACE/leak.tf"
  run_real_scan
  [ "$status" -eq 1 ]
}

@test "real gitleaks: the same workspace without the credential is green" {
  real_docker_or_skip
  # Proves the previous case failed on the seeded secret and not on some
  # unrelated property of the fixture -- without this pair, a scanner that
  # errored on every input would look like a working gate.
  printf 'aws_region = eu-central-1\n' >"$WORKSPACE/clean.tf"
  run_real_scan
  [ "$status" -eq 0 ]
}

run_real_logs_scan() {
  run env \
    PATH="$REAL_PATH" \
    GITLEAKS_IMAGE="$DIGEST_IMAGE" \
    SECRETS_MODE=logs \
    LOG_DIR="$BATS_TEST_TMPDIR/run-logs" \
    GITHUB_WORKSPACE="$WORKSPACE" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
}

# A realistic step log: timestamps, a masked registered secret, a commit SHA and
# an image digest -- the shapes every real log carries and none may trip.
write_clean_step_log() {
  mkdir -p "$BATS_TEST_TMPDIR/run-logs/check-tokens"
  {
    printf '2026-09-24T09:07:40.1234567Z ##[group]Run aws secretsmanager get-secret-value\n'
    printf '2026-09-24T09:07:40.1234568Z   GITHUB_TOKEN: ***\n'
    printf '2026-09-24T09:07:41.0000000Z HEAD is now at 3e289d80b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6\n'
    printf '2026-09-24T09:07:42.0000000Z Digest: sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f\n'
  } >"$BATS_TEST_TMPDIR/run-logs/check-tokens/6_Determine Prod Rotation.txt"
}

@test "real gitleaks: an installation token printed into a job log turns the logs scan red" {
  real_docker_or_skip
  write_clean_step_log
  # The F4 shape: a GitHub token fetched at run time, never registered as a
  # secret and so never masked, echoed by a debug flag. Assembled at runtime
  # for the same reason as the fixture above.
  local token="ghs_$(printf '%s' 'Q7mZ2kRt9WvXb4NcLp8YhJd3FsGa6EuTq1Ko')"
  printf '2026-09-24T09:07:43.0000000Z + GITHUB_TOKEN=%s\n' "$token" \
    >>"$BATS_TEST_TMPDIR/run-logs/check-tokens/6_Determine Prod Rotation.txt"
  run_real_logs_scan
  [ "$status" -eq 1 ]
  # The scanner's verdict, not one of the script's own exit-1 refusals.
  [[ "$output" == *"leaks found: 1"* ]]
}

@test "real gitleaks: the same job log without the token is green" {
  real_docker_or_skip
  write_clean_step_log
  run_real_logs_scan
  [ "$status" -eq 0 ]
}
