#!/usr/bin/env bats
#
# Contract coverage for .github/workflows/uptime-check.yml (issue #336).
#
# The workflow is the site's only failure detector, and a scheduled workflow is
# the kind nobody watches: a lost trigger, a permission that stops covering
# `gh issue create`, or a fallback origin that drifts from the one the site is
# actually served from would each turn the check into a green no-op with no red
# anywhere. These cases pin the wiring so that shape of regression fails here.
#
# The document is PARSED with js-yaml, never grep-scanned (CLAUDE.md, issue
# #447): a text search for `permissions: {}` or `cancel-in-progress: false` is
# satisfied by the same characters inside a comment or a `run:` body, so a
# workflow that lost the real key would still pass. Every assertion below reads
# the parsed value through jq.

load './test_helper.bash'

WORKFLOW_REL='.github/workflows/uptime-check.yml'
WORKFLOW="$PROJECT_ROOT/$WORKFLOW_REL"

# Print the parsed workflow as JSON. YAML 1.1 folds a bare `on:` key to boolean
# true and js-yaml v4 (YAML 1.2 core) keeps it a string; the triggers are
# normalised onto `.triggers` so the assertions are parser-agnostic — the same
# reading scripts/ci/lint-prod-guardrails.mjs takes.
workflow_json() {
  PROJECT_ROOT="$PROJECT_ROOT" node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8")) || {};
    doc.triggers = doc.on !== undefined ? doc.on : doc.true;
    process.stdout.write(JSON.stringify(doc));
  ' "$1"
}

setup() {
  [ -f "$WORKFLOW" ]
  DOC="$BATS_TEST_TMPDIR/uptime-check.json"
  workflow_json "$WORKFLOW" > "$DOC"
  # Every assertion below addresses the one job by id; renaming it must fail
  # here rather than silently emptying every `.jobs.probe` read.
  [ "$(jq -r '.jobs | keys | join(",")' "$DOC")" = 'probe' ]
}

# --- Triggers ----------------------------------------------------------------------

@test "runs every thirty minutes and on manual dispatch, and on nothing else" {
  [ "$(jq -r '.triggers | keys | sort | join(",")' "$DOC")" = 'schedule,workflow_dispatch' ]
  [ "$(jq -r '.triggers.schedule | length' "$DOC")" -eq 1 ]
  [ "$(jq -r '.triggers.schedule[0].cron' "$DOC")" = '*/30 * * * *' ]
}

@test "is named so a future ci-health-alerts entry could match it by name" {
  # `name:` is load-bearing for workflow_run listeners (CLAUDE.md, #383).
  [ "$(jq -r '.name' "$DOC")" = 'uptime check' ]
}

# --- Permissions and hardening -------------------------------------------------------

@test "declares an empty workflow-level permissions baseline" {
  # A real empty mapping, not an absent key: absent means every job inherits the
  # repository default token scope.
  [ "$(jq -c '.permissions' "$DOC")" = '{}' ]
}

@test "grants the job exactly contents:read and issues:write" {
  [ "$(jq -c '.jobs.probe.permissions' "$DOC")" = '{"contents":"read","issues":"write"}' ]
}

@test "bounds the job with a timeout and never cancels an in-flight run" {
  [ "$(jq -r '.jobs.probe["timeout-minutes"] | type' "$DOC")" = 'number' ]
  # Two overlapping runs would race on the shared incident issue, and a cancelled
  # run could leave it half-written.
  [ -n "$(jq -r '.concurrency.group // empty' "$DOC")" ]
  [ "$(jq -c '.concurrency["cancel-in-progress"]' "$DOC")" = 'false' ]
}

