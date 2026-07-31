#!/usr/bin/env bash
# Validate the production static export in ./out (issue #361).
#
# The artifact that actually ships is the static export synced to S3 by AWS
# CodeBuild; it is otherwise never produced on PRs, so a PR can be green and
# still break the export, ship an empty one, or flip the route-file layout the
# CloudFront edge function (scripts/cloudfront_routing.js) depends on. Both
# past incidents (#176/#177, #209/#210) were found at deploy time, not on the PR.
set -euo pipefail

out_dir="${1:-out}"
script_dir="$(cd "$(dirname "$0")" && pwd)"

fail() {
  echo "::error::build-artifact: $1"
  exit 1
}

# --- Core artifact shape -------------------------------------------------------
[ -s "${out_dir}/index.html" ] || fail "missing or empty ${out_dir}/index.html"
[ -d "${out_dir}/_next/static" ] || fail "missing ${out_dir}/_next/static"
[ -f "${out_dir}/404.html" ] || fail "missing ${out_dir}/404.html"

# --- Route-layout contract with scripts/cloudfront_routing.js ------------------
# The edge function rewrites /swagger -> /swagger.html (a FLAT file). If the
# export layout flips to trailing-slash/directory style, swagger.html disappears
# and swagger/index.html appears instead, silently breaking the edge rewrite.
[ -f "${out_dir}/swagger.html" ] ||
  fail "missing flat ${out_dir}/swagger.html (edge route contract)"
grep -qi 'swagger' "${out_dir}/swagger.html" ||
  fail "${out_dir}/swagger.html has no 'swagger' content; the Swagger page did not render"
if [ -e "${out_dir}/swagger/index.html" ]; then
  fail "unexpected ${out_dir}/swagger/index.html: export layout flipped to trailing-slash; the edge /swagger -> /swagger.html rewrite would 404"
fi

# --- RFC 9116 disclosure policy (issue #383) -----------------------------------
# public/.well-known/security.txt is published purely by Next's public/ copy. A
# dot-directory is exactly the kind of thing a future export/tooling change drops
# silently, and a security.txt that 404s is worse than none (RFC 9116 consumers
# treat the absence as "no policy", but a broken link as a dead contact).
security_txt="${out_dir}/.well-known/security.txt"
[ -s "${security_txt}" ] ||
  fail "missing or empty ${security_txt}; the public/.well-known/ dot-directory did not survive the export"
grep -q '^Contact:' "${security_txt}" ||
  fail "${security_txt} has no Contact field (RFC 9116 requires at least one)"
grep -q '^Expires:' "${security_txt}" ||
  fail "${security_txt} has no Expires field (RFC 9116 requires exactly one)"

# --- Non-trivial export --------------------------------------------------------
file_count="$(find "${out_dir}" -type f | wc -l)"
floor=200
if [ "${file_count}" -lt "${floor}" ]; then
  fail "only ${file_count} files in ${out_dir} (floor ${floor}); export looks truncated"
fi

# --- Static JS payload ---------------------------------------------------------
# A real export ships many first-load chunks. An empty _next/static yields
# js_bytes=0, which is under the upper budget below, and the file-count floor
# above counts non-JS assets too -- so a JS-less export would pass green. Require
# at least one regular .js file first, then enforce the byte budget. The budget
# guards against accidental heavy imports bloating the first-load bundle: it is
# the current actual (~3.13 MB) + ~5% headroom; never raise it to absorb a
# regression -- trim the imports instead.
read -r js_count js_bytes < <(
  find "${out_dir}/_next/static" -type f -name '*.js' -printf '%s\n' |
    awk '{ c += 1; s += $1 } END { print c + 0, s + 0 }'
)
if [ "${js_count}" -eq 0 ]; then
  fail "no .js files under ${out_dir}/_next/static; the export shipped no JS payload"
fi
js_budget=3300000
if [ "${js_bytes}" -gt "${js_budget}" ]; then
  fail "static JS is ${js_bytes} bytes, over budget ${js_budget}; trim imports (do not raise the budget)"
fi

# --- No source maps in the shipped artifact (issue #383) -----------------------
# next.config.js leaves `productionBrowserSourceMaps` unset (default false), and
# `make lint-prod-guardrails` fails the PR if anyone enables it. This is the
# artifact-level backstop the config check structurally cannot provide: a map
# arriving by any other route (a plugin, a stray copy) is caught here, before the
# TypeScript sources are published to a public bucket.
map_files="$(find "${out_dir}" -type f -name '*.map')"
if [ -n "${map_files}" ]; then
  fail "source maps present in ${out_dir}; they would publish the TypeScript sources: ${map_files}"
fi

# --- Edge allow-list completeness (issue #383) ---------------------------------
# scripts/cloudfront_routing.js is fail-closed: anything outside its allow-list
# gets the synthetic 404 instead of reaching S3. That is only safe while the
# allow-list is a superset of the export, so run the real handler over every
# exported path. Deliberately LAST: the route-layout contract above must report
# its own specific error for a trailing-slash flip, not a generic "blocked path".
node "${script_dir}/verify-edge-allowlist.mjs" "${out_dir}" ||
  fail "edge allow-list does not cover the export (see the blocked paths above)"

echo "build-artifact: OK (${file_count} files, $((js_bytes / 1024)) KiB static JS, security.txt present)"
