#!/usr/bin/env bash
# Refuse to reuse a dev container that is not bound to THIS checkout (#399).
#
# docker-compose.yml pins `name: website` so the Compose project — and every
# container, volume and network prefix — is stable wherever the repo is cloned,
# and `container_name: website-dev` was already global before that. `ensure-dev`
# then runs `up -d --no-recreate`, which is load-bearing for CI (see the comment
# above that target) and must not be dropped.
#
# The combination has one bad case: a SECOND checkout on the same Docker daemon
# finds `website-dev` already running, adopts it because nothing distinguishes
# the two projects, and every gate then executes against the FIRST checkout's
# `/app` bind — silently green against the wrong source tree. Before the project
# name was pinned this surfaced as a loud "container name already in use".
#
# So keep it loud. Recreating instead would tear down the other checkout's dev
# server (and its anonymous node_modules volume) without asking, so refuse and
# let the developer decide.
#
# ensure-dev calls this TWICE: once before `up` so a foreign container is never
# even started, and once after, because the pre-check alone loses a race — two
# checkouts starting concurrently while no container exists both pass it, and
# the loser would otherwise run its gates against the winner's bind. The
# post-`up` call is the one that actually holds; the pre-`up` call is courtesy.
#
# Fails OPEN whenever it cannot determine the answer — no such container, no
# docker, an inspect error. It runs ahead of every containerised gate, so a
# false positive would be far more expensive than the case it catches; this is
# an ergonomics guard against a confusing local state, not a security boundary.
# It does NOT fail open on a container that exists with no `/app` bind at all:
# that one is positively wrong, not unknown.
set -euo pipefail

# Not overridable. The name is pinned by `container_name: website-dev` on the
# dev service in docker-compose.yml, and every recipe passes an explicit
# `-f docker-compose.yml`, so nothing this repo runs can start the container
# under another name. An override could therefore only point the guard at a
# container that does not exist — the fail-open path — while `up` adopted the
# real `website-dev` unchecked. EXPECTED_BIND stays overridable; the bats suite
# genuinely needs it.
CONTAINER='website-dev'

command -v docker >/dev/null 2>&1 || exit 0

# Compare PHYSICAL paths on both sides. Docker reports the mount source with
# every symlink already resolved, while $PWD deliberately preserves them, so a
# symlinked ancestor anywhere in the checkout path (/tmp -> /private/tmp on
# macOS, /home -> /System/Volumes/Data/home, a symlinked worktree) would leave a
# perfectly good checkout looking foreign and block every gate.
expected_raw="${EXPECTED_BIND:-$PWD}"
EXPECTED="$(cd "${expected_raw}" 2>/dev/null && pwd -P)" || EXPECTED="${expected_raw}"
[ -n "${EXPECTED}" ] || EXPECTED="${expected_raw}"

# A non-zero exit means "no such container" or a broken/absent daemon — both
# unknown, so fail open. A zero exit means the container exists and the output
# is authoritative, including when it is empty.
if ! mounted="$(
  docker inspect \
    -f '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}' \
    "${CONTAINER}" 2>/dev/null
)"; then
  exit 0
fi

if [ -z "${mounted}" ]; then
  cat >&2 <<MSG
ensure-dev: the existing '${CONTAINER}' container has no /app bind mount.

It was created from a different compose definition, so \`up -d --no-recreate\`
would keep it and every gate would run against the source baked into the image
instead of this checkout (${EXPECTED}).

Replace it:

  docker rm -f ${CONTAINER}

then re-run this target. To run without Docker instead, prefix with EXEC_MODE=host.
MSG
  exit 1
fi

# Resolve the reported source too: it is already physical on every runtime seen
# so far, but normalising both sides costs nothing and cannot introduce a false
# positive — a path that does not exist here falls back to its literal value.
resolved_mounted="$(cd "${mounted}" 2>/dev/null && pwd -P)" || resolved_mounted="${mounted}"
[ -n "${resolved_mounted}" ] || resolved_mounted="${mounted}"

[ "${resolved_mounted}" != "${EXPECTED}" ] || exit 0

cat >&2 <<MSG
ensure-dev: the running '${CONTAINER}' container belongs to a different checkout.

  its /app bind : ${mounted}
  this checkout : ${EXPECTED}

Compose reuses it because docker-compose.yml pins 'name: website', so every gate
would run against the other checkout's source instead of this one.

Fix by pointing the container at this checkout:

  docker compose -f docker-compose.yml down dev   # from ${mounted}, or:
  docker rm -f ${CONTAINER}

then re-run this target. To run without Docker instead, prefix with EXEC_MODE=host.
MSG
exit 1
