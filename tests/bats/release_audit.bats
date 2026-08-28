#!/usr/bin/env bats
#
# Coverage for scripts/ci/release-audit.sh and
# .github/workflows/release-audit.yml (issue #383) -- the release / bot-push
# audit trail.
#
# Everything here runs at PR time against a stubbed `gh`, because the real
# thing can otherwise only be exercised by cutting a release. The two
# invariants worth losing sleep over are pinned first-class: the workflow is
# triggered by pushes to main, so neither it nor the script may ever write to
# the repository (or the audit becomes its own infinite loop), and the ledger
# lookup must stay idempotent so an overlapping release/push/sweep produces one
# record rather than three.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/release-audit.sh'
WORKFLOW_REL='.github/workflows/release-audit.yml'
LEDGER_TITLE='Release and bot-push audit log'

# A `gh` double that logs its argv, serves canned JSON per endpoint, and applies
# the caller's own --jq filter with the real jq -- so the script's jq programs
# are genuinely executed rather than mocked away.
create_gh_stub() {
  cat >"$STUB_BIN_DIR/gh" <<'STUB'
#!/usr/bin/env bash
printf 'gh %s\n' "$*" >> "${COMMAND_LOG:?}"

jq_filter=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "--jq" ]; then jq_filter="$arg"; fi
  prev="$arg"
done

emit() {
  if [ -n "$jq_filter" ]; then
    printf '%s' "$1" | jq -r "$jq_filter"
  else
    printf '%s' "$1"
  fi
}

sub="${1:-}"
shift || true

case "$sub" in
  label)
    exit 0
    ;;
  issue)
    case "${1:-}" in
      list)
        case "$*" in
          *ci-alert*) emit "${FAKE_ALERT_LIST:-[]}" ;;
          *) emit "${FAKE_ISSUE_LIST:-[]}" ;;
        esac
        ;;
      create)
        printf 'https://github.com/o/r/issues/%s\n' "${FAKE_NEW_ISSUE_NUMBER:-7}"
        ;;
      *) : ;;
    esac
    exit 0
    ;;
  api)
    endpoint=""
    for arg in "$@"; do
      case "$arg" in
        -*) ;;
        *) if [ -z "$endpoint" ]; then endpoint="$arg"; fi ;;
      esac
    done
    empty_compare='{"commits":[]}'
    case "$endpoint" in
      */issues/*/comments*) emit "${FAKE_LEDGER_COMMENTS:-[]}" ;;
      */compare/*)
        if [ -n "${FAKE_COMPARE_FAIL:-}" ]; then
          echo 'gh: 502 Bad Gateway' >&2
          exit 1
        fi
        emit "${FAKE_COMPARE_JSON:-$empty_compare}"
        ;;
      */commits\?*)
        if [ -n "${FAKE_COMMIT_LIST_FAIL:-}" ]; then
          echo 'gh: 503 Service Unavailable' >&2
          exit 1
        fi
        emit "${FAKE_COMMIT_LIST:-[]}"
        ;;
      */commits/*)
        ref="${endpoint##*/commits/}"
        if [ -n "${FAKE_COMMIT_DIR:-}" ] && [ -f "$FAKE_COMMIT_DIR/$ref.json" ]; then
          emit "$(cat "$FAKE_COMMIT_DIR/$ref.json")"
        else
          echo 'gh: 404 Not Found' >&2
          exit 1
        fi
        ;;
      *) emit '{}' ;;
    esac
    exit 0
    ;;
esac
exit 0
STUB

  chmod +x "$STUB_BIN_DIR/gh"
}

# $1 sha/tag, $2 subject+body, $3 author name, $4 author email, $5 GitHub login,
# $6 account type, $7 verified (true|false), $8 verification reason.
write_commit() {
  jq -n \
    --arg sha "$1" --arg message "$2" --arg name "$3" --arg email "$4" \
    --arg login "$5" --arg type "$6" --argjson verified "$7" --arg reason "$8" \
    '{
       sha: $sha,
       author: { login: $login, type: $type },
       committer: { login: $login, type: $type },
       commit: {
         author: { name: $name, email: $email },
         committer: { name: $name, email: $email },
         message: $message,
         verification: { verified: $verified, reason: $reason }
       }
     }' >"$COMMIT_DIR/$1.json"
}

