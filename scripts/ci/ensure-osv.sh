#!/usr/bin/env sh
# Provision the pinned osv-scanner into ./bin (idempotent, SHA256-verified).
#
# osv-scanner is a standalone Go binary, NOT an npm dependency: it is absent from the
# node:*-alpine dev image, so it cannot run through PM_EXEC / the dev container. This helper
# gives `make lint-vulns` (local) and .github/workflows/osv-scanner.yml a single, reproducible
# provisioning path to a gitignored ./bin — the same shape as scripts/ci/ensure-rca.sh.
#
# Upstream ships one static binary per platform plus an osv-scanner_SHA256SUMS manifest; the
# digests below are copied from that manifest for OSV_VERSION and verified on every download,
# so a compromised or truncated release cannot silently become the security scanner.
set -eu

OSV_BIN="${OSV_BIN:-./bin/osv-scanner}"

# The version and its digests are ONE fact, and are deliberately NOT overridable from the
# environment: an `OSV_VERSION=2.6.0` override would download 2.6.0 and verify it against the
# 2.5.0 digests, which can only ever fail. Upgrading means editing this block — the version
# and all four digests together, copied from that release's own osv-scanner_SHA256SUMS — in a
# reviewed diff, which is the entire point of pinning a security scanner.
# https://github.com/google/osv-scanner/releases/download/v2.5.0/osv-scanner_SHA256SUMS
OSV_VERSION='2.5.0'
OSV_SHA256_LINUX_AMD64='edcfc41d257db36148f065055655fe3fcfc434b0b423ea67468a84c207524e0c'
OSV_SHA256_LINUX_ARM64='fe152e1a546af223e6c557cc3111a8bb3e5dc02fcbf7dbe95d26567c0f0041f2'
OSV_SHA256_DARWIN_AMD64='baef4f4a4ce2924a9241869c36d4bd9d6c04b632cae6637a0f6347ab9272eb16'
OSV_SHA256_DARWIN_ARM64='fff5a2e351b7f0a60001e87cbf862e82fb82e2792d368b533fec7a5865a73da2'

# Already the right version? Nothing to do (idempotent; no network needed).
# -Fwq: fixed-string, whole-word match so e.g. 2.5.01 cannot satisfy 2.5.0.
if [ -x "$OSV_BIN" ] && "$OSV_BIN" --version 2>/dev/null | grep -Fwq "$OSV_VERSION"; then
  exit 0
fi

os="$(uname -s)"
arch="$(uname -m)"

case "$os" in
  Linux) asset_os='linux' ;;
  Darwin) asset_os='darwin' ;;
  *)
    printf 'ERROR: osv-scanner v%s ships no prebuilt asset for %s\n' "$OSV_VERSION" "$os" >&2
    exit 1
    ;;
esac

case "$arch" in
  x86_64 | amd64) asset_arch='amd64' ;;
  aarch64 | arm64) asset_arch='arm64' ;;
  *)
    printf 'ERROR: osv-scanner v%s ships no prebuilt asset for %s/%s\n' "$OSV_VERSION" "$os" "$arch" >&2
    exit 1
    ;;
esac

case "${asset_os}_${asset_arch}" in
  linux_amd64) expected="$OSV_SHA256_LINUX_AMD64" ;;
  linux_arm64) expected="$OSV_SHA256_LINUX_ARM64" ;;
  darwin_amd64) expected="$OSV_SHA256_DARWIN_AMD64" ;;
  *) expected="$OSV_SHA256_DARWIN_ARM64" ;;
esac

mkdir -p "$(dirname "$OSV_BIN")"
asset="osv-scanner_${asset_os}_${asset_arch}"
url="https://github.com/google/osv-scanner/releases/download/v${OSV_VERSION}/${asset}"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/osv-install.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT INT TERM

curl -fsSL \
  --retry 3 \
  --retry-all-errors \
  --connect-timeout 10 \
  --max-time 120 \
  "$url" -o "$tmp/$asset"
# macOS ships `shasum` rather than GNU coreutils' `sha256sum`; both read the same
# "<digest>  <path>" manifest format on stdin.
#
# Provisioning diagnostics go to STDERR, not stdout: `make lint-vulns` runs this inside a
# recipe whose stdout the workflow tees into the job summary and, for the census, verbatim
# into a GitHub issue body. On stdout this chatter would head every nightly issue comment
# with a random /tmp/osv-install.XXXXXX path. `set -eu` still aborts on a digest mismatch,
# and the FAILED line stays visible.
if command -v sha256sum >/dev/null 2>&1; then
  printf '%s  %s\n' "$expected" "$tmp/$asset" | sha256sum -c - >&2
else
  printf '%s  %s\n' "$expected" "$tmp/$asset" | shasum -a 256 -c - >&2
fi
install -m 0755 "$tmp/$asset" "$OSV_BIN"
"$OSV_BIN" --version >&2
