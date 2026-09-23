#!/usr/bin/env bats
#
# Coverage for scripts/ci/apply-branch-ruleset.sh, config/main-ruleset.json and
# scripts/ci/pr-check-names.mjs (issue #343).
#
# `gh` is stubbed, so nothing here reaches GitHub. The script half pins that a
# dry run writes nothing, that --apply writes exactly once (POST, or PUT onto a
# same-named ruleset), and that every refusal happens before any API call. The
# drift-guard half pins the committed required-check list against the workflows
# as js-yaml reads them: a required name no pull request reports would block
# every merge forever, and a new PR check nobody classified would silently stay
# advisory.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/apply-branch-ruleset.sh'
CONFIG_REL='config/main-ruleset.json'
APP_ID='4242'

setup() {
  setup_stub_dir
  export RULESETS_FIXTURE="$BATS_TEST_TMPDIR/rulesets.json"
  export RULESET_DETAIL_FIXTURE="$BATS_TEST_TMPDIR/ruleset-detail.json"
  export WRITTEN_PAYLOAD="$BATS_TEST_TMPDIR/written.json"
  printf '[]\n' >"$RULESETS_FIXTURE"
  printf '{}\n' >"$RULESET_DETAIL_FIXTURE"
  create_ruleset_gh_stub
}

# A `gh api` double: GETs replay the fixtures, a POST or PUT records the payload
# it was handed. GH_LIST_FAILS=1 makes the listing fail like an API outage.
create_ruleset_gh_stub() {
  cat >"$STUB_BIN_DIR/gh" <<'EOF'
#!/usr/bin/env bash
printf 'gh %s\n' "$*" >>"${COMMAND_LOG:?}"
method=GET
endpoint=''
input=''
shift
while [ "$#" -gt 0 ]; do
  case "$1" in
    --method)
      method="$2"
      shift
      ;;
    --input)
      input="$2"
      shift
      ;;
    -*) ;;
    *) endpoint="$1" ;;
  esac
  shift
