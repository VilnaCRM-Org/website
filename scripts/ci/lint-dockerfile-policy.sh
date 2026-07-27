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
#      a re-pushed mutable tag cannot silently change what a build runs. The
#      digest must be a concrete 64-char lowercase hex value — an empty,
#      malformed, or variable-valued suffix (`@sha256:`, `@sha256:${DIGEST}`)
#      does not satisfy the pin.
#
# Internal build-stage references (`FROM <stage>`) and `FROM scratch` pull
# nothing, so they are exempt. Docker treats stage names case-insensitively, so
# the exemption does too. Dependabot's `docker` ecosystem (#364) keeps the
# pinned digests fresh while preserving the human-readable tag.
#
# Multi-line `FROM` instructions are honoured: physical lines joined by the
# Dockerfile line-continuation escape character (`\` by default, or the value of
# a leading `# escape=` parser directive) are folded into one logical
# instruction before the policy is applied, so a legitimately wrapped `FROM`
# is evaluated rather than rejected.
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

# Enforce the registry + digest policy on a single, already line-folded logical
# instruction. Non-FROM lines are ignored. Reads and updates the file-scoped
# `stages` alias set and the loop-scoped `df` (for messages), and records
# failures via `violation`.
lint_from_line() {
  line="$1"
  # Trim surrounding whitespace; only genuine FROM instructions are relevant
  # (a commented `# FROM ...` line no longer starts with FROM once trimmed).
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  case "$(lc "$line")" in
    from[[:space:]]*) : ;;
    *) return 0 ;;
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
    return 0
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
        # A single-label first component is an implicit Docker Hub reference
        # (`library/node`, `user/img`) UNLESS it carries a port
        # (`registry:5000/img`), which only ever denotes an explicit registry
        # host — Docker Hub short forms never contain a ':' before the first '/'.
        case "$registry" in
          *:*) : ;;
          *) is_dockerhub=1 ;;
        esac
        ;;
    esac
  fi

  if [ "$is_dockerhub" -eq 1 ]; then
    violation "$df: Docker Hub is forbidden; pin an explicit registry (e.g. public.ecr.aws/docker/library/...): 'FROM $image'"
  fi

  case "$image" in
    *@sha256:*)
      # The digest is the final `@sha256:` component; require a concrete
      # 64-char lowercase hex value so an empty/variable/short suffix cannot
      # satisfy the pin.
      digest="${image##*@sha256:}"
      case "$digest" in
        "" | *[!0-9a-f]*)
          violation "$df: @sha256 digest must be exactly 64 lowercase hex characters: 'FROM $image'" ;;
        *)
          if [ "${#digest}" -ne 64 ]; then
            violation "$df: @sha256 digest must be exactly 64 lowercase hex characters: 'FROM $image'"
          fi
          ;;
      esac
      ;;
    *)
      violation "$df: base image must be digest-pinned with @sha256:<digest>: 'FROM $image'" ;;
  esac

  if [ -n "$asname" ]; then
    stages="$stages$asname "
  fi
  return 0
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

  # Dockerfile line-continuation escape character. Defaults to backslash; a
  # leading `# escape=` parser directive can switch it to a backtick.
  esc='\'
  IFS= read -r first_line <"$df" || first_line=""
  case "$(lc "$first_line")" in
    '# escape=`'* | '#escape=`'*) esc='`' ;;
  esac

  # Fold FROM line-continuations into a single logical instruction, then lint
  # it. Only FROM instructions are folded — every other line (comments, RUN,
  # etc.) is passed through verbatim so a trailing escape elsewhere can never
  # merge a following FROM out of sight. `|| [ -n "$rawline" ]` processes a
  # final line that lacks a trailing newline.
  pending=""
  while IFS= read -r rawline || [ -n "$rawline" ]; do
    if [ -n "$pending" ]; then
      stripped="${rawline%"$esc"}"
      pending="$pending $stripped"
      if [ "$stripped" = "$rawline" ]; then
        # This physical line has no trailing escape: the FROM is complete.
        lint_from_line "$pending"
        pending=""
      fi
      continue
    fi
    stripped="${rawline%"$esc"}"
    if [ "$stripped" != "$rawline" ]; then
      trimmed="${rawline#"${rawline%%[![:space:]]*}"}"
      case "$(lc "$trimmed")" in
        from[[:space:]]*)
          # A wrapped FROM — start accumulating its continuation.
          pending="$stripped"
          continue
          ;;
      esac
    fi
    lint_from_line "$rawline"
  done <"$df"
  # A FROM left dangling on a trailing continuation (malformed, but still lint
  # what we have rather than skip it silently).
  if [ -n "$pending" ]; then
    lint_from_line "$pending"
  fi
done

if [ "$status" -ne 0 ]; then
  printf '\nDockerfile registry/digest policy failed. See scripts/ci/lint-dockerfile-policy.sh for the rules.\n' >&2
fi
exit "$status"
