#!/usr/bin/env bash
# Audit trail and alerting for releases and automated pushes to main (#383).
#
# LOOP SAFETY -- the single most important property of this file. The workflow
# that runs it (.github/workflows/release-audit.yml) is triggered BY pushes to
# `main`, and the release bot pushes CHANGELOG.md to `main`. This script must
# therefore never write to the repository. Its only mutations are GitHub issue
# creation and issue comments made with GITHUB_TOKEN; events raised by
# GITHUB_TOKEN do not start new workflow runs, so a ledger comment can never
# re-enter the workflow. There is no version-control write of any kind in this
# file, and tests/bats/release_audit.bats asserts that invariant directly.
#
# WHY A SWEEP EXISTS -- the release bot commits `chore(release): vX.Y.Z
# [skip ci]` and GitHub skips push-triggered runs for such commits, so a
# push-only audit is structurally blind to exactly the push it exists to audit.
# The `release` event and the daily sweep cover that hole.
#
# Requires: gh (authenticated through GH_TOKEN), jq, and GNU date.
set -euo pipefail

REPO="${AUDIT_REPO:-${GITHUB_REPOSITORY:-}}"
if [ -z "$REPO" ]; then
  echo "release-audit: AUDIT_REPO or GITHUB_REPOSITORY must be set" >&2
  exit 2
fi

EVENT="${AUDIT_EVENT:-}"
DRY_RUN="${AUDIT_DRY_RUN:-0}"
LEDGER_LABEL="${AUDIT_LEDGER_LABEL:-release-audit}"
ALERT_LABEL="${AUDIT_ALERT_LABEL:-ci-alert}"
# One permanent ledger issue. Deliberately NOT rotated per year: the dedup
# lookup below is time-bounded rather than ledger-size-bounded, so growth is a
# readability question only, and a rotating title would silently unsubscribe
# every maintainer once a year.
LEDGER_TITLE="${AUDIT_LEDGER_TITLE:-Release and bot-push audit log}"
DEDUP_HOURS="${AUDIT_DEDUP_WINDOW_HOURS:-48}"
SWEEP_HOURS="${AUDIT_SWEEP_WINDOW_HOURS:-25}"
MAX_COMMITS="${AUDIT_MAX_COMMITS:-50}"
# Opt-in. While RELEASE_BOT_ACTOR is unset every event is still RECORDED and
# only the "unexpected bot" escalation is suppressed -- a guessed default would
# raise a false alert on every single release.
EXPECTED_BOT="${AUDIT_EXPECTED_BOT:-}"
RUN_URL="${AUDIT_RUN_URL:-(local run)}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
BODY="$WORK/body.md"
: >"$BODY"

note() { printf '%s\n' "$*" >&2; }
add() { printf '%s\n' "$*" >>"$BODY"; }
# Dedup marker. Rendered as an HTML comment so it is invisible in the issue but
# greppable by the next run.
mark() { add "<!-- $1 -->"; }
iso_since() { date -u -d "-$1 hours" +%Y-%m-%dT%H:%M:%SZ; }

ensure_label() {
  # A dry run must be READ-ONLY end to end, and label creation is a write.
  if [ "$DRY_RUN" = '1' ]; then
    return 0
  fi
  gh label create "$1" --repo "$REPO" --color "$2" --description "$3" \
    >/dev/null 2>&1 || true
}

# The ledger issue: found by exact title, created on first use.
ledger_number() {
  local found created
  found="$(gh issue list --repo "$REPO" --label "$LEDGER_LABEL" --state open \
    --search "$LEDGER_TITLE in:title" --json number,title \
    --jq "map(select(.title == \"$LEDGER_TITLE\")) | .[0].number // empty")"
  if [ -n "$found" ]; then
    printf '%s' "$found"
    return 0
  fi
  if [ "$DRY_RUN" = '1' ]; then
    note "release-audit: dry run -- would create the ledger issue '$LEDGER_TITLE'"
    printf '0'
    return 0
  fi
  created="$(gh issue create --repo "$REPO" --label "$LEDGER_LABEL" \
    --title "$LEDGER_TITLE" --body "$(ledger_seed_body)")"
  printf '%s' "${created##*/}"
}

ledger_seed_body() {
  cat <<'SEED'
Audit trail of releases and pushes to `main`, appended by
`.github/workflows/release-audit.yml` (issue #383). One comment per event.

Subscribe to this issue to be notified of every release and every push to
`main`. See `docs/release-audit.md` for the record format and, importantly,
for what this ledger can and cannot prove.
SEED
}

# Time-bounded so the lookup cost does not grow with the ledger. A pure-bash
# substring test (not `grep -q`) so a short-circuited pipe cannot trip pipefail.
already_recorded() {
  local bodies
  bodies="$(gh api \
    "repos/$REPO/issues/$1/comments?per_page=100&since=$(iso_since "$DEDUP_HOURS")" \
    --paginate --jq '.[].body' 2>/dev/null || true)"
  case "$bodies" in
    *"$2"*) return 0 ;;
    *) return 1 ;;
  esac
}

