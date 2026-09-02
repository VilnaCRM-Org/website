#!/usr/bin/env bash
# Fail when the repository disagrees with itself about which Node it runs (issue #335).
#
# `.nvmrc` is the single authoritative Node version. Four other surfaces have to
# agree with it, or the dev container, CI, and a contributor's shell can each run a
# different Node while every check stays green:
#
#   1. every `FROM …node:<version>-…` base image across the repo's Dockerfiles;
#   2. `package.json` `engines.node`, which is the range `checkNodeVersion.js`
#      enforces at run time — it must pin the same version, not merely admit it
#      (a bare `^24` is satisfied by 24.0.0 as happily as by the pinned patch);
#   3. every `actions/setup-node` step, which must read `.nvmrc` rather than carry
#      a version of its own;
#   4. no workflow may reintroduce a `vars.NODE_VERSION` repository variable, whose
#      value cannot be seen — or reviewed — from inside the repository.
#
# The check is deliberately dependency-free POSIX-ish bash: it runs identically on
# the host, inside the dev container, and under Bats with stubbed binaries.
#
# Usage: ./scripts/ci/check-node-version-sources.sh [<repo-root>]
# Used by: make lint-node-version (part of `make lint`, run by static-testing.yml)
set -euo pipefail

root="${1:-.}"
cd "$root"

failures=0

fail() {
  echo "::error::node-version: $1"
  failures=$((failures + 1))
}

abort() {
  echo "::error::node-version: $1"
  exit 1
}

# --- 1. The authoritative version ---------------------------------------------
[ -f .nvmrc ] || abort ".nvmrc is missing; it is the authoritative Node version"

# The whole file is read, not just its first line. nvm, `actions/setup-node` and this
# check all consume line 1, so a second version line below it is drift that no consumer
# obeys but every reader believes — exactly the disagreement this gate exists to catch.
# Anything past the one version line is rejected rather than discarded. (Trailing blank
# lines are not content: `$(cat …)` has already dropped them.)
nvmrc_contents="$(cat .nvmrc)"

nvmrc_extra_lines="$(printf '%s\n' "$nvmrc_contents" | sed -n '2,$p' | grep -c '[^[:space:]]' || true)"
[ "$nvmrc_extra_lines" -eq 0 ] ||
  abort ".nvmrc must hold nothing but one version line; found ${nvmrc_extra_lines} further non-empty line(s), which every consumer silently ignores"

# Only surrounding whitespace is trimmed, never whitespace *inside* the value: a
# `.nvmrc` reading "24. 18.0" is malformed and must fail the format check below
# rather than be silently repaired into something that passes.
nvmrc_version="$(printf '%s\n' "$nvmrc_contents" | head -n 1 | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

echo "$nvmrc_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' ||
  abort ".nvmrc must pin an exact MAJOR.MINOR.PATCH version, found '${nvmrc_version}'"

# --- 2. Docker base images ------------------------------------------------------
# Matches `FROM <registry>/node:<version>-<variant>` and the bare `FROM node:…`,
# with any number of leading flags (`FROM --platform=$BUILDPLATFORM node:…`), and
# case-insensitively because `from` is legal Dockerfile syntax. It does NOT match an
# unrelated image whose name merely ends in "node": the optional registry group has
# to end in `/`, so `mynode:` cannot satisfy the literal `node:` that follows it.
docker_image_pattern='^[[:space:]]*FROM[[:space:]]+(--[^[:space:]]+[[:space:]]+)*([^[:space:]]*/)?node:'
dockerfiles_checked=0
node_bases_checked=0

while IFS= read -r dockerfile; do
  dockerfiles_checked=$((dockerfiles_checked + 1))

  while IFS= read -r from_line; do
    [ -n "$from_line" ] || continue
    node_bases_checked=$((node_bases_checked + 1))

    # The tag ends at the first variant separator, digest, or whitespace, so all of
    # `node:24.18.0-alpine3.23 AS base`, `node:24.18.0 AS base` and
    # `node:24.18.0@sha256:…` reduce to the same version.
    tag="${from_line#*node:}"
    image_version="$(printf '%s' "$tag" | sed 's/[-@[:space:]].*$//')"

    if [ "$image_version" != "$nvmrc_version" ]; then
      fail "${dockerfile} pins node:${image_version}, .nvmrc pins ${nvmrc_version}"
    fi
  done <<EOF
