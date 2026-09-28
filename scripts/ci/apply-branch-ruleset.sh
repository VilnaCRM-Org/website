#!/usr/bin/env bash
# Build, diff and (only on --apply) write the default-branch ruleset committed in
# config/main-ruleset.json (issue #343, with #344's code-owner review and the
# release-App bypass ADR 0007 / .github/AUTORELEASE.md require).
#
# A ruleset is a LIVE repository setting: the moment it is active, every open pull
# request is held to it. So this script is a dry run unless told otherwise. The
# default mode prints the payload it would send, the rulesets that exist today
# (read-only GETs) and the diff between the two, and writes nothing. `--apply` is
# the only path to a write, and it makes exactly one: a POST when no ruleset of
# that name exists, a PUT to the existing one when it does.
#
# The release App's integration id is not recorded anywhere in the repository —
# it lives in the App's settings and in the VILNACRM_APP_ID secret — so it is a
# REQUIRED input and is never guessed: a wrong id would either bypass nothing
# (the release lane stays blocked) or exempt some other App from every rule.
#
# Usage:
#   scripts/ci/apply-branch-ruleset.sh --release-app-id <id> [--apply]
#     [--config <path>] [--repo <owner/name>]
# Exit codes: 0 ok, 1 malformed config or API failure, 2 usage refusal.
set -euo pipefail

CONFIG='config/main-ruleset.json'
REPO='VilnaCRM-Org/website'
APP_ID=''
APPLY=false

usage() {
  sed -n '/^# Usage:/,/^# Exit codes:/p' "$0" | sed 's/^# \{0,1\}//' >&2
}

refuse() {
  printf 'apply-branch-ruleset: %s\n' "$1" >&2
  exit "${2:-2}"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply) APPLY=true ;;
    --release-app-id)
      [ "$#" -ge 2 ] || refuse '--release-app-id needs a value'
      APP_ID="$2"
      shift
      ;;
    --release-app-id=*) APP_ID="${1#*=}" ;;
    --config)
      [ "$#" -ge 2 ] || refuse '--config needs a value'
      CONFIG="$2"
      shift
      ;;
    --config=*) CONFIG="${1#*=}" ;;
    --repo)
      [ "$#" -ge 2 ] || refuse '--repo needs a value'
      REPO="$2"
      shift
      ;;
    --repo=*) REPO="${1#*=}" ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage
      refuse "unknown argument: $1"
      ;;
  esac
  shift
done

command -v jq >/dev/null 2>&1 || refuse 'jq is required' 1
command -v gh >/dev/null 2>&1 || refuse 'gh is required' 1

if [ -z "$APP_ID" ]; then
  refuse 'the release GitHub App integration id is required (--release-app-id); it is not recorded in the repository and is never guessed'
fi
if ! [[ "$APP_ID" =~ ^[1-9][0-9]{0,11}$ ]]; then
  refuse "--release-app-id must be a positive integer, got: $APP_ID"
