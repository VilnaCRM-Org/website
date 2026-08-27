#!/usr/bin/env bats
#
# Coverage for scripts/ci/check-dev-container-bind.sh (issue #399).
#
# docker-compose.yml pins `name: website`, so a second checkout on the same
# Docker daemon adopts the first checkout's `website-dev` container and every
# gate runs against the wrong `/app` bind -- silently green. This guard makes
# that loud again. It sits ahead of EVERY containerised gate, so the far more
# expensive failure would be a false positive: pin both the one case that must
# fail and every case that must stay out of the way.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/check-dev-container-bind.sh'

# A docker stub whose `inspect` prints $1 as the container's /app bind source and
# exits 0 -- i.e. the container EXISTS. An empty $1 therefore models a container
# with no /app mount, which is a different answer from "no such container": real
# `docker inspect` exits non-zero for the latter, and the guard treats only the
# non-zero case as unknown.
create_inspect_stub() {
  cat >"$STUB_BIN_DIR/docker" <<EOF
#!/usr/bin/env bash
if [ "\$1" = 'inspect' ]; then
  printf '%s' '${1}'
fi
exit 0
EOF
  chmod +x "$STUB_BIN_DIR/docker"
}

# `docker inspect` on a container that does not exist: a diagnostic on stderr and
# a non-zero exit.
create_missing_container_stub() {
  cat >"$STUB_BIN_DIR/docker" <<'EOF'
#!/usr/bin/env bash
if [ "$1" = 'inspect' ]; then
  echo 'Error: No such object: website-dev' >&2
  exit 1
fi
exit 0
EOF
  chmod +x "$STUB_BIN_DIR/docker"
}

run_guard() {
  run env PATH="$STUB_BIN_DIR:$PATH" EXPECTED_BIND="${1:?}" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
}

setup() {
  setup_stub_dir
}

# --- The one case that must fail -----------------------------------------------

@test "refuses a container bound to a different checkout" {
  create_inspect_stub '/home/dev/other-clone/website'

  run_guard '/home/dev/website'
  [ "$status" -eq 1 ]
  assert_output_contains 'belongs to a different checkout'
  # Both paths must be named, or the developer cannot tell which is which.
  assert_output_contains '/home/dev/other-clone/website'
  assert_output_contains '/home/dev/website'
  # And it must say how to get out of the state.
  assert_output_contains 'docker rm -f website-dev'
}

@test "names the container from DEV_CONTAINER when it is overridden" {
  create_inspect_stub '/somewhere/else'

  run env PATH="$STUB_BIN_DIR:$PATH" EXPECTED_BIND='/home/dev/website' \
    DEV_CONTAINER='website-dev-alt' bash "$PROJECT_ROOT/$SCRIPT_REL"
  [ "$status" -eq 1 ]
  assert_output_contains 'website-dev-alt'
}

# --- Everything else must fail OPEN --------------------------------------------

@test "passes when the container is bound to this checkout" {
  create_inspect_stub '/home/dev/website'

  run_guard '/home/dev/website'
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "passes when the container does not exist" {
  create_missing_container_stub

  run_guard '/home/dev/website'
  [ "$status" -eq 0 ]
}

@test "refuses a container that exists with no /app bind at all" {
  # Created from a different compose definition. --no-recreate would preserve it
  # and every gate would run against the source baked into the image rather than
  # this checkout -- positively wrong, not unknown, so this one does NOT fail
  # open the way a missing container or a broken daemon does.
  create_inspect_stub ''

  run_guard '/home/dev/website'
  [ "$status" -eq 1 ]
  assert_output_contains 'has no /app bind mount'
  assert_output_contains 'docker rm -f website-dev'
}

@test "passes when docker inspect fails" {
  # A daemon that is down, a permissions error, an unexpected format change --
  # none of them are evidence of a foreign checkout, and this guard must never
  # be the reason a working tree stops building.
  cat >"$STUB_BIN_DIR/docker" <<'EOF'
#!/usr/bin/env bash
echo 'Cannot connect to the Docker daemon' >&2
exit 1
EOF
  chmod +x "$STUB_BIN_DIR/docker"

  run_guard '/home/dev/website'
  [ "$status" -eq 0 ]
}

@test "passes when docker is not installed at all" {
  # EXEC_MODE=host developers have no docker; ensure-dev still evaluates this.
  # PATH is the (docker-free) stub dir alone, so bash is invoked by absolute
  # path -- otherwise the interpreter itself is what goes missing, and the test
  # would pass for the wrong reason.
  local bash_bin
  bash_bin="$(command -v bash)"

  run env PATH="$STUB_BIN_DIR" EXPECTED_BIND='/home/dev/website' \
    "$bash_bin" "$PROJECT_ROOT/$SCRIPT_REL"
  [ "$status" -eq 0 ]
}

@test "accepts a checkout reached through a symlink" {
  # Docker reports the mount source with symlinks already resolved; $PWD keeps
  # them. A symlinked ancestor (/tmp -> /private/tmp on macOS, a symlinked
  # worktree) would otherwise make a perfectly good checkout look foreign and
  # block every containerised gate -- the exact false positive this guard is
  # built to never produce.
  local real_dir="$BATS_TEST_TMPDIR/real-checkout"
  local link_dir="$BATS_TEST_TMPDIR/linked-checkout"
  mkdir -p "$real_dir"
  ln -s "$real_dir" "$link_dir"

  # Docker sees the physical path...
  create_inspect_stub "$(cd "$real_dir" && pwd -P)"
  # ...while the caller arrives through the symlink.
  run_guard "$link_dir"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "still refuses a foreign checkout when symlinks are involved" {
  # Resolving both sides must not collapse genuinely different trees together.
  local other_dir="$BATS_TEST_TMPDIR/other-real"
  local link_dir="$BATS_TEST_TMPDIR/mine-link"
  mkdir -p "$other_dir" "$BATS_TEST_TMPDIR/mine-real"
  ln -s "$BATS_TEST_TMPDIR/mine-real" "$link_dir"

  create_inspect_stub "$(cd "$other_dir" && pwd -P)"
  run_guard "$link_dir"
  [ "$status" -eq 1 ]
  assert_output_contains 'belongs to a different checkout'
}

@test "defaults EXPECTED_BIND to the working directory" {
  # ensure-dev passes no arguments, so the unset path is the one CI exercises.
  create_inspect_stub "$BATS_TEST_TMPDIR"

  run env -C "$BATS_TEST_TMPDIR" PATH="$STUB_BIN_DIR:$PATH" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
  [ "$status" -eq 0 ]

  create_inspect_stub '/definitely/not/here'
  run env -C "$BATS_TEST_TMPDIR" PATH="$STUB_BIN_DIR:$PATH" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
  [ "$status" -eq 1 ]
}