# Modelled on the real v0.4.0 release commit: authored and committed by
# `Conventional Changelog Action`, unsigned, and carrying [skip ci] -- which is
# precisely why a push-triggered workflow never sees it.
write_release_bot_commit() {
  write_commit "$1" "chore(release): ${2:-v0.4.0} [skip ci]" \
    'Conventional Changelog Action' 'conventional.changelog.action@github.com' \
    'vilnacrm-release[bot]' 'Bot' false unsigned
}

write_human_commit() {
  write_commit "$1" "$2" 'Rudoi Dmytro' 'irudoj63@gmail.com' \
    'RudoiDmytro' 'User' true valid
}

run_audit() {
  run env \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    GITHUB_STEP_SUMMARY="$SUMMARY" \
    FAKE_COMMIT_DIR="$COMMIT_DIR" \
    GH_TOKEN=stub-token \
    AUDIT_REPO='VilnaCRM-Org/website' \
    AUDIT_RUN_URL='https://example.test/actions/runs/1' \
    AUDIT_WORKFLOW_REF='VilnaCRM-Org/website/.github/workflows/release-audit.yml@refs/heads/main' \
    "$@" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
}

refute_log_contains() {
  local unexpected="$1"

  if grep -F -- "$unexpected" "$COMMAND_LOG" >/dev/null 2>&1; then
    echo "Expected command log NOT to contain: $unexpected" >&2
    echo "--- command log ---" >&2
    cat "$COMMAND_LOG" >&2
    return 1
  fi
}

setup() {
  setup_stub_dir
  create_gh_stub

  COMMIT_DIR="$BATS_TEST_TMPDIR/commits"
  mkdir -p "$COMMIT_DIR"
  SUMMARY="$BATS_TEST_TMPDIR/step-summary.md"
  : >"$SUMMARY"

  LEDGER_EXISTS="[{\"number\":7,\"title\":\"$LEDGER_TITLE\"}]"
}

# --- release path --------------------------------------------------------------

@test "records a release as a ledger comment carrying the tagged commit" {
  write_release_bot_commit v0.4.0

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=published \
    AUDIT_RELEASE_ID=42 \
    AUDIT_RELEASE_TAG=v0.4.0 \
    AUDIT_RELEASE_URL=https://example.test/releases/v0.4.0 \
    AUDIT_RELEASE_AUTHOR='vilnacrm-release[bot]' \
    AUDIT_RELEASE_AUTHOR_TYPE=Bot \
    AUDIT_ACTOR='vilnacrm-release[bot]' \
    AUDIT_SENDER='vilnacrm-release[bot]' \
    AUDIT_SENDER_TYPE=Bot

  [ "$status" -eq 0 ]
  assert_output_contains '## Release `v0.4.0` -- `published`'
  assert_output_contains 'chore(release): v0.4.0 [skip ci]'
  assert_output_contains 'signature: verified=false reason=unsigned'
  assert_output_contains 'bot or GitHub App identity'
  assert_output_contains 'https://example.test/actions/runs/1'
  assert_log_contains 'gh issue comment 7'
}

@test "mirrors the record into the GitHub step summary" {
  write_release_bot_commit v0.4.0

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=published \
    AUDIT_RELEASE_ID=42 \
    AUDIT_RELEASE_TAG=v0.4.0

  [ "$status" -eq 0 ]
  grep -Fq '## Release `v0.4.0`' "$SUMMARY"
  grep -Fq 'signature: verified=false' "$SUMMARY"
}

@test "creates the ledger issue only when no open issue carries that title" {
  write_release_bot_commit v0.4.0

  run_audit \
    FAKE_ISSUE_LIST='[{"number":3,"title":"Some unrelated issue"}]' \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=published \
    AUDIT_RELEASE_ID=42 \
    AUDIT_RELEASE_TAG=v0.4.0

  [ "$status" -eq 0 ]
  assert_log_contains "--label release-audit --title $LEDGER_TITLE"
  assert_log_contains 'gh issue comment 7'
}

@test "collapses the created and published events for one release" {
  write_release_bot_commit v0.4.0

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_LEDGER_COMMENTS='[{"body":"<!-- release-audit:release:42:created -->"}]' \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=published \
    AUDIT_RELEASE_ID=42 \
    AUDIT_RELEASE_TAG=v0.4.0

  [ "$status" -eq 0 ]
  assert_output_contains 'already recorded'
  refute_log_contains 'gh issue comment'
}