post_record() {
  local ledger="$1"
  if [ ! -s "$BODY" ]; then
    note "release-audit: nothing new to record"
    return 0
  fi
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    cat "$BODY" >>"$GITHUB_STEP_SUMMARY"
  fi
  cat "$BODY"
  if [ "$DRY_RUN" = '1' ]; then
    note "release-audit: dry run -- no comment written to #$ledger"
    return 0
  fi
  gh issue comment "$ledger" --repo "$REPO" --body-file "$BODY" >/dev/null
}

raise_alert() {
  local title="$1" detail="$2" existing body
  body="$detail

Run: $RUN_URL"
  if [ "$DRY_RUN" = '1' ]; then
    note "release-audit: dry run -- would alert: $title"
    return 0
  fi
  ensure_label "$ALERT_LABEL" B60205 'Deploy/release/red-main CI health alerts'
  # `--search ... in:title` is a fuzzy match, so filter to an EXACT title the way
  # ledger_number does. Without this an unrelated open ci-alert issue can absorb a
  # force-push or unexpected-bot escalation and the real signal is never filed.
  existing="$(gh issue list --repo "$REPO" --label "$ALERT_LABEL" --state open \
    --search "$title in:title" --json number,title \
    --jq "map(select(.title == \"$title\")) | .[0].number // empty")"
  if [ -n "$existing" ]; then
    gh issue comment "$existing" --repo "$REPO" --body "$body" >/dev/null
  else
    gh issue create --repo "$REPO" --label "$ALERT_LABEL" --label "$LEDGER_LABEL" \
      --title "$title" --body "$body" >/dev/null
  fi
}

# Honest classification. A `[bot]` suffix is a real, server-side identity; the
# absence of one proves nothing about who or what authored the change.
actor_class() {
  case "$1" in
    *'[bot]') printf 'bot or GitHub App identity' ;;
    *) printf 'no [bot] suffix; identity is not proof of a human author' ;;
  esac
}

is_bot() {
  case "$1" in
    *'[bot]') return 0 ;;
    *) return 1 ;;
  esac
}

