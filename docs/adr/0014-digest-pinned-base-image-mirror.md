# ADR 0014: CI fetches a refused base image from a digest-pinned mirror

- **Status:** Accepted
- **Date:** 2026-09-29
- **Deciders:** website maintainers
- **Related:** issues #509, #506, #505, #370, and the ECR-quota share of #485; ADR 0002;
  [`scripts/ci/ecr-mirror.sh`](../../scripts/ci/ecr-mirror.sh),
  [`.github/actions/dev-container/action.yml`](../../.github/actions/dev-container/action.yml)

## Context

Every image CI builds starts from ECR Public: the dev, prod, Apollo, Mockoon and
memory-leak images from `public.ecr.aws/docker/library/node:<tag>@sha256:<digest>`, the
k6 image from the same namespace's `golang` and `alpine`. The registry is ECR Public
because `make lint-docker-policy` forbids Docker Hub in any Dockerfile (#370), after four
migrations away from Docker Hub's pull limits. BuildKit resolves each base manifest on
every build, even when a layer cache holds every layer.

ECR Public caps anonymous pulls per source IP, and GitHub's hosted runners share their
IPs. The refusal it sends is `429 toomanyrequests: Data limit exceeded` — a quota on the
address, not a burst limit. #505 added a wait of about ten minutes with a growing
back-off before the dev-container build; on the runners it then failed six attempts out
of six, on the scheduled Storybook build (#509), every nightly mutation census shard
(#506) and the Dependabot pull requests' static and dependency-cruiser jobs. It threw
away the registry's error text, so the logs never said why. The prod-stack jobs (e2e,
visual, accessibility, memory leak, load) and the `make build-out` jobs pull the same
bases and hit the same quota; the e2e and visual jobs had grown five-attempt
`start-prod` loops with the same back-off.

Those refusals are three of the five checks that keep `main` red under #485. The other
two are not image pulls and this decision does not touch them: the release job's version
check (`package.json` is at 1.6.0 while tag `v1.7.0` exists) and the #494 deploy
credentials.

The `FROM` line carries the manifest digest, and the digest identifies the content: a
fetch by digest from any registry returns the same bytes or fails. `mirror.gcr.io` is
Google's pull-through cache of Docker Hub, and ECR Public's `docker/library` namespace
republishes the same Docker official images with the same digests. BuildKit's named
build contexts redirect one `FROM` ref to another source without editing the Dockerfile,
and every build path CI uses can carry one: `docker/build-push-action`'s
`build-contexts`, `docker build --build-context`, and Compose's
`build.additional_contexts`, which accepts a full `name:tag@sha256:…` ref as its key
(verified on Compose v2.35 and v5.1). A local probe confirmed the combination: with the
named context, BuildKit loaded metadata only from `mirror.gcr.io`, the layer cache
written by an ECR build was reused, and the image ID matched the ECR build exactly.

The options genuinely available were to keep waiting (it does not clear a quota), to
authenticate to ECR Public (a credential and an AWS role on every pull request,
including forks and Dependabot, which get no secrets), to move the `FROM` lines to
another registry (reverses #370 for every build, local ones included), to configure a
BuildKit registry mirror (it keeps the repository path, and `mirror.gcr.io` has no
`docker/library/` path), or to change only how CI transports the bytes it already pins.

## Decision

We fetch a base image from its digest-identical `mirror.gcr.io` copy whenever ECR Public
refuses it in CI, and never change what is fetched.

- `scripts/ci/ecr-mirror.sh` reads every `FROM` of a Dockerfile (continuation lines
  folded) and maps each `public.ecr.aws/docker/library/<name>[:<tag>]@sha256:<digest>`
  to `mirror.gcr.io/library/<name>@sha256:<same digest>`. An ECR ref in that namespace
  without a 64-character lowercase digest, a FROM with no image, and an `# escape=`
  directive fail the run rather than being guessed. Stages, `scratch` and images outside
  that namespace are left alone — the equivalence is not established for them. The
  mirror ref never carries a tag, so no mutable tag can decide the bytes.
- With `--probe` it asks ECR Public for each distinct manifest once per call, prints the
  registry's error text as an escaped warning when it refuses, and redirects only the
  refused refs. Calls that share an `ECR_MIRROR_VERDICTS` file ask once between them and
  reuse the recorded verdict, so they cannot disagree about a ref. It writes its step
  outputs and Compose overrides itself, so no workflow appends an opaque command's output
  to `$GITHUB_OUTPUT`.
- The dev-container composite builds with the probed contexts, and its second attempt
  always uses the mirror.
- The Makefile's `ECR_MIRROR` (`off` by default, `probe`, `always`, anything else a hard
  error) makes `ecr-mirror-overrides` a prerequisite of every target that builds the
  prod, test, k6 or memory-leak images. It writes a Compose override per project and a
  context list for `build-out` into `ECR_MIRROR_DIR` — outside the repository, never
  committed — and the compose file variables add `-f <override>` only when the mode is
  on and the file exists. With `off`, every command line is byte-for-byte what it was.
  The target's three script calls share one verdict file, which it clears first unless
  `ECR_MIRROR_KEEP_VERDICTS=1`; when the mode is on, `test-memory-leak` passes that to
  the recursive make that runs the Memlab stack, so the verdicts `start-prod` just took
  are reused, not re-asked.
- The prod-stack, `build-out` and Dockerfile-performance jobs set `ECR_MIRROR: probe`;
  the e2e and visual `start-prod` retries switch to `always`, because ECR can refuse a
  blob part-way through a build whose manifest probe it answered.
- Every Dockerfile stays on ECR Public, so `make lint-docker-policy` and local builds are
  unchanged. `tests/bats/ecr_mirror.bats` pins the derivation, each refusal and the
  Makefile wiring; `tests/bats/docker_perf.bats` pins the performance job's arguments.

Deliberately left on ECR: the nightly Docker build canary, whose job is to notice
registry breakage rather than route around it; `devcontainer-smoke.yml`, whose
`devcontainers/ci` action builds through the Dev Containers CLI and takes no named
context; and the Lighthouse jobs, which build on the host with no image at all.

## Consequences

### What this buys

The container-built gates stop failing on a quota the repository cannot raise, without a
credential, and without loosening either pin. A refusal is now named in the log instead
of being inferred from a timeout, and a refused run costs one manifest request per base
rather than minutes of back-off.

### What this costs

A CI build may now depend on a second third party. `mirror.gcr.io` caches frequently
pulled images and is not obliged to hold a given digest: after a Dependabot bump the new
digest can be missing there while ECR Public is also refusing, and that run fails. The
image is still byte-identical when it is served, but its transport is Google's cache of
Docker Hub — the registry #370 moved away from — so its availability, not its content,
is what the build trusts. That includes the release-provenance build, whose attestation
still names the same inputs. The redirect only covers the `docker/library` namespace;
a base image from another ECR namespace is left on ECR and needs its own decision. The
probe costs one manifest request per distinct base each time it runs: once per make
invocation that builds (three today — node, and the k6 image's golang and alpine), once
per dev-container build, and once for each of the Dockerfile-performance job's base and
head builds; the `always` retries do not probe. A new build path — another compose
project, another `docker build` — is not covered until it is wired to `ECR_MIRROR` too.

The probe only answers for the manifest. ECR can still refuse a layer blob part-way
through a build whose probe it answered, and only the dev-container composite and the
e2e and visual `start-prod` steps retry with `always`. Every other job wired here makes
one probe-mode attempt, as it made one attempt before, and can still fail on a
mid-build refusal. In the accessibility, memory-leak, load, e2e burn-in and flake-census
jobs the stack comes up inside the target that runs the tests, so a retry there would
re-run the tests too — a retry budget the flake gates forbid — and closing it means
splitting the bring-up from the tests, as e2e and visual already do. The `build-out`
jobs (build artifact, release provenance, link check) and the Dockerfile-performance
builds could take an `always` retry directly, at the price of doubling the time a
genuine build failure takes to report; that is left for a follow-up.

### What would reverse it

ECR Public raising or removing its anonymous quota for GitHub's runner ranges, the
repository gaining a pull-through cache or authenticated pulls it controls, or
`mirror.gcr.io` refusing digests often enough that the fallback stops helping.
