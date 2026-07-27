#!/usr/bin/env bash
#
# Registry + digest-pin policy for every committed Dockerfile (issue #370).
#
# Two rules are enforced on each `FROM` that pulls an external base image:
#
#   1. No Docker Hub (docker.io) images — explicit *or* implicit. The repo's
#      four repeated docker.io -> public-ECR migrations (#191, #206, #251,
#      #253) all recurred because nothing enforced the registry repo-wide; a
#      single conformance lint at the first incident would have prevented the
#      other three.
#   2. Every external base image must be digest-pinned (`@sha256:<digest>`), so
#      a re-pushed mutable tag cannot silently change what a build runs.
#
# Internal build-stage references (`FROM <stage>`) and `FROM scratch` pull
# nothing, so they are exempt. Docker treats stage names case-insensitively, so
# the exemption does too. Dependabot's `docker` ecosystem (#364) keeps the
# pinned digests fresh while preserving the human-readable tag.
#
# Usage:
#   scripts/ci/lint-dockerfile-policy.sh [DOCKERFILE ...]
#
# With no arguments, every tracked *Dockerfile* is checked (via `git ls-files`).
# Explicit paths are accepted so the policy can be unit-tested against fixtures.
#
# Intentionally written for POSIX-ish bash (no associative arrays / mapfile /
# `${x,,}`) so it runs identically on the CI runner and on an older host bash.

set -eu

# Lowercase helper (portable substitute for bash 4's `${x,,}`).
lc() {
  printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]'
}

# Resolve the target file list.
files=()
if [ "$#" -gt 0 ]; then
  # Explicit paths — used by the fixtures/self-tests.
  files=("$@")
else
  # Default: every tracked Dockerfile. Capture git's output *and* exit status
  # explicitly (a process substitution would hide a git failure), then fall
  # back to a filesystem scan when git is unavailable or this is not a
  # checkout.
  discovered=""
  if ! discovered="$(git ls-files '*Dockerfile*' 2>/dev/null)" || [ -z "$discovered" ]; then
    discovered="$(find . -type f -name '*Dockerfile*' \
      -not -path './node_modules/*' -not -path './.git/*' 2>/dev/null)"
  fi
  while IFS= read -r tracked; do
    if [ -n "$tracked" ]; then
      files+=("$tracked")
    fi
  done <<EOF
$discovered
EOF
  # This repo always ships Dockerfiles; finding none means discovery broke, so
  # fail loudly rather than let the gate silently pass on zero files.
  if [ "${#files[@]}" -eq 0 ]; then
    printf 'ERROR: no Dockerfiles found to lint (expected at least one). Is this a repository checkout?\n' >&2
    exit 1
  fi
fi

status=0
violation() {
  printf 'POLICY VIOLATION: %s\n' "$1" >&2
  status=1
}

for df in "${files[@]}"; do
  if [ ! -f "$df" ]; then
    violation "file not found: $df"
    continue
  fi

  # Space-delimited set of lowercased stage aliases declared earlier in this
  # file (`... AS <name>`). A later `FROM <name>` references one of these and
  # must not be treated as a pull.
  stages=" "

  # `|| [ -n "$rawline" ]` processes a final line that lacks a trailing newline.
  while IFS= read -r rawline || [ -n "$rawline" ]; do
    # Trim surrounding whitespace; only genuine FROM instructions are relevant
    # (a commented `# FROM ...` line no longer starts with FROM once trimmed).
    line="${rawline#"${rawline%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    case "$(lc "$line")" in
      from[[:space:]]*) : ;;
      *) continue ;;
    esac

    # Tokenise on whitespace: toks[0] == FROM.
    read -r -a toks <<<"$line"

    # Skip any leading build flags such as `--platform=linux/amd64`.
    idx=1
    while [ -n "${toks[$idx]:-}" ]; do
      case "${toks[$idx]}" in
        --*) idx=$((idx + 1)) ;;
        *) break ;;
      esac
    done
    image="${toks[$idx]:-}"
    imgkey="$(lc "$image")"

    # Locate an optional `AS <name>` stage alias.
    asname=""
    i=$((idx + 1))
    count=${#toks[@]}
    while [ "$i" -lt "$count" ]; do
      if [ "$(lc "${toks[$i]}")" = "as" ]; then
        asname="$(lc "${toks[$((i + 1))]:-}")"
        break
      fi
      i=$((i + 1))
    done

    # Internal stage reference, `scratch`, or empty base — nothing is pulled.
    is_stage=0
    case "$stages" in
      *" $imgkey "*) is_stage=1 ;;
    esac
    if [ -z "$image" ] || [ "$is_stage" -eq 1 ] || [ "$imgkey" = "scratch" ]; then
      if [ -n "$asname" ]; then
        stages="$stages$asname "
      fi
      continue
    fi

    # From here `image` is an external base image reference.
    registry="${image%%/*}"    # part before the first '/'
    reghost="${registry%%:*}"  # strip an optional :PORT from the host
    is_dockerhub=0
    if [ "$image" = "${image#*/}" ]; then
      # No registry component at all, e.g. `node:23-alpine` (Docker Hub library).
      is_dockerhub=1
    else
      case "$reghost" in
        docker.io | *.docker.io)
          # Explicitly spelled Docker Hub (docker.io / registry-1.docker.io ...).
          is_dockerhub=1
          ;;
        *.* | localhost)
          # A real registry host (has a dot) or a local registry — allowed.
          : ;;
        *)
          # Single-label first component, e.g. `library/node` or `user/img` —
          # still an implicit Docker Hub reference.
          is_dockerhub=1
          ;;
      esac
    fi

    if [ "$is_dockerhub" -eq 1 ]; then
      violation "$df: Docker Hub is forbidden; pin an explicit registry (e.g. public.ecr.aws/docker/library/...): 'FROM $image'"
    fi
    case "$image" in
      *@sha256:*) : ;;
      *) violation "$df: base image must be digest-pinned with @sha256:<digest>: 'FROM $image'" ;;
    esac

    if [ -n "$asname" ]; then
      stages="$stages$asname "
    fi
  done <"$df"
done

if [ "$status" -ne 0 ]; then
  printf '\nDockerfile registry/digest policy failed. See scripts/ci/lint-dockerfile-policy.sh for the rules.\n' >&2
fi
exit "$status"
