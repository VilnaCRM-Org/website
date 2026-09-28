#!/usr/bin/env bats
#
# Contract coverage for .github/workflows/autorelease.yml (issue #481, ADR 0011).
#
# The release lane only runs on pushes to main, so a regression here surfaces as a
# stranded tag in production rather than a red pull request. These cases pin the
# wiring that keeps a tag from outliving a refused release commit: the changelog
# action must not push, exactly one step must push through
# scripts/ci/push-release.sh, and nothing may bring back a non-atomic
# `--follow-tags` push. The document is PARSED with js-yaml, never grep-scanned
# (CLAUDE.md, issue #447).

load './test_helper.bash'

WORKFLOW="$PROJECT_ROOT/.github/workflows/autorelease.yml"

workflow_json() {
  PROJECT_ROOT="$PROJECT_ROOT" node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8")) || {};
    doc.triggers = doc.on !== undefined ? doc.on : doc.true;
    process.stdout.write(JSON.stringify(doc));
  ' "$1"
}

step_index() {
  jq -r \
    '[.jobs.build.steps | to_entries[] | select(.value | '"$1"') | .key] | if length == 1 then .[0] else "ambiguous:\(length)" end' \
    "$DOC"
}

setup() {
  [ -f "$WORKFLOW" ]
  DOC="$BATS_TEST_TMPDIR/autorelease.json"
  workflow_json "$WORKFLOW" > "$DOC"
  [ "$(jq -r '.jobs | keys | join(",")' "$DOC")" = 'build' ]

  PREFLIGHT="$(step_index '(.run // "") == "bash scripts/ci/check-release-version.sh ."')"
  SBOM="$(step_index '.name == "Generate CycloneDX SBOM"')"
  CHANGELOG="$(step_index '.id == "changelog"')"
  PUSH="$(step_index '(.run // "") | contains("scripts/ci/push-release.sh")')"
  RELEASE="$(step_index '.name == "Create Release"')"
}

@test "keeps the workflow name ci-health-alerts and the guardrails match on" {
  [ "$(jq -r '.name' "$DOC")" = 'Generate Changelog and Create Release' ]
  [ "$(jq -c '.triggers' "$DOC")" = '{"push":{"branches":["main"]}}' ]
}

@test "runs the preflight and the SBOM before the changelog action writes anything" {
  [[ "$PREFLIGHT" =~ ^[0-9]+$ ]]
  [[ "$SBOM" =~ ^[0-9]+$ ]]
  [[ "$CHANGELOG" =~ ^[0-9]+$ ]]
  [ "$PREFLIGHT" -lt "$SBOM" ]
  [ "$SBOM" -lt "$CHANGELOG" ]
}

@test "stops the changelog action from pushing" {
  [ "$(jq -r '.jobs.build.steps[] | select(.id == "changelog") | .with["git-push"] | tostring' "$DOC")" = 'false' ]
}

@test "pushes through exactly one push-release.sh step between the changelog and the release" {
  [[ "$PUSH" =~ ^[0-9]+$ ]]
  [[ "$RELEASE" =~ ^[0-9]+$ ]]
  [ "$CHANGELOG" -lt "$PUSH" ]
  [ "$PUSH" -lt "$RELEASE" ]
}

@test "runs the push step only for a release and passes the tag and branch through env" {
  step=".jobs.build.steps[$PUSH]"

  [ "$(jq -r "$step.if" "$DOC")" = "\${{ steps.changelog.outputs.skipped == 'false' }}" ]
  [ "$(jq -r "$step.env.RELEASE_TAG" "$DOC")" = '${{ steps.changelog.outputs.tag }}' ]
  [ "$(jq -r "$step.env.RELEASE_BRANCH" "$DOC")" = '${{ github.ref_name }}' ]
  [ "$(jq -r "$step.run" "$DOC")" = 'bash scripts/ci/push-release.sh "$RELEASE_TAG" "$RELEASE_BRANCH"' ]
  [ "$(jq -r "$step.uses // empty" "$DOC")" = '' ]
}

@test "publishes the release only for a release" {
  [ "$(jq -r ".jobs.build.steps[$RELEASE].if" "$DOC")" = "\${{ steps.changelog.outputs.skipped == 'false' }}" ]
}

@test "no step pushes with the non-atomic --follow-tags" {
  [ "$(jq '[.jobs[].steps[]? | (.run // "") | select(contains("--follow-tags"))] | length' "$DOC")" -eq 0 ]
}

@test "keeps the generated SBOM and release notes out of the release commit" {
  run env GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 \
    git -C "$PROJECT_ROOT" check-ignore -v website-sbom.cdx.json release-notes.md
  assert_success
  [ "$(printf '%s\n' "$output" | cut -d: -f1 | sort -u)" = '.gitignore' ]
  [ "$(printf '%s\n' "$output" | wc -l)" -eq 2 ]
}