@test "does not collapse the publication of a release that was saved as a draft" {
  # `created` fires both when a DRAFT is saved and when a release is published
  # without one, on the same release id. Keying the class on the action alone let
  # the draft save occupy the marker, so the publication deduped against it and the
  # ledger's last word on the release stayed `draft=true`.
  write_release_bot_commit v0.4.0

  # Save the draft, then feed the record it wrote back as the ledger the
  # publication deduplicates against -- the sequence a maintainer actually
  # produces, inside the 48h dedup window.
  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=created \
    AUDIT_RELEASE_DRAFT=true \
    AUDIT_RELEASE_ID=42 \
    AUDIT_RELEASE_TAG=v0.4.0
  [ "$status" -eq 0 ]

  local draft_record
  draft_record="$(jq -nc --arg b "$output" '[{body: $b}]')"

  reset_command_log
  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_LEDGER_COMMENTS="$draft_record" \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=published \
    AUDIT_RELEASE_DRAFT=false \
    AUDIT_RELEASE_ID=42 \
    AUDIT_RELEASE_TAG=v0.4.0

  [ "$status" -eq 0 ]
  [[ "$output" != *'already recorded'* ]]
  assert_output_contains 'draft=`false`'
  assert_log_contains 'gh issue comment 7'
}

@test "records a saved draft under its own marker" {
  write_release_bot_commit v0.4.0

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=created \
    AUDIT_RELEASE_DRAFT=true \
    AUDIT_RELEASE_ID=42 \
    AUDIT_RELEASE_TAG=v0.4.0

  [ "$status" -eq 0 ]
  assert_output_contains '<!-- release-audit:release:42:draft -->'
  assert_output_contains 'draft=`true`'
}

@test "a release record carries the tagged commit marker the sweep dedups on" {
  # Only the release marker used to be written, so the daily sweep found no
  # `release-audit:commit:<sha>` for the tagged [skip ci] commit and posted a
  # second entry describing the identical commit -- and a second notification.
  write_release_bot_commit v0.4.0
  jq '.sha = "1091cc12"' "$COMMIT_DIR/v0.4.0.json" >"$COMMIT_DIR/resolved.json"
  mv "$COMMIT_DIR/resolved.json" "$COMMIT_DIR/v0.4.0.json"

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=published \
    AUDIT_RELEASE_ID=42 \
    AUDIT_RELEASE_TAG=v0.4.0

  [ "$status" -eq 0 ]
  assert_output_contains '<!-- release-audit:commit:1091cc12 -->'

  # ...and the sweep that follows within the dedup window therefore records nothing.
  reset_command_log
  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_COMMIT_LIST='[{"sha":"1091cc12"}]' \
    FAKE_LEDGER_COMMENTS='[{"body":"<!-- release-audit:commit:1091cc12 -->"}]' \
    AUDIT_EVENT=sweep

  [ "$status" -eq 0 ]
  assert_output_contains 'nothing unaudited'
  refute_log_contains 'gh issue comment'
}

@test "escalates a deleted release onto the ci-alert label" {
  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=deleted \
    AUDIT_RELEASE_ID=42 \
    AUDIT_RELEASE_TAG=v0.4.0 \
    AUDIT_SENDER=someone

  [ "$status" -eq 0 ]
  assert_log_contains '--label ci-alert'
  assert_log_contains 'release v0.4.0 was deleted'
}

@test "escalates a release published by an actor other than the expected bot" {
  write_release_bot_commit v0.4.0

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=published \
    AUDIT_RELEASE_ID=42 \
    AUDIT_RELEASE_TAG=v0.4.0 \
    AUDIT_RELEASE_AUTHOR=someone-else \
    AUDIT_EXPECTED_BOT='vilnacrm-release[bot]'

  [ "$status" -eq 0 ]
  assert_log_contains 'unexpected release author someone-else'
}

@test "records but does not escalate while the expected-bot variable is unset" {
  write_release_bot_commit v0.4.0

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=published \
    AUDIT_RELEASE_ID=42 \
    AUDIT_RELEASE_TAG=v0.4.0 \
    AUDIT_RELEASE_AUTHOR=someone-else

  [ "$status" -eq 0 ]
  assert_log_contains 'gh issue comment 7'
  refute_log_contains '--label ci-alert'
}

