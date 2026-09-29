#!/usr/bin/env bash
#
# Digest-pinned mirror fallback for ECR Public base images in CI (ADR 0014;
# issues #509, #506, #485).
#
# Every Dockerfile here pulls its external bases from ECR Public's
# `docker/library` namespace, pinned by digest. ECR Public caps anonymous pulls
# per source IP, and GitHub's shared runner pool exhausts that cap: the refusal is
# `429 toomanyrequests: Data limit exceeded`, a quota rather than a burst, so
# waiting does not clear it. Because each FROM carries the manifest digest, the
# same bytes can be fetched from any registry that holds that digest. This script
# derives, mechanically,
#
#   public.ecr.aws/docker/library/<name>[:<tag>]@sha256:<64 hex>
#     -> mirror.gcr.io/library/<name>@sha256:<same 64 hex>
#
# and expresses it as a BuildKit named build context keyed by the exact FROM ref,
# so a build fetches the mirror copy without the Dockerfile being edited.
#
# What it reads: every FROM instruction (continuation lines folded). A FROM that
# names an earlier stage, `scratch`, or any image outside `public.ecr.aws/docker/
# library/` is left alone — it is not subject to ECR Public's quota, or the
# `docker/library` equivalence is not established for it. A FROM inside that
# namespace that is not `<name>[:<tag>]@sha256:<64 lowercase hex>` fails the run:
# the mirror is only safe because the digest travels with it, and a derivation
# that fell back to a tag would trade integrity for availability. A Dockerfile
# with an `# escape=` parser directive is refused rather than mis-folded.
#
# Subcommands:
#
#   contexts [--probe] DOCKERFILE...
#       One `<ref>=docker-image://<mirror>` line per distinct ECR ref the
#       Dockerfiles FROM. With --probe, only the refs ECR Public refuses.
#
#   compose-override [--probe] OUT COMPOSE_FILE...
#       Resolve the Compose project (`docker compose config`, every profile) and
#       write to OUT a JSON override that adds `build.additional_contexts` to each
#       service whose Dockerfile FROMs a (refused, with --probe) ECR ref. A
#       project with nothing to redirect gets `{"services":{}}`.
#
#   github-output DOCKERFILE
#       For the dev-container composite: probes, then appends two multi-line step
#       outputs to $GITHUB_OUTPUT (stdout when unset) — `build-contexts`, the
#       refused refs' contexts, and `mirror-contexts`, every ref's context.
#
# --probe asks ECR Public for each distinct manifest once (bounded by
# PROBE_TIMEOUT seconds, default 60). A refusal is not an error: it prints the
# registry's own error text as an escaped workflow warning on stderr and selects
# the mirror for that ref. Exit 1 means a Dockerfile or project breaks the
# contract above; exit 2 is a usage error.

set -euo pipefail
# Every derivation runs inside a command substitution; without this a refusal
# there would be swallowed and the caller would read an empty, "clean" list.
shopt -s inherit_errexit

ORIGIN_PREFIX='public.ecr.aws/docker/library/'
MIRROR_PREFIX='mirror.gcr.io/library/'
REF_PATTERN='^public\.ecr\.aws/docker/library/[a-z0-9]+(([._]|__|-+)[a-z0-9]+)*(:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?@sha256:[0-9a-f]{64}$'

fail() {
  printf '::error::%s\n' "$*" >&2
  exit 1
}

usage() {
  cat >&2 <<'USAGE'
usage: ecr-mirror.sh contexts [--probe] DOCKERFILE...
       ecr-mirror.sh compose-override [--probe] OUT COMPOSE_FILE...
       ecr-mirror.sh github-output DOCKERFILE
USAGE
  exit 2
}

# Workflow-command escaping: the registry's error text is untrusted, and an
# unescaped newline would let it start a second `::command::` line.
escape_message() {
  local message="$1"
  message="${message//'%'/%25}"
  message="${message//$'\r'/%0D}"
  message="${message//$'\n'/%0A}"
  printf '%s' "${message}"
}

