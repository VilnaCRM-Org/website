#!/usr/bin/env sh
# scripts/ci/host-stack.sh - serve the static export and drive the browser
# suites on the host, with no Docker daemon (issue #338).
#
# The prod container does nothing but `serve out -p 3001` over the static
# export, and every API call in the e2e/visual specs is page.route-mocked, so
# the browser suites need the site and nothing else — no mockoon, no apollo.
# This script reproduces that one service on the host.
#
# The opt-in is HOST_STACK=1, deliberately NOT CI: GitHub Actions sets CI=true,
# the Makefile promotes that to CI=1, and the e2e/visual/memory-leak workflows
# already run the Docker stack in exactly that mode. Keying host mode on CI
# would silently move every one of them off Docker.
#
# Configuration comes from the environment (the Makefile passes it in) so the
# ports and paths stay defined in one place.
#
# Run it from the repository root: the Next.js build, the generated
# localization bundle and the Memlab runner all resolve their paths relative to
# the working directory.
set -eu

PORT="${PORT:-${NEXT_PUBLIC_PROD_PORT:-3001}}"
WEBSITE_DOMAIN="${WEBSITE_DOMAIN:-localhost}"
BIN_DIR="${BIN_DIR:-./node_modules/.bin}"

# The swagger page bakes `servers[0].url` in at build time and two e2e specs
# assert that literal string, so the patch step is pinned to the container's
# value instead of whatever NEXT_PUBLIC_API_BASE_URL the shell carries.
SWAGGER_SERVER_URL="${SWAGGER_SERVER_URL:-http://mockoon:8080}"

SITE_URL="http://${WEBSITE_DOMAIN}:${PORT}"

# Gitignored scratch dir: the pid lets `stop` be idempotent, and the log is the
# only place a background `serve` failure would otherwise be lost.
STATE_DIR="${HOST_STACK_STATE_DIR:-.host-stack}"
PID_FILE="${STATE_DIR}/serve.pid"
LOG_FILE="${STATE_DIR}/serve.log"

# Same budget as the Makefile's wait-for-prod-health target: 30 attempts x 2s.
READY_ATTEMPTS=30
READY_INTERVAL=2

usage() {
  printf 'Usage: %s <start|stop|status|browsers|memlab>\n\n' "$0" >&2
  printf '  start     Build the static export and serve it at %s\n' "$SITE_URL" >&2
  printf '  stop      Stop a previously started host server (idempotent)\n' >&2
  printf '  status    Exit 0 when the host server answers\n' >&2
  printf '  browsers  Install the Playwright browsers on the host\n' >&2
  printf '  memlab    Run the Memlab suite against the host server\n' >&2
}

site_answers() {
  curl -s -f "$SITE_URL" >/dev/null 2>&1
}

wait_for_site() {
  attempt=1
  while [ "$attempt" -le "$READY_ATTEMPTS" ]; do
    if site_answers; then
      printf '✅ Host prod stack is serving %s\n' "$SITE_URL"
      return 0
    fi
    sleep "$READY_INTERVAL"
    attempt=$((attempt + 1))
  done

  printf '❌ Timed out after %ss waiting for %s\n' \
    "$((READY_ATTEMPTS * READY_INTERVAL))" "$SITE_URL" >&2
  if [ -f "$LOG_FILE" ]; then
    printf -- '--- %s ---\n' "$LOG_FILE" >&2
    cat "$LOG_FILE" >&2
  fi
  return 1
}

# `kill -0` only proves *some* process holds that pid. Pids are recycled, so a
# stale pidfile — left by a reboot, a `kill -9`, or a crashed run — can name a
# process that has nothing to do with this stack, and `start` calls `stop` on
# every invocation. Confirm the pid is still the `serve` we launched before
# signalling it, and otherwise drop the pidfile without touching anything.
serve_process_matches() {
  pid="$1"
  command_line="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"

  case "$command_line" in
    *serve*"$PORT"*) return 0 ;;
    *) return 1 ;;
  esac
}

cmd_stop() {
  if [ ! -f "$PID_FILE" ]; then
    return 0
  fi

  pid="$(cat "$PID_FILE")"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && serve_process_matches "$pid"; then
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
}

cmd_start() {
  # Never leave two servers fighting over the port across repeated runs.
  cmd_stop
  mkdir -p "$STATE_DIR"

  node scripts/generateLocalization.mjs
  NEXT_PUBLIC_API_BASE_URL="$SWAGGER_SERVER_URL" node scripts/patchSwaggerServer.mjs
  "$BIN_DIR/next" build --webpack
  "$BIN_DIR/next-export-optimize-images"

  # nohup so the server outlives the parent Make process that started it.
  nohup "$BIN_DIR/serve" -l "$PORT" out >"$LOG_FILE" 2>&1 &
  printf '%s\n' "$!" >"$PID_FILE"

  wait_for_site
}

cmd_status() {
  site_answers
}

cmd_browsers() {
  # Explicit and never implicit inside `start`, so a missing browser fails with
  # Playwright's own error instead of a mid-suite launch crash.
  "$BIN_DIR/playwright" install chromium firefox webkit

  # The browser binaries are self-contained; the shared libraries they link
  # against are not. WebKit in particular needs OS packages (libavif, libwoff,
  # gstreamer...) that a desktop install usually lacks, and it fails at launch
  # rather than at install — 100+ identical "Host system is missing
  # dependencies" errors, one per test. Installing them needs root, so this
  # prints the command instead of running it.
  printf '\n'
  printf 'ℹ️  Browsers installed. If a suite fails at launch with "Host system is missing\n'
  printf '   dependencies" (WebKit is the usual one), install the OS libraries too:\n'
  printf '     sudo %s install-deps chromium firefox webkit\n' "$BIN_DIR/playwright"
}

cmd_memlab() {
  # Memlab profiles a live page, so a stack that is not up produces a wall of
  # navigation errors rather than a legible failure.
  if ! site_answers; then
    printf '❌ Nothing is serving %s. Start the host stack first: %s start\n' \
      "$SITE_URL" "$0" >&2
    return 1
  fi

  node scripts/generateLocalization.mjs

  # Parity with the container recipe, which clears the results before every run:
  # Memlab appends per-scenario directories, so a stale set from an earlier run
  # would be reported alongside the current one.
  rm -rf ./src/test/memory-leak/results

  # Same Chrome hardening the container recipe applies: DISPLAY must be unset so
  # puppeteer stays headless, and the single-process/no-sandbox flags keep it
  # alive inside constrained runners.
  unset DISPLAY
  PUPPETEER_PROTOCOL_TIMEOUT=240000
  PUPPETEER_ARGS='--no-sandbox --disable-dev-shm-usage --disable-gpu --single-process --no-zygote --disable-setuid-sandbox'
  CHROME_ARGS="$PUPPETEER_ARGS"
  export PUPPETEER_PROTOCOL_TIMEOUT PUPPETEER_ARGS CHROME_ARGS

  NEXT_PUBLIC_API_BASE_URL="$SITE_URL" node ./src/test/memory-leak/runMemlabTests.js
}

case "${1:-}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  status) cmd_status ;;
  browsers) cmd_browsers ;;
  memlab) cmd_memlab ;;
  *)
    usage
    exit 1
    ;;
esac
