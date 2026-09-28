#!/usr/bin/env sh
# Provision the pinned actionlint and the shellcheck it drives into ./bin
# (idempotent, SHA256-verified). Issue #322.
#
# actionlint is a standalone Go binary and shellcheck a standalone Haskell one;
# neither is an npm dependency, so neither can run through PM_EXEC / the dev
# container. This gives `make lint-actionlint` (local) and workflow-security.yml
# one reproducible provisioning path to the gitignored ./bin — the same shape as
# scripts/ci/ensure-osv.sh.
#
# The shellcheck binary is pinned as well, because actionlint's verdict includes
# every finding it reports for a `run:` body. Left to whatever copy the runner
# image or a laptop happens to carry, a runner-image bump could turn the gate red
# (or green) with no change in this repository.
#
# The versions and their digests are ONE fact each and are deliberately NOT
# overridable from the environment: an override would download another release
# and verify it against these digests, which can only ever fail. Upgrading means
# editing this block — version and all four digests together — in a reviewed diff.
#   For actionlint: copied from the release's actionlint_<version>_checksums.txt
#     https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_checksums.txt
#   For shellcheck: upstream publishes no checksums file; the digests are the ones
#     GitHub records for each release asset (`gh api
#     repos/koalaman/shellcheck/releases/tags/v0.11.0 --jq '.assets[].digest'`).
set -eu

ACTIONLINT_BIN="${ACTIONLINT_BIN:-./bin/actionlint}"
SHELLCHECK_BIN="${SHELLCHECK_BIN:-./bin/shellcheck}"

ACTIONLINT_VERSION='1.7.12'
ACTIONLINT_SHA256_LINUX_AMD64='8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8'
ACTIONLINT_SHA256_LINUX_ARM64='325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6'
ACTIONLINT_SHA256_DARWIN_AMD64='5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644'
ACTIONLINT_SHA256_DARWIN_ARM64='aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f'

SHELLCHECK_VERSION='0.11.0'
SHELLCHECK_SHA256_LINUX_AMD64='b7af85e41cc99489dcc21d66c6d5f3685138f06d34651e6d34b42ec6d54fe6f6'
SHELLCHECK_SHA256_LINUX_ARM64='68a8133197a50beb8803f8d42f9908d1af1c5540d4bb05fdfca8c1fa47decefc'
SHELLCHECK_SHA256_DARWIN_AMD64='c2c15e08df0e8fbc374c335b230a7ee958c313fa5714817a59aa59f1aa594f51'
SHELLCHECK_SHA256_DARWIN_ARM64='339b930feb1ea764467013cc1f72d09cd6b869ebf1013296ba9055ab2ffbd26f'

# -Fxq on the first line of `actionlint -version` (which prints the bare
# version) and -Fwq on shellcheck's `version: X` line: 1.7.120 must not satisfy
# 1.7.12.
actionlint_current() {
  [ -x "$ACTIONLINT_BIN" ] &&
    "$ACTIONLINT_BIN" -version 2>/dev/null | head -n 1 | grep -Fxq "$ACTIONLINT_VERSION"
}

shellcheck_current() {
  [ -x "$SHELLCHECK_BIN" ] &&
    "$SHELLCHECK_BIN" --version 2>/dev/null | grep -Fwq "version: $SHELLCHECK_VERSION"
}

if actionlint_current && shellcheck_current; then
  exit 0
fi

os="$(uname -s)"
arch="$(uname -m)"

case "$os" in
  Linux) platform_os='linux' ;;
  Darwin) platform_os='darwin' ;;
  *)
    printf 'ERROR: no pinned actionlint/shellcheck asset for %s\n' "$os" >&2
    exit 1
    ;;
esac

case "$arch" in
  x86_64 | amd64) platform_arch='amd64' ;;
  aarch64 | arm64) platform_arch='arm64' ;;
  *)
    printf 'ERROR: no pinned actionlint/shellcheck asset for %s/%s\n' "$os" "$arch" >&2
    exit 1
    ;;
esac

case "${platform_os}_${platform_arch}" in
  linux_amd64)
    actionlint_sha="$ACTIONLINT_SHA256_LINUX_AMD64"
    shellcheck_sha="$SHELLCHECK_SHA256_LINUX_AMD64"
    shellcheck_platform='linux.x86_64'
    ;;
  linux_arm64)
    actionlint_sha="$ACTIONLINT_SHA256_LINUX_ARM64"
    shellcheck_sha="$SHELLCHECK_SHA256_LINUX_ARM64"
    shellcheck_platform='linux.aarch64'
    ;;
  darwin_amd64)
    actionlint_sha="$ACTIONLINT_SHA256_DARWIN_AMD64"
    shellcheck_sha="$SHELLCHECK_SHA256_DARWIN_AMD64"
    shellcheck_platform='darwin.x86_64'
    ;;
  *)
    actionlint_sha="$ACTIONLINT_SHA256_DARWIN_ARM64"
    shellcheck_sha="$SHELLCHECK_SHA256_DARWIN_ARM64"
    shellcheck_platform='darwin.aarch64'
    ;;
esac

tmp="$(mktemp -d "${TMPDIR:-/tmp}/actionlint-install.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT INT TERM

# Diagnostics go to STDERR, like ensure-osv.sh: `set -eu` still aborts on a
# digest mismatch and the FAILED line stays visible.
fetch_verified() {
  url="$1"
  file="$2"
  expected="$3"
  curl -fsSL \
    --retry 3 \
    --retry-all-errors \
    --connect-timeout 10 \
    --max-time 120 \
    "$url" -o "$tmp/$file"
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s  %s\n' "$expected" "$tmp/$file" | sha256sum -c - >&2
  else
    printf '%s  %s\n' "$expected" "$tmp/$file" | shasum -a 256 -c - >&2
  fi
}

if ! actionlint_current; then
  asset="actionlint_${ACTIONLINT_VERSION}_${platform_os}_${platform_arch}.tar.gz"
  fetch_verified \
    "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${asset}" \
    "$asset" "$actionlint_sha"
  mkdir -p "$tmp/actionlint" "$(dirname "$ACTIONLINT_BIN")"
  tar -xzf "$tmp/$asset" -C "$tmp/actionlint" actionlint
  install -m 0755 "$tmp/actionlint/actionlint" "$ACTIONLINT_BIN"
  "$ACTIONLINT_BIN" -version >&2
fi

if ! shellcheck_current; then
  asset="shellcheck-v${SHELLCHECK_VERSION}.${shellcheck_platform}.tar.gz"
  fetch_verified \
    "https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/${asset}" \
    "$asset" "$shellcheck_sha"
  mkdir -p "$tmp/shellcheck" "$(dirname "$SHELLCHECK_BIN")"
  tar -xzf "$tmp/$asset" -C "$tmp/shellcheck" "shellcheck-v${SHELLCHECK_VERSION}/shellcheck"
  install -m 0755 "$tmp/shellcheck/shellcheck-v${SHELLCHECK_VERSION}/shellcheck" "$SHELLCHECK_BIN"
  "$SHELLCHECK_BIN" --version >&2
fi