$(grep -iE "$docker_image_pattern" "$dockerfile" || true)
EOF
done <<EOF
$(find . -name node_modules -prune -o -type f \( -name Dockerfile -o -name '*.Dockerfile' \) -print | sort)
EOF

[ "$node_bases_checked" -gt 0 ] ||
  abort "no 'FROM …node:<version>' base image found in any Dockerfile; the check would pass vacuously"

# --- 3. package.json engines ----------------------------------------------------
[ -f package.json ] || abort "package.json is missing"

engines_node="$(
  sed -n '/"engines"[[:space:]]*:/,/}/p' package.json |
    sed -n 's/.*"node"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' |
    head -n 1
)"

[ -n "$engines_node" ] ||
  abort "package.json has no engines.node; it is what checkNodeVersion.js enforces"

# `checkNodeVersion.js` only understands caret clauses, so the pin has to stay a
# caret — but a caret over the full .nvmrc version, so the floor is the pinned patch.
if [ "$engines_node" != "^${nvmrc_version}" ]; then
  fail "package.json engines.node is '${engines_node}', expected '^${nvmrc_version}' to match .nvmrc"
fi

# --- 4. GitHub Actions Node setup -----------------------------------------------
# Each `actions/setup-node` step is validated as its own YAML block, not by comparing
# whole-file counts of two greps. Counting is fail-open in both directions: a quoted
# `uses: "actions/setup-node@…"` is not counted as a step, and a commented-out
# `# node-version-file: '.nvmrc'` counts as an input — so a step pinning a literal
# version could balance the totals and pass.
#
# The scanner below drops comments, then treats a `- ` list item as opening a step,
# closing it at the next line that is not more indented — the next `- ` of the same
# sequence, or the job key the sequence ends at (deeper `- ` items are nested sequences
# inside the step, not new steps). A step that uses setup-node must carry its own
# `node-version-file` whose value, quoted or bare, is exactly `.nvmrc`.
#
# Every key the scanner matches — `uses`, `with`, `node-version`, `node-version-file`,
# and each key it merely steps over inside a flow mapping — is matched in all three of
# the spellings YAML treats as the same key: bare, single-quoted and double-quoted.
# `"node-version": '20'` is the literal pin that `node-version: '20'` is, and a scanner
# that knows only the bare spelling reads it as some unrelated key and waves it through.
# The spellings are built from one shared `yaml_key()` construction so they cannot drift
# apart from each other one key at a time. Quoting a key widens nothing else: the quotes
# have to match and to enclose the *whole* key, so `"legacy-node-version-file":` is still
# a different key that setup-node never reads, and `"node-version':` is a key to no YAML
# reader at all.
#
# Two further spellings of the same key and the same value are matched for the same
# reason, and are the two fail-opens this pass closes:
#
#   * a quoted scalar carries its style's escapes — a backslash escape in a double-quoted
#     scalar (`"he said \" and continued"`) and a doubled quote in a single-quoted one
#     (`'it''s fine'`). A scanner that closes a scalar at the first quote it meets ends
#     that value early, and every entry after it on the line is then read at the wrong
#     offset, so a `node-version` literal further along the mapping is never looked at;
#   * YAML allows whitespace between a key and its colon, so `node-version : "20"` and
#     `"node-version" : '20'` are the ordinary key written with a space. Every key match
#     below therefore ends `ws ":"` — block form, flow form, the entry walk, and the
#     block-scalar header alike — so the spacing cannot be allowed in one spelling and
#     forgotten in the next.
#
# Neither widens the key: escapes are only ever consumed *inside* a quoted scalar, so a
# key spelled inside a quoted value is still swallowed by that value rather than read.
#
# Both keys are matched as real YAML mapping keys of that step, never as loose text:
#
#   * `uses:` must open the line (after an optional sequence dash), so a shell command
#     printing `uses: actions/setup-node@…` inside a `run: |` block cannot conjure a step
#     that nothing runs — which would satisfy the "at least one setup-node step" vacuity
#     guard while the repository has none;
#   * `node-version-file:` counts only inside the step's own `with:` mapping — a `with:`
#     sitting at the step's own key column, never one nested deeper — so neither the same
#     key under `env:` (where setup-node never reads it) nor a `with:` buried inside
#     another mapping excuses a step. The single-line flow form,
#     `with: { node-version-file: '.nvmrc' }`, is the same mapping written differently
#     and is credited too — but only when the pin is that mapping's own key, which is
#     what `flow_entries` below is for.
#
# A literal `node-version:` is reported separately from the per-step rule, in either
# spelling and wherever it appears. The per-step rule cannot see it: a step carrying
# `{ node-version-file: '.nvmrc', node-version: '24.18.0' }` is already credited by the
# pin sitting beside the literal, so without this the literal would never be reported at
# all — and setup-node resolves `node-version` ahead of `node-version-file`, which makes
# the literal the version that actually runs.
#
# Block scalars are therefore tracked explicitly: everything indented under a `key: |`
# or `key: >` is literal text and is skipped, structure and comment syntax alike.
scan_setup_node_steps() {
  awk '
    # One YAML key, in the three spellings that name it: bare, single-quoted and
    # double-quoted. Every key this scanner matches goes through here, so no key can be
    # taught a spelling the others do not know — the mistake that has now cost this gate
    # three separate fail-opens, each one key wide.
    #
    # The quotes are required to match each other and to enclose the whole key, which is
    # what keeps the added spellings from widening the key itself: `"node-version-file"`
    # is this key, `"legacy-node-version-file"` is not (the alternative is anchored at
    # the opening quote, so a prefix cannot be consumed and the tail read as the key),
    # and `"node-version-file'\''` is neither, because no alternative closes with the
    # quote it did not open with.
    #
    # The three alternatives are disjoint on their first character, so choosing between
    # them is never a guess a matcher has to unwind.
    function yaml_key(name) {
      return "(" name "|" dq name dq "|" sq name sq ")"
    }
    BEGIN {
      # The two quote characters, as one-character strings. Every pattern below is built
      # from these instead of spelling a quote inline, so the shell quoting it takes to
      # get a single quote into this program is paid once rather than at every use — and
      # so the two styles stay visibly symmetric.
      sq = "'\''"
      dq = "\""

      # The whitespace YAML permits between a key and its colon. `node-version : "20"` is
      # the key `node-version`; a scanner that demands the colon touch the key sees no key
      # there at all and waves the literal through. Every key match below ends `ws ":"`.
      ws = "[[:space:]]*"

      # A quoted scalar. Closing one at the first quote met is wrong in both YAML quoting
      # styles, and wrong in a way that does not stay local: the value ends early, the
      # rest of the line is read at the wrong offset, and the entry walk below stops
      # matching altogether — so a literal `node-version` further along the mapping is
      # never looked at at all, and a step already credited by a real pin beside it keeps
      # the gate green while the literal is the version that actually runs.
      #
      # A double-quoted scalar escapes with a backslash, which escapes any character
      # including itself: `"a\""` continues past that quote, `"a\\"` ends at its own. The
      # unrolled "plain run, then (escape, plain run) repeated" form below is unambiguous
      # — a backslash is excluded from the plain run, so it can only ever begin an escape,
      # and at every position exactly one alternative applies.
      dq_scalar = dq "[^" dq "\\\\]*(\\\\.[^" dq "\\\\]*)*" dq

      # A single-quoted scalar has no backslash escapes at all: it escapes a quote by
      # doubling it, `'\''it'\'''\''s fine'\''`. That needs the doubling-aware form only
      # where the scalar stands alone — as a KEY. In VALUE position the naive
      # `'\''[^'\'']*'\''` below is already right, and deliberately kept: the value
      # alternatives repeat, and naive pairing splits `'\''it'\'''\''s'\''` into the two
      # adjacent scalars `'\''it'\''` and `'\''s'\''`, which are contiguous and so consume
      # exactly the characters the one real scalar does. Doubling always adds quotes two
      # at a time, so that pairing can never leave a comma or a colon outside a scalar,
      # and the walk cannot desynchronise.
      #
      # Keeping it naive there is not only harmless, it is required. A doubling-aware
      # scalar repeated by the value alternation is ambiguous with itself — a scalar
      # holding one doubled quote reads either as that one scalar or as two adjacent
      # ones — and the readings multiply per entry, which mawk explores one at a time:
      # twenty such entries on a line already cost seconds, and twenty-five do not
      # finish. The key position has no such repetition to pair with, and an early close
      # there is refuted by the very next character (the second quote of the pair is
      # neither the space nor the colon that has to follow a key), so it costs one step.
      # Both are pinned by the pathological-line timing case in
      # tests/bats/node_version_sources.bats.
      sq_key_scalar = sq "[^" sq "]*(" sq sq "[^" sq "]*)*" sq
      sq_value_scalar = sq "[^" sq "]*" sq

      uses_key = yaml_key("uses")
      with_key = yaml_key("with")
      nv_key = yaml_key("node-version")
      nvf_key = yaml_key("node-version-file")

      # Any key at all, for the flow entries that are merely stepped over and for the
      # key a flow mapping hangs off. A quoted key is consumed whole, so a colon or a
      # comma *inside* a key is part of that key rather than structure the walk could
      # be desynchronised by — and, now that the scalars know their escapes, so is a
      # quote the key escapes rather than closes.
      any_key = "([[:alnum:]_.$-]+|" dq_scalar "|" sq_key_scalar ")"

      # The value of one flow entry: plain characters, or a quoted scalar consumed whole.
      # The three alternatives are disjoint on their first character, and none of them
      # matches the empty string, so the walk always advances.
      flow_value = "([^,{}" dq sq "]|" dq_scalar "|" sq_value_scalar ")*"

      # The entries of a flow mapping that precede the key being looked for:
      # `key: value,` repeated, with a quoted key or value consumed whole. Stepping over
      # one entry at a time is what makes the key that follows the mapping OWN key. A
      # looser `[^}]*` prefix instead reads any tail of a longer key as the key itself
      # — `legacy-node-version-file:` and `x-node-version-file:` would credit a step
      # whose block spelling this same scanner rejects — and reads a key merely spelled
      # inside a quoted value, `cache: "a, node-version-file: .nvmrc,"`, as a real one.
      #
      # Every repetition consumes at least a `k:,`, so none of them can match the empty
      # string and the walk always advances.
      flow_entries = "(" any_key ws ":" flow_value "," ws ")*"

      # `.nvmrc`, bare or quoted, with the quotes required to match each other: a value
      # that opens with one quote and closes with the other is not `.nvmrc` to any YAML
      # reader, so it must not be one here either.
      nvmrc_value = "(" sq "\\.nvmrc" sq "|" dq "\\.nvmrc" dq "|\\.nvmrc)"

      # `uses: actions/setup-node@…`, with the action reference optionally quoted too.
      uses_setup_node = "^" uses_key ws ":" ws "[" dq sq "]?actions/setup-node@"

      # The step'\''s own `with:` opening a block mapping, and nothing else on the line.
      block_with = "^" with_key ws ":" ws "$"

      # The two spellings of the same input. The flow form is bounded to one mapping by
      # flow_entries and terminated exactly at `.nvmrc` by nvmrc_value, so a lookalike
      # key, a lookalike path (`.nvmrc.bak`, `".nvmrcX"`) and a literal `node-version:`
      # each still leave the step unpinned.
      flow_with_nvmrc = "^" with_key ws ":" ws "\\{" ws flow_entries \
        nvf_key ws ":" ws nvmrc_value ws "[,}]"
      block_nvmrc = "^" nvf_key ws ":" ws nvmrc_value ws "$"

      # The literal, in either spelling. In flow form its key has to open the mapping or
      # start one of the entries, so `node-version-file:` is never misread as
      # `node-version:` — what follows `node-version` there is a dash, which is neither
      # the optional space nor the colon this pattern demands (nor the closing quote a
      # quoted spelling demands).
      block_literal_node_version = "^" nv_key ws ":"
      flow_literal_node_version = "^" any_key ws ":" ws "\\{" ws \
        flow_entries nv_key ws ":"

      # A key spelled with YAML escapes. `"node-versio\\x6E"` is the mapping key
      # `node-version` to every YAML reader and to setup-node, but decoding escapes is a
      # parser'\''s job, not a scanner'\''s. Rather than guess at the decoded spelling —
      # and pass a literal pin it guessed wrong about — this reports the spelling and
      # refuses: an escaped key is either a key this gate cannot read or an obfuscation
      # of one it must read, and both have to be spelled plainly before the file can be
      # vouched for. The escape is required (`)+`, not `)*`), so an ordinary quoted key
      # is untouched, and the check runs only where the scanner already knows it is
      # looking at structure — never inside a `run: |` block.
      escaped_scalar = dq "[^" dq "\\\\]*(\\\\.[^" dq "\\\\]*)+" dq
      escaped_key = "^" escaped_scalar ws ":"
      flow_escaped_key = "^" any_key ws ":" ws "\\{" ws flow_entries escaped_scalar ws ":"

      # The same refusal, one line wider. A double-quoted scalar may be CONTINUED onto
      # the next line by ending this one with a backslash, and YAML then folds the break
      # away: `"node-versio\` / `n": '\''20'\''` is the key `node-version`, spelled across
      # two lines. A line-based scanner never sees that scalar whole, so the key rule
      # above cannot fire and neither can the literal rule — the pin would simply pass.
      #
      # Detected structurally rather than guessed at: strip every scalar that CLOSES on
      # this line (single-quoted first, so a double quote living inside one is gone
      # before double-quoted scalars are paired), and any double quote still standing
      # opened a scalar this line does not close. That is the continuation, and the
      # scanner refuses it for the same reason it refuses an escape it cannot decode:
      # from here on the line is not structure it can read.
      dq_scalar_only = dq "[^" dq "\\\\]*(\\\\.[^" dq "\\\\]*)*" dq

      # A block-scalar header, `key: |` or `key: >`, with the same optional space before
      # the colon. The colon is matched wherever it sits on the line rather than anchored
      # to the key, so the leading `ws` keeps the shape uniform without widening it.
      block_scalar_header = ws ":" ws "[|>][-+0-9]*" ws "$"
    }
    # Find the closing quote of the scalar that opens at `start`, or 0 when the line
    # does not close it. A double-quoted scalar escapes with a backslash (which escapes
    # any character, itself included); a single-quoted one escapes a quote by doubling
    # it. Returns the index of the closing quote.
    function scalar_end(text, start, quote,   i, n, ch) {
      n = length(text)
      i = start + 1
      while (i <= n) {
        ch = substr(text, i, 1)
        if (quote == dq && ch == "\\") { i += 2; continue }
        if (ch == quote) {
          if (quote == sq && substr(text, i + 1, 1) == sq) { i += 2; continue }
          return i
        }
        i++
      }
      return 0
    }

    # Drop a trailing `#` comment without reaching inside a quoted scalar.
    #
    # A naive `sub(/[[:space:]]+#.*$/, "")` cuts at the first ` #` on the line, which is
    # wrong in both directions when the `#` is inside a value: it truncates
    # `with: { cache: "a # b", node-version: '\''20'\'' }` to `with: { cache: "a`, so the
    # literal after it is never read (a pin passes), and it strips the closing quote off
    # a scalar that is perfectly well formed (a continued-scalar refusal for a line that
    # continues nothing).
    #
    # A quote only opens a scalar here if the line also CLOSES it. That matters because
    # an apostrophe is ordinary text in a YAML plain scalar — `- name: Don'\''t fail # c`
    # has one single quote and no scalar, and its comment must still be stripped — and
    # because an unterminated quote is exactly the continuation the caller must still be
    # able to see.
    function strip_comment(text,   i, n, ch, stop) {
      n = length(text)
      i = 1
      while (i <= n) {
        ch = substr(text, i, 1)
        if (ch == dq || ch == sq) {
          stop = scalar_end(text, i, ch)
          if (stop > 0) { i = stop + 1; continue }
          i++
          continue
        }
        if (ch == "#" && (i == 1 || substr(text, i - 1, 1) ~ /[[:space:]]/)) {
          return substr(text, 1, i - 1)
        }
        i++
      }
      return text
    }
    function close_step() {
      if (in_step && has_setup) {
        steps++
        if (!has_nvmrc) bad++
      }
      in_step = 0; has_setup = 0; has_nvmrc = 0
      in_with = 0; in_block = 0
    }
    {
      raw = $0

      # Everything indented under a `key: |` / `key: >` header is literal scalar text,
      # not YAML structure, so it is skipped wholesale — a shell script that prints
      # `- uses: actions/setup-node@…` cannot conjure a step nothing runs.
      if (in_block) {
        if (raw ~ /^[[:space:]]*$/) next
        if (match(raw, /[^[:space:]]/) - 1 > block_indent) next
        in_block = 0
      }

      line = strip_comment(raw)
      if (line ~ /^[[:space:]]*#/) next
      if (line ~ /^[[:space:]]*$/) next

      first = match(line, /[^[:space:]]/)
      indent = first - 1

      # A step ends at the next `- ` item at its own indent, and at any line that dedents
      # out of the sequence entirely (the next job key, say) — without the second rule a
      # step would absorb whatever follows its list and be credited with those keys.
      # Deeper `- ` items are nested sequences inside the step, not new steps.
      if (in_step && indent <= step_indent) close_step()
      if (!in_step && substr(line, first, 2) == "- ") {
        in_step = 1
        step_indent = indent
        step_key_indent = -1
      }

      # The mapping key on this line, with any sequence dash removed, and the column it
      # really starts at: in `- uses: x` the key is nested one level below the dash, and
      # that nesting is what separates a `with:` input from a sibling `env:` entry.
      key = substr(line, first)
      key_indent = indent
      if (substr(line, first, 2) == "- ") {
        off = match(substr(line, first + 1), /[^[:space:]]/)
        key = substr(line, first + off)
        key_indent = first + off - 1
      }

      # The column of the first mapping key of the step (the one the dash introduces) is
      # the column every direct key of that step sits at — which is how the own `with:` of
      # a step is told apart from a `with:` nested inside some other mapping of it.
      if (in_step && step_key_indent < 0) step_key_indent = key_indent

      if (in_with && key_indent <= with_indent) in_with = 0

      if (in_step) {
        if (key ~ uses_setup_node) has_setup = 1

        if (key_indent == step_key_indent && key ~ block_with) {
          in_with = 1
          with_indent = key_indent
        } else if (key_indent == step_key_indent && key ~ flow_with_nvmrc) {
          # A flow mapping is complete on its own line, so no `with:` scope is opened.
          has_nvmrc = 1
        } else if (in_with && key ~ block_nvmrc) {
          has_nvmrc = 1
        }
      }

      # Counted outside the `in_step` guard, and never as an alternative to the pin
      # above: a literal is drift wherever it is declared, including beside a correct
      # `.nvmrc` pin in the very same mapping, where the step is already credited.
      if (key ~ block_literal_node_version || key ~ flow_literal_node_version) literals++

      # Counted wherever a key is read, for the same reason the literal is: an escaped
      # key hides the literal from the rule above just as effectively as it hides an
      # unpinned step from the one before it.
      if (key ~ escaped_key || key ~ flow_escaped_key) escaped++

      closed = line
      gsub(sq_value_scalar, "", closed)
      gsub(dq_scalar_only, "", closed)
      if (index(closed, dq) > 0) continued++

      # Tracked outside the `in_step` guard on purpose: a block scalar hanging off a job
      # key must be skipped too, or its literal text is read back as structure.
      if (key ~ block_scalar_header) {
        in_block = 1
        block_indent = key_indent
      }
    }
    END { close_step(); print steps + 0, bad + 0, literals + 0, escaped + 0, continued + 0 }
  ' "$1"
}

workflow_dir='.github/workflows'
setup_node_steps=0

# An absent workflow directory is not "nothing to check" — it is the check losing its
# subject, which is how a gate quietly stops enforcing anything.
[ -d "$workflow_dir" ] ||
  abort "${workflow_dir} is missing; the setup-node rule would not be enforced at all"

while IFS= read -r workflow; do
  [ -n "$workflow" ] || continue

  read -r file_steps file_bad file_literals file_escaped file_continued <<EOF
$(scan_setup_node_steps "$workflow")
EOF
  setup_node_steps=$((setup_node_steps + file_steps))

  if [ "$file_bad" -gt 0 ]; then
    fail "${workflow} has ${file_bad} actions/setup-node step(s) without \`node-version-file: '.nvmrc'\`"
  fi

  if [ "$file_literals" -gt 0 ]; then
    fail "${workflow} pins a literal node-version in ${file_literals} place(s); read the version from \`node-version-file: '.nvmrc'\` instead"
  fi

  if [ "$file_escaped" -gt 0 ]; then
    fail "${workflow} spells ${file_escaped} mapping key(s) with YAML escape sequences; this gate reads keys, not escapes, so spell them plainly"
  fi

  if [ "$file_continued" -gt 0 ]; then
    fail "${workflow} continues a double-quoted scalar past the end of ${file_continued} line(s); this gate reads a line at a time, so keep each quoted scalar on one line"
  fi

  if grep -q 'vars\.NODE_VERSION' "$workflow"; then
    fail "${workflow} reads vars.NODE_VERSION; pin Node through .nvmrc, whose value is reviewable"
  fi
done <<EOF
$(find "$workflow_dir" -type f \( -name '*.yml' -o -name '*.yaml' \) | sort)
EOF

[ "$setup_node_steps" -gt 0 ] ||
  abort "no actions/setup-node step found in any workflow; the check would pass vacuously"

# --- Result ---------------------------------------------------------------------
if [ "$failures" -gt 0 ]; then
  echo "::error::node-version: ${failures} source(s) disagree with .nvmrc (${nvmrc_version}); update them, never loosen the pin"
  exit 1
fi

echo "node-version: OK (${nvmrc_version} across ${node_bases_checked} base image(s) in ${dockerfiles_checked} Dockerfile(s), engines.node, and ${setup_node_steps} setup-node step(s))"