@test "reports an unresolvable tag instead of failing the run" {
  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=published \
    AUDIT_RELEASE_ID=42 \
    AUDIT_RELEASE_TAG=v9.9.9

  [ "$status" -eq 0 ]
  assert_output_contains 'could not be resolved'
  # No commit marker either: an unresolved tag must stay eligible for the sweep.
  [[ "$output" != *'release-audit:commit:'* ]]
}

# --- push path -----------------------------------------------------------------

@test "records author, committer, account type and signature for a pushed commit" {
  write_human_commit deadbeef 'fix(#383): tighten the audit'

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=push \
    AUDIT_BEFORE=0000000000000000000000000000000000000000 \
    AUDIT_AFTER=deadbeef \
    AUDIT_ACTOR=RudoiDmytro \
    AUDIT_PUSHER_NAME=RudoiDmytro \
    AUDIT_PUSHER_EMAIL=irudoj63@gmail.com \
    AUDIT_SENDER=RudoiDmytro \
    AUDIT_SENDER_TYPE=User

  [ "$status" -eq 0 ]
  assert_output_contains '## Push to `main` by `RudoiDmytro`'
  assert_output_contains 'author: `Rudoi Dmytro <irudoj63@gmail.com>`'
  assert_output_contains 'committer: `Rudoi Dmytro <irudoj63@gmail.com>`'
  assert_output_contains 'type: User'
  assert_output_contains 'signature: verified=true reason=valid'
  assert_output_contains 'identity is not proof of a human author'
}

@test "prints none when a commit declares no attribution trailer" {
  write_human_commit deadbeef 'fix(#383): no trailers here'

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=push \
    AUDIT_AFTER=deadbeef

  [ "$status" -eq 0 ]
  assert_output_contains 'declared trailers (self-declared, unverified): none'
}

@test "lists declared trailers and labels them unverified" {
  write_human_commit deadbeef \
    'fix(#383): squashed

Co-authored-by: dependabot[bot] <support@github.com>'

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=push \
    AUDIT_AFTER=deadbeef

  [ "$status" -eq 0 ]
  assert_output_contains 'declared trailers (self-declared, unverified): Co-authored-by: dependabot[bot] <support@github.com>'
}

@test "enumerates every commit of a push through the compare API" {
  write_human_commit c0ffee1 'feat(#383): one'
  write_human_commit c0ffee2 'feat(#383): two'

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_COMPARE_JSON='{"commits":[{"sha":"c0ffee1"},{"sha":"c0ffee2"}]}' \
    AUDIT_EVENT=push \
    AUDIT_BEFORE=aaaaaaa \
    AUDIT_AFTER=c0ffee2

  [ "$status" -eq 0 ]
  assert_log_contains 'compare/aaaaaaa...c0ffee2'
  assert_output_contains 'feat(#383): one'
  assert_output_contains 'feat(#383): two'
}

@test "leaves a commit whose metadata never arrived unmarked for the next sweep" {
  # The marker used to be written BEFORE the lookup, so a transient 5xx claimed the
  # commit as audited with no attribution at all -- and unrecoverably, because the
  # marker outlives the sweep window that would otherwise re-describe it.
  write_human_commit c0ffee1 'feat(#383): resolvable'

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_COMPARE_JSON='{"commits":[{"sha":"c0ffee1"},{"sha":"c0ffee9"}]}' \
    AUDIT_EVENT=push \
    AUDIT_BEFORE=aaaaaaa \
    AUDIT_AFTER=c0ffee9

  [ "$status" -eq 0 ]
  # The captured error distinguishes a deleted ref from an outage.
  assert_output_contains 'could not be resolved (gh: 404 Not Found)'
  assert_output_contains '<!-- release-audit:commit:c0ffee1 -->'
  [[ "$output" != *'release-audit:commit:c0ffee9'* ]]
}

@test "a failed compare is an incomplete record and an alert, not a silent one" {
  # The fallback used to substitute the head SHA and say nothing, so a push of ten
  # commits was recorded as an ordinary-looking single-commit entry.
  write_human_commit c0ffee2 'feat(#383): head only'

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_COMPARE_FAIL=1 \
    AUDIT_EVENT=push \
    AUDIT_BEFORE=aaaaaaa \
    AUDIT_AFTER=c0ffee2

  [ "$status" -eq 0 ]
  assert_output_contains 'incomplete record'
  assert_output_contains 'feat(#383): head only'
  assert_log_contains '--label ci-alert'
  assert_log_contains 'could not enumerate the commits of a push to main'
}