# The strongest attribution that is actually verifiable from inside this repo:
# author vs committer, the linked GitHub login and account type, and the
# signature verification state. Message trailers are reported when present and
# labelled self-declared, because they are unauthenticated even when they exist.
describe_commit() {
  local sha="$1"
  if ! gh api "repos/$REPO/commits/$sha" >"$WORK/commit.json" 2>/dev/null; then
    add "- commit \`$sha\`: could not be resolved (deleted tag or unreachable ref)"
    return 0
  fi
  jq -r '
    def txt(v): (v // "unknown");
    "- commit `\(txt(.sha))`",
    "  - subject: `\((.commit.message // "") | split("\n")[0])`",
    "  - author: `\(txt(.commit.author.name)) <\(txt(.commit.author.email))>`"
      + " (github: \(.author.login // "unlinked"), type: \(.author.type // "n/a"))",
    "  - committer: `\(txt(.commit.committer.name)) <\(txt(.commit.committer.email))>`"
      + " (github: \(.committer.login // "unlinked"), type: \(.committer.type // "n/a"))",
    "  - signature: verified=\(.commit.verification.verified // false)"
      + " reason=\(.commit.verification.reason // "unknown")",
    "  - declared trailers (self-declared, unverified): \(
        [(.commit.message // "") | split("\n")[]
          | select(test("^[A-Za-z][A-Za-z-]*-by:"; "i"))]
        | if length == 0 then "none" else join("; ") end)"
  ' "$WORK/commit.json" >>"$BODY"
}

provenance() {
  local actor="${AUDIT_ACTOR:-unknown}"
  add ""
  add "Provenance:"
  add ""
  add "- actor: \`$actor\` ($(actor_class "$actor"))"
  add "- triggering actor: \`${AUDIT_TRIGGERING_ACTOR:-unknown}\`"
  add "- sender: \`${AUDIT_SENDER:-unknown}\` (type \`${AUDIT_SENDER_TYPE:-unknown}\`)"
  add "- workflow: \`${AUDIT_WORKFLOW_REF:-unknown}\`"
  add "- run: $RUN_URL"
  add "- recorded at $(date -u +%Y-%m-%dT%H:%M:%SZ) by \`scripts/ci/release-audit.sh\`"
}

handle_release() {
  local action="${AUDIT_RELEASE_ACTION:-unknown}" id="${AUDIT_RELEASE_ID:-0}"
  local tag="${AUDIT_RELEASE_TAG:-}" class marker ledger
  # `created` and `published` both fire when a release is published without a
  # draft; collapsing them into one class makes the second event a no-op.
  case "$action" in
    created | published | prereleased | released) class='created' ;;
    edited) class="edited:${AUDIT_RELEASE_UPDATED_AT:-unknown}" ;;
    *) class="$action" ;;
  esac
  # A workflow_dispatch audit has no release ID, so every manual run would share
  # the marker `...:0:created` and dedup every tag after the first. Fall back to
  # the tag, which is unique per release.
  if [ -z "$id" ] || [ "$id" = '0' ]; then
    id="tag-${tag:-unknown}"
  fi
  marker="release-audit:release:${id}:${class}"
  ledger="$(ledger_number)"
  if already_recorded "$ledger" "$marker"; then
    note "release-audit: release $id/$class already recorded"
    return 0
  fi
  add "## Release \`${tag:-unknown}\` -- \`${action}\`"
  mark "$marker"
  add ""
  add "- release: ${AUDIT_RELEASE_URL:-n/a} (id \`${id}\`)"
  add "- published by: \`${AUDIT_RELEASE_AUTHOR:-unknown}\` (type \`${AUDIT_RELEASE_AUTHOR_TYPE:-unknown}\`)"
  add "- draft=\`${AUDIT_RELEASE_DRAFT:-unknown}\` prerelease=\`${AUDIT_RELEASE_PRERELEASE:-unknown}\`"
  if [ "$action" != 'deleted' ] && [ -n "$tag" ]; then
    add ""
    add "Tagged commit (for a bot release this is the \`[skip ci]\` push to main,"
    add "which no push-triggered workflow can observe):"
    describe_commit "$tag"
  fi
  provenance
  post_record "$ledger"
  if [ "$action" = 'deleted' ] || [ "$action" = 'edited' ]; then
    raise_alert "Release audit: release ${tag:-unknown} was ${action}" \
      "A release was \`${action}\` by \`${AUDIT_SENDER:-unknown}\`. Releases are immutable by convention; confirm this was intentional."
  fi
  if [ -n "$EXPECTED_BOT" ] && [ "${AUDIT_RELEASE_AUTHOR:-}" != "$EXPECTED_BOT" ]; then
    raise_alert "Release audit: unexpected release author ${AUDIT_RELEASE_AUTHOR:-unknown}" \
      "Release \`${tag:-unknown}\` was published by \`${AUDIT_RELEASE_AUTHOR:-unknown}\`, not the expected release App \`${EXPECTED_BOT}\`."
  fi
}

# github.event.commits[] truncates at 20 entries; the compare API does not.
# The cap is applied inside jq rather than by piping through head/tail: a
# truncating reader would SIGPIPE gh and trip pipefail. compare returns commits
# oldest-first, so the newest MAX_COMMITS are the tail of the array.
list_pushed_commits() {
  local before="$1" after="$2"
  case "$before" in
    '' | 0000000000000000000000000000000000000000)
      printf '%s\n' "$after"
      return 0
      ;;
  esac
  gh api "repos/$REPO/compare/${before}...${after}" \
    --jq "[.commits[].sha] | .[-${MAX_COMMITS}:] | .[]" 2>/dev/null ||
    printf '%s\n' "$after"
}

