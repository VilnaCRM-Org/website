#!/usr/bin/env sh
# Provision the pinned rust-code-analysis-cli into ./bin (idempotent, SHA256-verified).
#
# rust-code-analysis is a standalone Rust binary, NOT an npm dependency: it is
# absent from the node:*-alpine dev image, so it cannot run through PNPM_EXEC /
# the dev container. This helper gives `make lint-metrics` (local) and the CI
# workflow a single, reproducible provisioning path to a gitignored ./bin.
set -eu

RCA_BIN="${RCA_BIN:-./bin/rust-code-analysis-cli}"
RCA_VERSION="${RCA_VERSION:-0.0.25}"
RCA_SHA256_LINUX="${RCA_SHA256_LINUX:-9ec2a217b8ff191e02dab5d5f2eee6158b63fd975c532b2c5d67c2e6c7249894}"

# Already the right version? Nothing to do (idempotent; no network needed).
if [ -x "$RCA_BIN" ] && "$RCA_BIN" --version 2>/dev/null | grep -q "$RCA_VERSION"; then
  exit 0
fi

# A prebuilt asset exists for linux x86_64 only. Fall back to a locked cargo
# build on other platforms (arm64, macOS), where v0.0.25 ships no prebuilt asset.
arch="$(uname -m)"
os="$(uname -s)"
if [ "$os" != "Linux" ] || { [ "$arch" != "x86_64" ] && [ "$arch" != "amd64" ]; }; then
  printf 'No v%s prebuilt asset for %s/%s; building with cargo (locked)...\n' "$RCA_VERSION" "$os" "$arch" >&2
  command -v cargo >/dev/null 2>&1 || {
    printf 'ERROR: cargo is required to provision rust-code-analysis-cli on %s/%s\n' "$os" "$arch" >&2
    exit 1
  }
  cargo_root="$(dirname "$(dirname "$RCA_BIN")")/.cargo-rca"
  cargo install rust-code-analysis-cli --version "$RCA_VERSION" --locked --root "$cargo_root"
  mkdir -p "$(dirname "$RCA_BIN")"
  ln -sf "$cargo_root/bin/rust-code-analysis-cli" "$RCA_BIN"
  "$RCA_BIN" --version
  exit 0
fi

mkdir -p "$(dirname "$RCA_BIN")"
asset="rust-code-analysis-linux-cli-x86_64.tar.gz"
url="https://github.com/mozilla/rust-code-analysis/releases/download/v${RCA_VERSION}/${asset}"
tmp="$(mktemp -d "${TMPDIR:-/tmp}/rca-install.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT INT TERM

curl -fsSL "$url" -o "$tmp/$asset"
printf '%s  %s\n' "$RCA_SHA256_LINUX" "$tmp/$asset" | sha256sum -c -
tar -xzf "$tmp/$asset" -C "$tmp"
install -m 0755 "$tmp/rust-code-analysis-cli" "$RCA_BIN"
"$RCA_BIN" --version