fi
if ! [[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  refuse "--repo must be owner/name, got: $REPO"
fi
[ -f "$CONFIG" ] || refuse "config not found: $CONFIG" 1

# Structural validation, by jq, of everything this script and the ruleset rely on.
# Each clause names what it guards so a refusal says which one broke.
VALIDATE="$(
  cat <<'JQ'
  def rule($t): [.ruleset.rules[]? | select(.type == $t)];
  [
    (if (.ruleset.name | type) == "string" and (.ruleset.name | length) > 0 then empty else "ruleset.name must be a non-empty string" end),
    (if .ruleset.target == "branch" then empty else "ruleset.target must be \"branch\"" end),
    (if .ruleset.enforcement == "active" then empty else "ruleset.enforcement must be \"active\"" end),
    (if (.ruleset.conditions.ref_name.include | type) == "array" and (.ruleset.conditions.ref_name.include | length) > 0 then empty else "ruleset.conditions.ref_name.include must be a non-empty array" end),
    (if (.ruleset.rules | type) == "array" then empty else "ruleset.rules must be an array" end),
    (if ([.ruleset.bypass_actors[]?] | length) == 1
        and .ruleset.bypass_actors[0].actor_type == "Integration"
        and .ruleset.bypass_actors[0].actor_id == null
        and .ruleset.bypass_actors[0].bypass_mode == "always"
     then empty else "ruleset.bypass_actors must be exactly one Integration entry with bypass_mode \"always\" and actor_id null (the id is supplied by --release-app-id)" end),
    (if (rule("pull_request") | length) == 1
        and (rule("pull_request")[0].parameters.required_approving_review_count | type) == "number"
        and rule("pull_request")[0].parameters.required_approving_review_count >= 1
        and rule("pull_request")[0].parameters.require_code_owner_review == true
        and rule("pull_request")[0].parameters.dismiss_stale_reviews_on_push == true
     then empty else "exactly one pull_request rule with >= 1 approval, code-owner review and stale-review dismissal is required" end),
    (if (rule("required_signatures") | length) == 1 then empty else "exactly one required_signatures rule is required" end),
    (if (rule("required_status_checks") | length) == 1 then empty else "exactly one required_status_checks rule is required" end),
    ([rule("required_status_checks")[0].parameters.required_status_checks[]?] as $checks
      | if ($checks | length) > 0
          and ($checks | all((.context | type) == "string" and (.context | length) > 0))
          and (($checks | map(.context) | unique | length) == ($checks | length))
        then empty else "required_status_checks must be a non-empty list of unique, non-empty contexts" end),
    (if (.excluded_checks | type) == "object" and (.excluded_checks | to_entries | all((.value | type) == "string" and (.value | length) > 0))
     then empty else "excluded_checks must map each excluded check name to a non-empty reason" end)
  ] | .[]
JQ
)"

if ! problems="$(jq -r "$VALIDATE" "$CONFIG" 2>&1)"; then
  refuse "malformed config $CONFIG: cannot be validated: $problems" 1
fi
if [ -n "$problems" ]; then
  refuse "malformed config $CONFIG:
$problems" 1
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ruleset.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT INT TERM

jq --argjson id "$APP_ID" '.ruleset | .bypass_actors[0].actor_id = $id' "$CONFIG" >"$WORK/payload.json"
NAME="$(jq -r '.name' "$WORK/payload.json")"

echo "=== Payload for $REPO (ruleset \"$NAME\")"
jq -S . "$WORK/payload.json"

if ! gh api --method GET "repos/$REPO/rulesets?includes_parents=false&per_page=100" >"$WORK/current.json"; then
  refuse "cannot list the rulesets of $REPO" 1
fi
jq -e 'type == "array"' "$WORK/current.json" >/dev/null ||
  refuse "unexpected rulesets listing for $REPO" 1

echo "=== Current rulesets on $REPO"
jq -r 'if length == 0 then "(none)" else .[] | "\(.id)\t\(.name)\t\(.enforcement)\t\(.target)" end' "$WORK/current.json"

matches="$(jq --arg name "$NAME" '[.[] | select(.name == $name)] | length' "$WORK/current.json")"
if [ "$matches" -gt 1 ]; then
  refuse "$matches rulesets are named \"$NAME\" on $REPO; resolve the duplicate by hand before re-running" 1
fi

existing_id=''
if [ "$matches" -eq 1 ]; then
  existing_id="$(jq -r --arg name "$NAME" '.[] | select(.name == $name) | .id' "$WORK/current.json")"
  [[ "$existing_id" =~ ^[0-9]+$ ]] || refuse "unexpected ruleset id: $existing_id" 1
  if ! gh api --method GET "repos/$REPO/rulesets/$existing_id" >"$WORK/existing.json"; then
    refuse "cannot read ruleset $existing_id on $REPO" 1
  fi
else
  echo '{}' >"$WORK/existing.json"
fi

# Compare only the fields this script writes, so server-added metadata (ids,
# timestamps, links, current_user_can_bypass) never shows up as drift.
COMPARABLE='{name, target, enforcement, conditions, bypass_actors, rules} | with_entries(select(.value != null))'
jq -S "$COMPARABLE" "$WORK/existing.json" >"$WORK/existing.cmp.json"
jq -S "$COMPARABLE" "$WORK/payload.json" >"$WORK/payload.cmp.json"

echo "=== Diff (current -> payload)"
diff_status=0
diff -u --label "current:$NAME" --label "payload:$NAME" \
  "$WORK/existing.cmp.json" "$WORK/payload.cmp.json" || diff_status=$?
case "$diff_status" in
  0) echo '(no change)' ;;
  1) ;;
  *) refuse 'diff failed' 1 ;;
esac

if [ "$APPLY" != true ]; then
  echo "=== Dry run: nothing was written. Review the diff, then re-run with --apply."
  exit 0
fi

if [ -n "$existing_id" ]; then
  echo "=== Applying: PUT repos/$REPO/rulesets/$existing_id"
  gh api --method PUT "repos/$REPO/rulesets/$existing_id" --input "$WORK/payload.json" >/dev/null
else
  echo "=== Applying: POST repos/$REPO/rulesets"
  gh api --method POST "repos/$REPO/rulesets" --input "$WORK/payload.json" >/dev/null
fi
echo "=== Applied. Verify with: gh api repos/$REPO/rules/branches/main"
