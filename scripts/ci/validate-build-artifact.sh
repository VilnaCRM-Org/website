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

# --- Non-trivial export --------------------------------------------------------
file_count="$(find "${out_dir}" -type f | wc -l)"
floor=200
if [ "${file_count}" -lt "${floor}" ]; then
  fail "only ${file_count} files in ${out_dir} (floor ${floor}); export looks truncated"
fi

# --- Static JS payload budget --------------------------------------------------
# Guards against accidental heavy imports bloating the first-load bundle. Budget
# is the current actual (~3.13 MB) + ~5% headroom; never raise it to absorb a
# regression -- trim the imports instead.
js_bytes="$(find "${out_dir}/_next/static" -name '*.js' -printf '%s\n' |
  awk '{ s += $1 } END { print s + 0 }')"
js_budget=3300000
if [ "${js_bytes}" -gt "${js_budget}" ]; then
  fail "static JS is ${js_bytes} bytes, over budget ${js_budget}; trim imports (do not raise the budget)"
fi

echo "build-artifact: OK (${file_count} files, $((js_bytes / 1024)) KiB static JS)"