@test "fetches the ledger dedup window once per run, not once per commit" {
  # The window is identical for every marker and the ledger only gains a comment
  # after the record loop, so the second through fiftieth fetches could never
  # return anything the first did not.
  write_human_commit c0ffee1 'feat(#383): one'
  write_human_commit c0ffee2 'feat(#383): two'

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_COMPARE_JSON='{"commits":[{"sha":"c0ffee1"},{"sha":"c0ffee2"}]}' \
    AUDIT_EVENT=push \
    AUDIT_BEFORE=aaaaaaa \
    AUDIT_AFTER=c0ffee2

  [ "$status" -eq 0 ]
  [ "$(grep -c 'issues/7/comments' "$COMMAND_LOG")" -eq 1 ]
}

@test "skips a pushed commit that is already in the ledger" {
  write_human_commit deadbeef 'fix(#383): already audited'

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_LEDGER_COMMENTS='[{"body":"<!-- release-audit:commit:deadbeef -->"}]' \
    AUDIT_EVENT=push \
    AUDIT_AFTER=deadbeef

  [ "$status" -eq 0 ]
  assert_output_contains 'already in the ledger'
  refute_log_contains 'gh issue comment'
}

@test "escalates a force-push to main" {
  write_human_commit deadbeef 'fix(#383): rewritten history'

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=push \
    AUDIT_AFTER=deadbeef \
    AUDIT_FORCED=true \
    AUDIT_ACTOR=RudoiDmytro

  [ "$status" -eq 0 ]
  assert_output_contains 'force-push: `true`'
  assert_log_contains '--label ci-alert'
  assert_log_contains 'force-push to main by RudoiDmytro'
}

@test "still escalates a force-push whose commits are all already audited" {
  # Review finding: the zero-new-commit dedup return used to happen BEFORE the
  # escalation, so a force-push that merely restored audited commits — the case
  # most worth alerting on — was silently swallowed. Dedup must suppress ledger
  # noise, never a security signal.
  write_human_commit deadbeef 'fix(#383): restored history'

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_LEDGER_COMMENTS='[{"body":"<!-- release-audit:commit:deadbeef -->"}]' \
    AUDIT_EVENT=push \
    AUDIT_AFTER=deadbeef \
    AUDIT_FORCED=true \
    AUDIT_ACTOR=RudoiDmytro

  [ "$status" -eq 0 ]
  assert_output_contains 'already in the ledger'
  assert_log_contains 'force-push to main by RudoiDmytro'
}

@test "records the pusher login but never the pusher email" {
  write_human_commit deadbeef 'fix(#383): a push'

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=push \
    AUDIT_AFTER=deadbeef \
    AUDIT_PUSHER_NAME=RudoiDmytro \
    AUDIT_PUSHER_EMAIL=private@example.com

  [ "$status" -eq 0 ]
  assert_output_contains 'pusher: `RudoiDmytro`'
  # The ledger issue is public, indexed, and mailed to subscribers.
  [[ "$output" != *'private@example.com'* ]]
}

@test "escalates a bot push only once the expected bot is declared" {
  write_release_bot_commit deadbeef

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=push \
    AUDIT_AFTER=deadbeef \
    AUDIT_ACTOR='rogue-app[bot]'
  [ "$status" -eq 0 ]
  refute_log_contains '--label ci-alert'

  reset_command_log
  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_EVENT=push \
    AUDIT_AFTER=deadbeef \
    AUDIT_ACTOR='rogue-app[bot]' \
    AUDIT_EXPECTED_BOT='vilnacrm-release[bot]'
  [ "$status" -eq 0 ]
  assert_log_contains 'unexpected bot push to main by rogue-app[bot]'
}

# --- sweep path ----------------------------------------------------------------

@test "sweeps a [skip ci] release commit no push event could observe" {
  write_release_bot_commit 1091cc12

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_COMMIT_LIST='[{"sha":"1091cc12"}]' \
    AUDIT_EVENT=sweep

  [ "$status" -eq 0 ]
  assert_output_contains '## Daily sweep of `main`'
  assert_output_contains 'chore(release): v0.4.0 [skip ci]'
  assert_log_contains 'sha=main'
  assert_log_contains 'gh issue comment 7'
}