record_commits() {
  local ledger="$1" recorded=0 sha
  while read -r sha; do
    [ -n "$sha" ] || continue
    if already_recorded "$ledger" "release-audit:commit:${sha}"; then continue; fi
    mark "release-audit:commit:${sha}"
    describe_commit "$sha"
    recorded=$((recorded + 1))
  done
  printf '%s' "$recorded"
}

# Escalations are a SECURITY signal, not a record, so they are evaluated
# independently of ledger dedup: a force-push that only restores commits already
# in the ledger is still a force-push, and it is exactly the case dedup would
# otherwise swallow.
escalate_push_anomalies() {
  local actor="$1"
  if [ "${AUDIT_FORCED:-false}" = 'true' ]; then
    raise_alert "Release audit: force-push to main by ${actor}" \
      "\`main\` was force-pushed by \`${actor}\` (${AUDIT_BEFORE:-?} -> ${AUDIT_AFTER:-?}). Confirm this was intentional."
  fi
  if [ -n "$EXPECTED_BOT" ] && is_bot "$actor" && [ "$actor" != "$EXPECTED_BOT" ]; then
    raise_alert "Release audit: unexpected bot push to main by ${actor}" \
      "\`main\` was pushed by bot \`${actor}\`, which is not the expected release App \`${EXPECTED_BOT}\`."
  fi
}

handle_push() {
  local ledger recorded actor="${AUDIT_ACTOR:-unknown}"
  ledger="$(ledger_number)"
  add "## Push to \`main\` by \`${actor}\`"
  add ""
  # Login only, never the pusher's email. Commit author/committer addresses are
  # already public through the commits API, but the pusher address is the
  # account's push email and this record lands in an issue that is public,
  # indexed, and mailed to every subscriber.
  add "- pusher: \`${AUDIT_PUSHER_NAME:-unknown}\`"
  add "- sender type: \`${AUDIT_SENDER_TYPE:-unknown}\` ($(actor_class "$actor"))"
  add "- force-push: \`${AUDIT_FORCED:-false}\`"
  add ""
  recorded="$(list_pushed_commits "${AUDIT_BEFORE:-}" "${AUDIT_AFTER:-}" |
    record_commits "$ledger")"
  if [ "$recorded" -eq 0 ]; then
    note "release-audit: every pushed commit is already in the ledger"
    : >"$BODY"
    escalate_push_anomalies "$actor"
    return 0
  fi
  provenance
  post_record "$ledger"
  escalate_push_anomalies "$actor"
}

# Backstop for [skip ci]: reconcile the last SWEEP_HOURS of main against the
# ledger. This is the path that catches the release bot's changelog commit when
# the release step itself never ran.
handle_sweep() {
  local ledger recorded
  ledger="$(ledger_number)"
  add "## Daily sweep of \`main\`"
  add ""
  add "Commits on \`main\` in the last ${SWEEP_HOURS}h that no push-triggered"
  add "audit observed (a \`[skip ci]\` commit skips every push workflow):"
  add ""
  # The commits API returns newest-first, so the cap is the HEAD of the array
  # (a `tail` here would audit the oldest commits in the window instead).
  # The sweep is the backstop for [skip ci] commits no push event can observe, so
  # a transient API blip must not take the whole run down with `set -e`: log it
  # loudly and record nothing this cycle. The next scheduled run reconciles the
  # same window (SWEEP_HOURS > the 24h cadence), so no commit is lost.
  local shas
  if ! shas="$(gh api \
    "repos/$REPO/commits?sha=main&per_page=100&since=$(iso_since "$SWEEP_HOURS")" \
    --jq "[.[].sha] | .[0:${MAX_COMMITS}] | .[]" 2>&1)"; then
    note "release-audit: sweep could not list commits (${shas}); the next run retries the same window"
    : >"$BODY"
    return 0
  fi
  recorded="$(printf '%s\n' "$shas" | record_commits "$ledger")"
  if [ "$recorded" -eq 0 ]; then
    note "release-audit: sweep found nothing unaudited"
    : >"$BODY"
    return 0
  fi
  provenance
  post_record "$ledger"
}

ensure_label "$LEDGER_LABEL" 0E8A16 'Audit trail of releases and pushes to main'

case "$EVENT" in
  release) handle_release ;;
  push) handle_push ;;
  sweep) handle_sweep ;;
  *)
    note "release-audit: AUDIT_EVENT must be release|push|sweep (got '${EVENT}')"
    exit 2
    ;;
esac