done
case "$method" in
  GET)
    case "$endpoint" in
      */rulesets\?*)
        [ "${GH_LIST_FAILS:-0}" = 1 ] && exit 1
        cat "${RULESETS_FIXTURE:?}"
        ;;
      */rulesets/*) cat "${RULESET_DETAIL_FIXTURE:?}" ;;
      *) exit 1 ;;
    esac
    ;;
  POST | PUT)
    cp "$input" "${WRITTEN_PAYLOAD:?}"
    printf '{"id":1}\n'
    ;;
  *) exit 1 ;;
esac
EOF
  chmod +x "$STUB_BIN_DIR/gh"
}

run_apply() {
  run env -C "$PROJECT_ROOT" PATH="$STUB_BIN_DIR:$PATH" COMMAND_LOG="$COMMAND_LOG" \
    RULESETS_FIXTURE="$RULESETS_FIXTURE" RULESET_DETAIL_FIXTURE="$RULESET_DETAIL_FIXTURE" \
    WRITTEN_PAYLOAD="$WRITTEN_PAYLOAD" GH_LIST_FAILS="${GH_LIST_FAILS:-0}" \
    "$PROJECT_ROOT/$SCRIPT_REL" "$@"
}

write_count() {
  grep -cE -- '--method (POST|PUT|PATCH|DELETE)' "$COMMAND_LOG" || true
}

ruleset_name() {
  jq -r '.ruleset.name' "$PROJECT_ROOT/$CONFIG_REL"
}

# Seed a server-side ruleset equal to what the script would write, plus the
# metadata GitHub adds, so a no-op re-run can be told from drift.
seed_existing_ruleset() {
  local id="$1"
  jq -n --arg name "$(ruleset_name)" --argjson id "$id" \
    '[{id: $id, name: $name, enforcement: "active", target: "branch"}]' >"$RULESETS_FIXTURE"
  jq --argjson id "$id" --argjson app "$APP_ID" \
    '.ruleset | .bypass_actors[0].actor_id = $app
      | . + {id: $id, source: "VilnaCRM-Org/website", source_type: "Repository",
             created_at: "2026-09-23T00:00:00Z", current_user_can_bypass: "never"}' \
    "$PROJECT_ROOT/$CONFIG_REL" >"$RULESET_DETAIL_FIXTURE"
}

mutated_config() {
  local filter="$1"
  local out="$BATS_TEST_TMPDIR/config.json"
  jq "$filter" "$PROJECT_ROOT/$CONFIG_REL" >"$out"
  printf '%s' "$out"
}

produced_names() {
  local dir="${1:-.github/workflows}"
  (cd "$PROJECT_ROOT" && node scripts/ci/pr-check-names.mjs "$dir")
}

required_names() {
  jq -r '.ruleset.rules[] | select(.type == "required_status_checks")
    | .parameters.required_status_checks[].context' "$PROJECT_ROOT/$CONFIG_REL"
}

excluded_names() {
  jq -r '.excluded_checks | keys[]' "$PROJECT_ROOT/$CONFIG_REL"
}

# --- The script ---------------------------------------------------------------

@test "a dry run prints the payload and the diff and makes no write call" {
  run_apply --release-app-id "$APP_ID"
  [ "$status" -eq 0 ]
  assert_output_contains '"actor_id": 4242'
  assert_output_contains '"actor_type": "Integration"'
  assert_output_contains '=== Current rulesets on VilnaCRM-Org/website'
  assert_output_contains '(none)'
  assert_output_contains '+++ payload:'
  assert_output_contains 'Dry run: nothing was written'
  refute_output_contains 'excluded_checks'

  assert_log_contains 'gh api --method GET repos/VilnaCRM-Org/website/rulesets?'
  [ "$(write_count)" -eq 0 ]
  [ ! -e "$WRITTEN_PAYLOAD" ]
}

@test "a dry run against a same-named ruleset reads it and still writes nothing" {
  seed_existing_ruleset 77
  run_apply --release-app-id "$APP_ID"
  [ "$status" -eq 0 ]
  assert_log_contains 'gh api --method GET repos/VilnaCRM-Org/website/rulesets/77'
  assert_output_contains '(no change)'
  [ "$(write_count)" -eq 0 ]
}

@test "the diff shows a drifted live ruleset" {
  seed_existing_ruleset 77
  jq '.enforcement = "evaluate"' "$RULESET_DETAIL_FIXTURE" >"$BATS_TEST_TMPDIR/d.json"
  mv "$BATS_TEST_TMPDIR/d.json" "$RULESET_DETAIL_FIXTURE"

  run_apply --release-app-id "$APP_ID"
  [ "$status" -eq 0 ]
  assert_output_contains '-  "enforcement": "evaluate",'
  assert_output_contains '+  "enforcement": "active",'
  refute_output_contains '(no change)'
}

@test "--apply with no same-named ruleset makes exactly one POST" {
  jq -n '[{id: 9, name: "some-other-ruleset", enforcement: "active", target: "branch"}]' \
    >"$RULESETS_FIXTURE"

  run_apply --release-app-id "$APP_ID" --apply
  [ "$status" -eq 0 ]
  [ "$(write_count)" -eq 1 ]
  assert_log_contains 'gh api --method POST repos/VilnaCRM-Org/website/rulesets --input'

  run jq -e --arg name "$(ruleset_name)" \
    '.name == $name and .bypass_actors == [{actor_id: 4242, actor_type: "Integration", bypass_mode: "always"}]
      and (has("excluded_checks") | not) and (has("ruleset") | not)' "$WRITTEN_PAYLOAD"
  [ "$status" -eq 0 ]
}

@test "--apply onto a same-named ruleset makes exactly one PUT and no POST" {
  seed_existing_ruleset 77
  run_apply --release-app-id="$APP_ID" --apply
  [ "$status" -eq 0 ]
  [ "$(write_count)" -eq 1 ]
  assert_log_contains 'gh api --method PUT repos/VilnaCRM-Org/website/rulesets/77 --input'

  run grep -F -- '--method POST' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "a missing release App id is refused before any API call" {
  run_apply --apply
  [ "$status" -eq 2 ]
  assert_output_contains 'integration id is required'
  [ ! -s "$COMMAND_LOG" ]
}

@test "a malformed release App id is refused before any API call" {
  local bad
  for bad in '0' '-1' '12a' '4242; true' '' '0123'; do
    reset_command_log
    run_apply --release-app-id "$bad" --apply
    [ "$status" -eq 2 ]
    [ ! -s "$COMMAND_LOG" ]
  done
}

@test "an unknown flag is refused before any API call" {
  run_apply --release-app-id "$APP_ID" --aply
  [ "$status" -eq 2 ]
  assert_output_contains 'unknown argument: --aply'
  [ ! -s "$COMMAND_LOG" ]
}

@test "a flag missing its value is refused" {
  run_apply --release-app-id
  [ "$status" -eq 2 ]
  [ ! -s "$COMMAND_LOG" ]
}

@test "a config that is not JSON is refused before any API call" {
  printf '{ "ruleset": ' >"$BATS_TEST_TMPDIR/broken.json"
  run_apply --release-app-id "$APP_ID" --apply --config "$BATS_TEST_TMPDIR/broken.json"
  [ "$status" -eq 1 ]
  assert_output_contains 'malformed config'
  [ ! -s "$COMMAND_LOG" ]
}

@test "each broken invariant of the config is refused before any API call" {
  local filter
  local -a filters=(
    '.ruleset.bypass_actors[0].actor_id = 1'
    '.ruleset.bypass_actors += [{actor_id: null, actor_type: "Integration", bypass_mode: "always"}]'
    '.ruleset.bypass_actors[0].bypass_mode = "pull_request"'
    '.ruleset.enforcement = "evaluate"'
    '(.ruleset.rules[] | select(.type == "pull_request") | .parameters.require_code_owner_review) = false'
    '(.ruleset.rules[] | select(.type == "pull_request") | .parameters.required_approving_review_count) = 0'
    '(.ruleset.rules[] | select(.type == "pull_request") | .parameters.dismiss_stale_reviews_on_push) = false'
    '.ruleset.rules |= map(select(.type != "required_signatures"))'
    '.ruleset.rules |= map(select(.type != "required_status_checks"))'
    '(.ruleset.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks) += [{context: "static"}]'
    '(.ruleset.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks) = []'
    '.excluded_checks.deploy = ""'
    '.ruleset.name = ""'
    'del(.ruleset)'
  )
  for filter in "${filters[@]}"; do
    reset_command_log
    run_apply --release-app-id "$APP_ID" --apply --config "$(mutated_config "$filter")"
    if [ "$status" -ne 1 ] || [ -s "$COMMAND_LOG" ]; then
      echo "not refused before any API call: $filter (status $status)" >&2
      return 1
    fi
  done
}

@test "a failed listing aborts --apply without a write" {
  GH_LIST_FAILS=1 run_apply --release-app-id "$APP_ID" --apply
  [ "$status" -eq 1 ]
  assert_output_contains 'cannot list the rulesets'
  [ "$(write_count)" -eq 0 ]
}

@test "two same-named rulesets abort --apply without a write" {
  jq -n --arg name "$(ruleset_name)" \
    '[{id: 1, name: $name}, {id: 2, name: $name}]' >"$RULESETS_FIXTURE"
  run_apply --release-app-id "$APP_ID" --apply
  [ "$status" -eq 1 ]
  assert_output_contains 'resolve the duplicate by hand'
  [ "$(write_count)" -eq 0 ]
}

# --- The committed config -----------------------------------------------------

@test "the committed config targets the default branch and pins #344's review rule" {
  run jq -e '
    .ruleset.conditions.ref_name.include == ["~DEFAULT_BRANCH"]
    and ([.ruleset.rules[] | select(.type == "pull_request")][0].parameters
         | .required_approving_review_count == 1 and .require_code_owner_review == true
           and .dismiss_stale_reviews_on_push == true)
    and ([.ruleset.rules[] | select(.type == "required_status_checks")][0].parameters
         | .required_status_checks | all(.integration_id == 15368))' "$PROJECT_ROOT/$CONFIG_REL"
  [ "$status" -eq 0 ]
}

# --- The drift guard ----------------------------------------------------------

# Prints each required check that the workflows under $1 do not report exactly
# once on every pull request; empty output means the list is sound.
misreported_required_checks() {
  local produced name count
  produced="$(produced_names "$1")"
  while IFS= read -r name; do
    count="$(jq --arg n "$name" '[.[] | select(.name == $n)] | length' <<<"$produced")"
    [ "$count" -eq 1 ] || printf '%s (reported by %s jobs)\n' "$name" "$count"
  done < <(required_names)
}

@test "every required check is reported by exactly one job on every pull request" {
  run misreported_required_checks .github/workflows
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "no required check is an expanded name of a conditional matrix job" {
  local produced
  produced="$(produced_names)"
  run jq -e --argjson required "$(required_names | jq -R . | jq -s .)" \
    '[.[] | select(.matrix and .conditional and (.name | IN($required[])))] | length == 0' \
    <<<"$produced"
  [ "$status" -eq 0 ]
}

@test "every pull-request check is either required or excluded with a reason, never both" {
  local classified produced
  classified="$( (required_names; excluded_names) | sort)"
  produced="$(produced_names | jq -r '.[].name' | sort -u)"

  run diff <(printf '%s\n' "$classified") <(printf '%s\n' "$produced")
  if [ "$status" -ne 0 ]; then
    echo "classification drifted (< classified only, > produced only):" >&2
    printf '%s\n' "$output" >&2
    return 1
  fi

  run bash -c "comm -12 <(printf '%s\n' \"\$1\" | sort) <(printf '%s\n' \"\$2\" | sort)" _ \
    "$(required_names)" "$(excluded_names)"
  [ -z "$output" ]
}

@test "renaming a required job turns the drift guard red" {
  local dir="$BATS_TEST_TMPDIR/workflows"
  cp -R "$PROJECT_ROOT/.github/workflows" "$dir"
  (cd "$PROJECT_ROOT" && node --input-type=module -e "
    import fs from 'node:fs';
    import yaml from 'js-yaml';
    const file = process.argv[1] + '/static-testing.yml';
    const doc = yaml.load(fs.readFileSync(file, 'utf8'));
    doc.jobs.static.name = 'static renamed';
    fs.writeFileSync(file, yaml.dump(doc));
  " "$dir")

  run misreported_required_checks "$dir"
  [ "$status" -eq 0 ]
  [ "$output" = 'static (reported by 0 jobs)' ]
}

# --- The check-name renderer --------------------------------------------------

write_workflow() {
  printf '%s\n' "$2" >"$BATS_TEST_TMPDIR/wf/$1"
}

@test "only unfiltered pull-request workflows contribute, with GitHub's rendered names" {
  mkdir -p "$BATS_TEST_TMPDIR/wf"
  write_workflow plain.yml 'on:
  pull_request:
    branches: [main]
jobs:
  lint: {runs-on: ubuntu-latest, steps: [{run: "true"}]}
  named: {name: "unit tests", if: "github.actor != '"'x'"'", runs-on: ubuntu-latest, steps: [{run: "true"}]}'
  write_workflow matrix.yml 'on: [pull_request, push]
jobs:
  lh:
    name: "lighthouse ${{ matrix.form }}"
    strategy: {matrix: {form: [desktop, mobile]}}
    runs-on: ubuntu-latest
    steps: [{run: "true"}]
  analyze:
    name: Analyze
    strategy: {matrix: {language: [typescript]}}
    runs-on: ubuntu-latest
    steps: [{run: "true"}]
  load:
    name: "${{ matrix.label }} load"
    strategy: {matrix: {include: [{label: home}, {label: api}]}}
    runs-on: ubuntu-latest
    steps: [{run: "true"}]'
  write_workflow filtered.yml 'on:
  pull_request:
    paths: ["src/**"]
jobs:
  filtered: {runs-on: ubuntu-latest, steps: [{run: "true"}]}'
  write_workflow ignored.yml 'on:
  pull_request:
    paths-ignore: ["docs/**"]
jobs:
  ignored: {runs-on: ubuntu-latest, steps: [{run: "true"}]}'
  write_workflow closed.yml 'on:
  pull_request:
    types: [closed]
jobs:
  closed: {runs-on: ubuntu-latest, steps: [{run: "true"}]}'
  write_workflow other-branch.yml 'on:
  pull_request:
    branches: [develop]
jobs:
  other: {runs-on: ubuntu-latest, steps: [{run: "true"}]}'
  write_workflow push.yml 'on:
  push:
    branches: [main]
jobs:
  push-only: {runs-on: ubuntu-latest, steps: [{run: "true"}]}'

  run bash -c "(cd '$PROJECT_ROOT' && node scripts/ci/pr-check-names.mjs '$BATS_TEST_TMPDIR/wf') | jq -r '.[].name' | sort"
  [ "$status" -eq 0 ]
  [ "$output" = "$(printf '%s\n' 'Analyze (typescript)' 'api load' 'home load' 'lighthouse desktop' 'lighthouse mobile' 'lint' 'unit tests')" ]
}

@test "the renderer fails closed on a name it cannot render exactly" {
  local body
  local -a bodies=(
    'jobs: {x: {name: "build ${{ github.ref }}", runs-on: ubuntu-latest, steps: [{run: "true"}]}}'
    'jobs: {x: {strategy: {matrix: "${{ fromJSON(needs.a.outputs.m) }}"}, runs-on: ubuntu-latest, steps: [{run: "true"}]}}'
    'jobs: {x: {name: "s ${{ matrix.missing }}", strategy: {matrix: {i: [1]}}, runs-on: ubuntu-latest, steps: [{run: "true"}]}}'
    'jobs: {x: {strategy: {matrix: {i: [1, 2], exclude: [{i: 2}]}}, runs-on: ubuntu-latest, steps: [{run: "true"}]}}'
    'jobs: {x: {uses: ./.github/workflows/reusable.yml}}'
  )
  for body in "${bodies[@]}"; do
    rm -rf "$BATS_TEST_TMPDIR/wf" && mkdir -p "$BATS_TEST_TMPDIR/wf"
    write_workflow bad.yml "on: pull_request
$body"
    run bash -c "cd '$PROJECT_ROOT' && node scripts/ci/pr-check-names.mjs '$BATS_TEST_TMPDIR/wf'"
    if [ "$status" -ne 1 ]; then
      echo "rendered instead of failing closed: $body" >&2
      return 1
    fi
  done
}

@test "the renderer fails closed on an empty or unreadable workflows directory" {
  mkdir -p "$BATS_TEST_TMPDIR/empty"
  run bash -c "cd '$PROJECT_ROOT' && node scripts/ci/pr-check-names.mjs '$BATS_TEST_TMPDIR/empty'"
  [ "$status" -eq 1 ]
  run bash -c "cd '$PROJECT_ROOT' && node scripts/ci/pr-check-names.mjs '$BATS_TEST_TMPDIR/missing'"
  [ "$status" -eq 1 ]
}