@test "sweep writes nothing when every recent commit is already recorded" {
  write_release_bot_commit 1091cc12

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_COMMIT_LIST='[{"sha":"1091cc12"}]' \
    FAKE_LEDGER_COMMENTS='[{"body":"<!-- release-audit:commit:1091cc12 -->"}]' \
    AUDIT_EVENT=sweep

  [ "$status" -eq 0 ]
  assert_output_contains 'nothing unaudited'
  refute_log_contains 'gh issue comment'
}

@test "a sweep that cannot list main escalates instead of going quietly green" {
  # The sweep is the LAST path still recording once the release and push paths are
  # blind, so a sustained outage here reopens the [skip ci] hole. The exit code
  # stays 0 -- one blip is reconciled by the next run -- and the alert is what makes
  # a repeat visible.
  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_COMMIT_LIST_FAIL=1 \
    AUDIT_EVENT=sweep

  [ "$status" -eq 0 ]
  assert_output_contains 'sweep could not list commits'
  assert_log_contains '--label ci-alert'
  assert_log_contains 'daily sweep could not list commits on main'
  refute_log_contains 'gh issue comment'
}

@test "a dry run of a failing sweep still writes nothing at all" {
  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_COMMIT_LIST_FAIL=1 \
    AUDIT_DRY_RUN=1 \
    AUDIT_EVENT=sweep

  [ "$status" -eq 0 ]
  assert_output_contains 'would alert'
  refute_log_contains 'gh issue create'
  refute_log_contains 'gh issue comment'
}

# --- dry run and misuse --------------------------------------------------------

@test "dry run prints the record and writes no ledger comment or alert" {
  write_human_commit deadbeef 'fix(#383): dry run'

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    AUDIT_DRY_RUN=1 \
    AUDIT_EVENT=push \
    AUDIT_AFTER=deadbeef \
    AUDIT_FORCED=true

  [ "$status" -eq 0 ]
  assert_output_contains '## Push to `main`'
  assert_output_contains 'dry run -- no comment written'
  assert_output_contains 'would alert'
  refute_log_contains 'gh issue comment'
  refute_log_contains 'gh issue create'
  refute_log_contains 'gh label create'
}

@test "dry run does not create the ledger issue when none exists yet" {
  # Without this guard `make release-audit-dry-run` would provision the ledger
  # issue and both labels on a repository that has never run the audit -- a
  # write, from a target whose whole point is that it cannot write.
  write_human_commit deadbeef 'fix(#383): dry run on a fresh repo'

  run_audit \
    AUDIT_DRY_RUN=1 \
    AUDIT_EVENT=push \
    AUDIT_AFTER=deadbeef

  [ "$status" -eq 0 ]
  assert_output_contains 'would create the ledger issue'
  refute_log_contains 'gh issue create'
  refute_log_contains 'gh label create'
}

@test "exits 2 on an unknown or missing AUDIT_EVENT" {
  run_audit AUDIT_EVENT=bogus
  [ "$status" -eq 2 ]
  assert_output_contains 'AUDIT_EVENT must be release|push|sweep'

  run_audit
  [ "$status" -eq 2 ]
}

@test "exits 2 when no repository is configured" {
  # `-u GITHUB_REPOSITORY` is load-bearing: GitHub Actions sets that variable for
  # every step, so without unsetting it the script finds a repository, never
  # reaches the guard, and this test passes locally while failing in CI.
  run env -u AUDIT_REPO -u GITHUB_REPOSITORY \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    AUDIT_EVENT=sweep \
    bash "$PROJECT_ROOT/$SCRIPT_REL"

  [ "$status" -eq 2 ]
  assert_output_contains 'AUDIT_REPO or GITHUB_REPOSITORY must be set'
}

# --- loop-safety and workflow invariants ---------------------------------------

@test "the audit script never invokes a version-control write" {
  # THE loop-safety invariant: this script is run by a workflow that pushes to
  # main trigger, so any repository write would make the audit its own trigger.
  run grep -nE '(^|[;&|(]|[[:space:]])git([[:space:]]|$)' "$PROJECT_ROOT/$SCRIPT_REL"
  [ "$status" -ne 0 ]
  [ -z "$output" ]
}

