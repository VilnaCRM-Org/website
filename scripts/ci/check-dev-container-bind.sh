#!/usr/bin/env bash
# Refuse to reuse a dev container that belongs to a different checkout (#399).
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
# Fails OPEN on anything it cannot determine — no container, no docker, an
# inspect error, or an empty mount list. This is an ergonomics guard against a
# confusing local state, not a security boundary, and it runs ahead of every
# gate: it must never be the reason a working checkout stops building.
set -euo pipefail

CONTAINER="${DEV_CONTAINER:-website-dev}"
EXPECTED="${EXPECTED_BIND:-$PWD}"

command -v docker >/dev/null 2>&1 || exit 0

# Empty when the container does not exist, when it has no /app bind, or when
# inspect fails for any reason — all of which mean "nothing to contradict".
mounted="$(
  docker inspect \
    -f '{{range .Mounts}}{{if eq .Destination "/app"}}{{.Source}}{{end}}{{end}}' \
    "${CONTAINER}" 2>/dev/null || true
)"

[ -n "${mounted}" ] || exit 0
[ "${mounted}" != "${EXPECTED}" ] || exit 0

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