mirror_of() {
  local ref="$1" name
  name="${ref#"${ORIGIN_PREFIX}"}"
  name="${name%%[:@]*}"
  printf '%s%s@sha256:%s' "${MIRROR_PREFIX}" "${name}" "${ref##*@sha256:}"
}

context_of() {
  printf '%s=docker-image://%s' "$1" "$(mirror_of "$1")"
}

# from_ref <dockerfile> <instruction> -> the ECR ref this FROM pulls, or nothing.
# An earlier stage needs no special case: a stage name cannot contain `/`, so it
# can never carry the ECR prefix.
from_ref() {
  local dockerfile="$1" image='' word
  local -a words
  read -r -a words <<<"$2"
  for word in "${words[@]:1}"; do
    case "${word}" in
      --*) ;;
      *)
        image="${word}"
        break
        ;;
    esac
  done
  [ -n "${image}" ] || fail "${dockerfile}: a FROM instruction names no image"
  case "${image}" in
    "${ORIGIN_PREFIX}"*) ;;
    *) return 0 ;;
  esac
  [[ "${image}" =~ ${REF_PATTERN} ]] ||
    fail "${dockerfile}: '${image}' is not ${ORIGIN_PREFIX}<name>[:<tag>]@sha256:<64 hex>; refusing to derive a mirror for it"
  printf '%s\n' "${image}"
}