@test "the workflow grants no contents write scope" {
  run grep -n 'contents: *write' "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -ne 0 ]
  [ -z "$output" ]

  run grep -n 'contents: read' "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -eq 0 ]
}

@test "the workflow pins every action to a full 40-character SHA" {
  run grep -cE 'uses: [^@]+@[0-9a-f]{40} # v' "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -eq 0 ]
  [ "$output" -ge 1 ]

  run grep -nE '^\s*uses:' "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -eq 0 ]
  while read -r line; do
    [[ "$line" =~ @[0-9a-f]{40}\ \#\ v ]] || {
      echo "unpinned uses: $line" >&2
      return 1
    }
  done <<<"$output"
}

@test "the workflow checks out without persisting credentials" {
  run grep -n 'persist-credentials: false' "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -eq 0 ]
}

@test "the workflow declares an empty permission baseline and a job timeout" {
  run grep -nE '^permissions: \{\}$' "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -eq 0 ]

  run grep -nE '^ +timeout-minutes: [0-9]+$' "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -eq 0 ]

  run grep -n 'issues: write' "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -eq 0 ]
}

@test "the workflow concurrency group is constant, not ref-keyed" {
  # release runs on refs/tags/vX.Y.Z while push runs on refs/heads/main, and
  # both mutate the same ledger issue, so a ref-keyed group would let two runs
  # race to create it.
  run grep -nE '^ +group: \$\{\{ github\.workflow \}\}$' "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -eq 0 ]

  run grep -n 'cancel-in-progress: false' "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -eq 0 ]
}

@test "the workflow alerts when the audit run itself fails" {
  # raise_alert only ever fires on a run that SUCCEEDS, so a failed audit -- an API
  # outage, a bad token, a broken script -- would be a red X nobody is notified
  # about while the ledger quietly stops recording.
  run grep -nE '^ +if: failure\(\)$' "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -eq 0 ]

  run grep -n 'gh issue create --repo "$AUDIT_REPO" --label ci-alert' \
    "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -eq 0 ]
}

@test "the workflow never interpolates an expression inside a run block" {
  run awk '
    /^[[:space:]]*run:[[:space:]]*[|>]/ { inblock = 1; indent = match($0, /[^ ]/); next }
    inblock && /[^[:space:]]/ && match($0, /[^ ]/) <= indent { inblock = 0 }
    /^[[:space:]]*run:/ && /\$\{\{/ { print FNR ": " $0 }
    inblock && /\$\{\{/ { print FNR ": " $0 }
  ' "$PROJECT_ROOT/$WORKFLOW_REL"

  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "the workflow keeps all four event paths and defaults the dispatch to a dry run" {
  local body
  body="$(cat "$PROJECT_ROOT/$WORKFLOW_REL")"

  [[ "$body" == *"  release:"* ]]
  [[ "$body" == *"      - deleted"* ]]
  [[ "$body" == *"  push:"* ]]
  [[ "$body" == *"  schedule:"* ]]
  [[ "$body" == *"  workflow_dispatch:"* ]]

  run awk '/dry_run:/ { found = 1 } found && /default:/ { print $2; exit }' \
    "$PROJECT_ROOT/$WORKFLOW_REL"
  [ "$status" -eq 0 ]
  [ "$output" = 'true' ]
}

@test "an alert title containing a double quote still refreshes the existing alert" {
  # Review finding: the title was spliced into the jq PROGRAM, so a release tag
  # carrying a double quote produced a malformed filter, the exact-title lookup
  # returned nothing, and the escalation opened a DUPLICATE alert issue instead of
  # refreshing the open one. The observable difference is comment-vs-create.
  local tag='v1.0.0" or true #'
  local alert_title="Release audit: release ${tag} was deleted"

  run_audit \
    FAKE_ISSUE_LIST="$LEDGER_EXISTS" \
    FAKE_ALERT_LIST="$(jq -nc --arg t "$alert_title" '[{number:99,title:$t}]')" \
    AUDIT_EVENT=release \
    AUDIT_RELEASE_ACTION=deleted \
    AUDIT_RELEASE_TAG="$tag" \
    AUDIT_RELEASE_ID=42

  [ "$status" -eq 0 ]
  assert_log_contains 'gh issue comment 99'
  refute_log_contains 'gh issue create --repo VilnaCRM-Org/website --label ci-alert'
}