@test "pins every action to a full commit sha and drops the checkout credentials" {
  local refs ref
  refs="$(jq -r '.jobs.probe.steps[] | select(.uses != null) | .uses' "$DOC")"
  [ -n "$refs" ]
  while read -r ref; do
    printf '%s' "$ref" |
      grep -qE '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*@[0-9a-f]{40}$' ||
      { printf 'unpinned uses: %s\n' "$ref" >&2; return 1; }
  done <<< "$refs"

  # `persist-credentials: false` on the (single) checkout step, read as the real
  # boolean input rather than as text that could sit in a comment.
  [ "$(jq -r '[.jobs.probe.steps[] | select(.uses != null) | select(.uses | startswith("actions/checkout@"))] | length' "$DOC")" -eq 1 ]
  [ "$(jq -c '.jobs.probe.steps[] | select(.uses != null) | select(.uses | startswith("actions/checkout@")) | .with["persist-credentials"]' "$DOC")" = 'false' ]
}

@test "never interpolates an expression into a run body" {
  # Script-injection guard (zizmor template-injection): every value a step needs
  # arrives through env, so no `${{ }}` may appear inside any `run:`.
  [ "$(jq -r '[.jobs.probe.steps[] | select(.run != null) | .run | select(contains("${{"))] | length' "$DOC")" -eq 0 ]
}

@test "assumes no AWS role, cuts no release and calls no local composite" {
  # This is what keeps the workflow outside `make lint-prod-guardrails`'s
  # privileged set, and therefore outside ci-health-alerts.yml — listing it
  # there would file a second, differently-titled issue for every outage.
  local doc
  doc="$(cat "$DOC")"
  [[ "$doc" != *'aws-actions/configure-aws-credentials'* ]]
  [[ "$doc" != *'role-to-assume'* ]]
  [[ "$doc" != *'./.github/actions/'* ]]
  [[ "$doc" != *'gh release create'* ]]
  ! grep -Fq -- '- uptime check' "$PROJECT_ROOT/.github/workflows/ci-health-alerts.yml"
}

# --- The gh CLI context ---------------------------------------------------------------

@test "puts GH_REPO on the job env so gh can file the issue without a git remote" {
  # ci-health-alerts.yml has no checkout and no GH_REPO, and every one of its
  # alert steps has failed on `gh` being unable to resolve a repository. The
  # fixed shape is the job-level env, which every step inherits.
  [ "$(jq -r '.jobs.probe.env.GH_REPO' "$DOC")" = '${{ github.repository }}' ]
}

@test "hands the token only to the steps that call gh" {
  local gh_steps token_steps
  gh_steps="$(jq -r '[.jobs.probe.steps[] | select(.run != null) | select(.run | contains("gh issue"))] | length' "$DOC")"
  token_steps="$(jq -r '[.jobs.probe.steps[] | select(.env.GH_TOKEN == "${{ github.token }}")] | length' "$DOC")"
  [ "$gh_steps" -ge 2 ]
  [ "$token_steps" -eq "$gh_steps" ]
  # And not to the probe scripts, which need no token at all.
  [ "$(jq -r '.jobs.probe.env.GH_TOKEN // "absent"' "$DOC")" = 'absent' ]
}

# --- The origin ------------------------------------------------------------------------

@test "defaults the origin to the committed canonical one and lets the variable override it" {
  # The deploy smoke has skipped on every deploy because PRODUCTION_SITE_URL was
  # never set; this check must be live on day one instead. The fallback is the
  # origin security.txt publishes as `Canonical`, so the two cannot drift apart.
  local canonical expected
  canonical="$(sed -n 's/^Canonical: //p' "$PROJECT_ROOT/public/.well-known/security.txt")"
  [ -n "$canonical" ]
  expected="$(printf '%s' "$canonical" | sed -E 's|^(https://[^/]+).*$|\1|')"
  [ "$(jq -r '.jobs.probe.env.SITE_URL' "$DOC")" = "\${{ vars.PRODUCTION_SITE_URL || '${expected}' }}" ]
}

# --- The probes ------------------------------------------------------------------------

@test "runs both probe scripts against the origin, and both are executable" {
  local positive negative
  positive="$(jq -r '.jobs.probe.steps[] | select(.id == "positive") | .run' "$DOC")"
  negative="$(jq -r '.jobs.probe.steps[] | select(.id == "negative") | .run' "$DOC")"
  [ "$positive" = './scripts/ci/uptime-check.sh "$SITE_URL"' ]
  [ "$negative" = './scripts/ci/smoke-response-shape.sh "$SITE_URL"' ]
  # Both are invoked by path, so a lost exec bit is a silent break no YAML
  # assertion would catch.
  [ -x "$PROJECT_ROOT/scripts/ci/uptime-check.sh" ]
  [ -x "$PROJECT_ROOT/scripts/ci/smoke-response-shape.sh" ]
}

@test "lets both probes report before anything is filed" {
  # continue-on-error on each probe is what makes the second verdict reach the
  # issue when the first is already red.
  [ "$(jq -c '.jobs.probe.steps[] | select(.id == "positive") | .["continue-on-error"]' "$DOC")" = 'true' ]
  [ "$(jq -c '.jobs.probe.steps[] | select(.id == "negative") | .["continue-on-error"]' "$DOC")" = 'true' ]
}

@test "gives the negative probe a synthetic-check retry budget, not the deploy one" {
  # smoke-response-shape.sh defaults to twelve attempts because a deploy is still
  # propagating when it runs. Nothing is propagating here.
  local attempts
  attempts="$(jq -r '.jobs.probe.steps[] | select(.id == "negative") | .env.SMOKE_ATTEMPTS' "$DOC")"
  [ "$attempts" -ge 1 ]
  [ "$attempts" -lt 12 ]
}

# --- The alert ---------------------------------------------------------------------------

@test "files on either probe failing, closes only when both pass, and reds the run" {
  local file_if close_if fail_if
  file_if="$(jq -r '.jobs.probe.steps[] | select(.name | startswith("File or refresh")) | .if' "$DOC")"
  close_if="$(jq -r '.jobs.probe.steps[] | select(.name | startswith("Close the uptime")) | .if' "$DOC")"
  fail_if="$(jq -r '.jobs.probe.steps[] | select(.name | startswith("Fail the run")) | .if' "$DOC")"
  [ "$file_if" = "steps.positive.outcome == 'failure' || steps.negative.outcome == 'failure'" ]
  [ "$close_if" = "steps.positive.outcome == 'success' && steps.negative.outcome == 'success'" ]
  # Keyed on the probe outcomes, not on failure(): a broken checkout must not
  # file an incident against a site that is up.
  [ "$fail_if" = "$file_if" ]
  # The red-run step is last, so the alert steps can never be skipped by it.
  [ "$(jq -r '.jobs.probe.steps[-1].name' "$DOC")" = 'Fail the run when a probe failed' ]
  [ "$(jq -r '.jobs.probe.steps[-1].run' "$DOC")" = 'exit 1' ]
}

@test "dedups by exact title over the open issues on the label, with the title as jq data" {
  local file_run close_run
  file_run="$(jq -r '.jobs.probe.steps[] | select(.name | startswith("File or refresh")) | .run' "$DOC")"
  close_run="$(jq -r '.jobs.probe.steps[] | select(.name | startswith("Close the uptime")) | .run' "$DOC")"
  local step
  for step in "$file_run" "$close_run"; do
    [[ "$step" == *'gh issue list --label uptime-alert --state open'* ]]
    [[ "$step" == *"jq -r --arg title \"\$title\" '[.[] | select(.title == \$title)][0].number // empty'"* ]]
  done
  # One label, one title, in both steps — a second copy of either would let the
  # filing step and the closing step address different issues.
  [ "$(printf '%s\n%s\n' "$file_run" "$close_run" | grep -c "^title='Uptime: the production site is failing its synthetic check'$")" -eq 2 ]
  [[ "$file_run" == *'gh label create uptime-alert'* ]]
  [[ "$file_run" == *'gh issue comment "$existing"'* ]]
  [[ "$file_run" == *'gh issue create --label uptime-alert --title "$title"'* ]]
  [[ "$close_run" == *'gh issue close "$existing"'* ]]
  # The issue body points at the runbook an operator should open first.
  [[ "$file_run" == *'docs/runbooks/incident-response.md'* ]]
  [ -f "$PROJECT_ROOT/docs/runbooks/incident-response.md" ]
}