# dockerfile_refs <dockerfile> -> every ECR ref it FROMs, one per line, in order.
dockerfile_refs() {
  local dockerfile="$1" content line logical=''
  [ -f "${dockerfile}" ] || fail "no Dockerfile at ${dockerfile}"
  content="$(cat "${dockerfile}")"
  if grep -qiE '^#[[:space:]]*escape[[:space:]]*=' <<<"${content}"; then
    fail "${dockerfile}: an '# escape=' parser directive is not supported; refusing to guess its FROM lines"
  fi
  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line%$'\r'}"
    if [ -n "${logical}" ] && [[ "${line}" =~ ^[[:space:]]*# ]]; then
      continue
    fi
    logical="${logical:+${logical} }${line}"
    if [[ "${logical}" == *\\ ]]; then
      logical="${logical%\\}"
      continue
    fi
    if [[ "${logical}" =~ ^[[:space:]]*[Ff][Rr][Oo][Mm][[:space:]] ]]; then
      from_ref "${dockerfile}" "${logical}"
    fi
    logical=''
  done <<<"${content}"
  if [[ "${logical}" =~ ^[[:space:]]*[Ff][Rr][Oo][Mm][[:space:]] ]]; then
    from_ref "${dockerfile}" "${logical}"
  fi
}

# distinct_refs <dockerfile>... -> the union of their ECR refs, first-seen order.
distinct_refs() {
  local dockerfile refs=''
  for dockerfile in "$@"; do
    refs+="$(dockerfile_refs "${dockerfile}")"$'\n'
  done
  printf '%s' "${refs}" | awk 'NF && !seen[$0]++'
}

# refused <ref> -> exit 0 when ECR Public refuses the manifest (and says why).
refused() {
  local ref="$1" error_text status
  if error_text="$(timeout "${PROBE_TIMEOUT:-60}" docker buildx imagetools inspect --raw "${ref}" 2>&1 >/dev/null)"; then
    return 1
  else
    status=$?
  fi
  [ -n "${error_text}" ] || error_text="no error text (exit ${status})"
  [ "${status}" -ne 124 ] || error_text="no answer within ${PROBE_TIMEOUT:-60}s"
  printf '::warning::%s\n' "$(escape_message "ECR Public refused ${ref%%@*}, so this build fetches the digest-identical $(mirror_of "${ref}") instead. Registry said: ${error_text:0:2000}")" >&2
  return 0
}

# selected_refs <probe 0|1> <refs> -> the refs to redirect.
selected_refs() {
  local probe="$1" ref
  while IFS= read -r ref; do
    [ -n "${ref}" ] || continue
    if [ "${probe}" -eq 0 ] || refused "${ref}"; then
      printf '%s\n' "${ref}"
    fi
  done <<<"$2"
}

cmd_contexts() {
  local probe=0 ref refs selected
  if [ "${1:-}" = --probe ]; then
    probe=1
    shift
  fi
  [ "$#" -gt 0 ] || usage
  refs="$(distinct_refs "$@")"
  selected="$(selected_refs "${probe}" "${refs}")"
  while IFS= read -r ref; do
    [ -z "${ref}" ] || printf '%s\n' "$(context_of "${ref}")"
  done <<<"${selected}"
}

cmd_compose_override() {
  local probe=0 out file config pairs='' service path ref refs selected
  local -a compose_args=()
  if [ "${1:-}" = --probe ]; then
    probe=1
    shift
  fi
  [ "$#" -ge 2 ] || usage
  out="$1"
  shift
  for file in "$@"; do
    compose_args+=(-f "${file}")
  done
  config="$(docker compose "${compose_args[@]}" --profile '*' config --format json)" ||
    fail "docker compose could not resolve the project: $*"
  local services
  services="$(jq -r '.services // {} | to_entries[] | select(.value.build != null)
    | [.key, (if (.value.build.dockerfile // "Dockerfile") | startswith("/")
              then .value.build.dockerfile
              else .value.build.context + "/" + (.value.build.dockerfile // "Dockerfile") end)]
    | @tsv' <<<"${config}")" || fail "could not read the services of: $*"
  while IFS=$'\t' read -r service path; do
    [ -n "${service}" ] || continue
    refs="$(dockerfile_refs "${path}")"
    while IFS= read -r ref; do
      [ -z "${ref}" ] || pairs+="${service}"$'\t'"${ref}"$'\n'
    done <<<"${refs}"
  done <<<"${services}"
  refs="$(printf '%s' "${pairs}" | cut -f2 | awk 'NF && !seen[$0]++')"
  selected="$(selected_refs "${probe}" "${refs}")"
  local lines=''
  while IFS=$'\t' read -r service ref; do
    [ -n "${service}" ] || continue
    if grep -qxF -- "${ref}" <<<"${selected}"; then
      lines+="${service}"$'\t'"${ref}"$'\t'"docker-image://$(mirror_of "${ref}")"$'\n'
    fi
  done <<<"${pairs}"
  mkdir -p "$(dirname "${out}")"
  printf '%s' "${lines}" | jq -R -n '
    reduce (inputs | select(length > 0) | split("\t")) as [$service, $ref, $source]
      ({services: {}}; .services[$service].build.additional_contexts[$ref] = $source)' \
    >"${out}.tmp"
  mv "${out}.tmp" "${out}"
}

emit_multiline() {
  local name="$1" value="$2" delimiter
  delimiter="ECR_MIRROR_$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
  printf '%s<<%s\n%s%s\n' "${name}" "${delimiter}" "${value:+${value}$'\n'}" "${delimiter}"
}

cmd_github_output() {
  [ "$#" -eq 1 ] || usage
  local refs build mirror
  refs="$(distinct_refs "$1")"
  build="$(selected_refs 1 "${refs}" | while IFS= read -r ref; do context_of "${ref}"; printf '\n'; done)"
  mirror="$(selected_refs 0 "${refs}" | while IFS= read -r ref; do context_of "${ref}"; printf '\n'; done)"
  {
    emit_multiline build-contexts "${build}"
    emit_multiline mirror-contexts "${mirror}"
  } >>"${GITHUB_OUTPUT:-/dev/stdout}"
}

main() {
  local command="${1:-}"
  [ "$#" -eq 0 ] || shift
  case "${command}" in
    contexts) cmd_contexts "$@" ;;
    compose-override) cmd_compose_override "$@" ;;
    github-output) cmd_github_output "$@" ;;
    *) usage ;;
  esac
}

main "$@"
