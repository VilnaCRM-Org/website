# ADR 0014: CI fetches a refused base image from a digest-pinned mirror

- **Status:** Accepted
- **Date:** 2026-09-29
- **Deciders:** website maintainers
- **Related:** issues #509, #506, #485, #505, #370; ADR 0002;
  [`scripts/ci/base-image-source.sh`](../../scripts/ci/base-image-source.sh),
  [`.github/actions/dev-container/action.yml`](../../.github/actions/dev-container/action.yml)

## Context

Every containerised gate (ADR 0002) builds the Dockerfile's `base` stage, whose `FROM`
is `public.ecr.aws/docker/library/node:<tag>@sha256:<digest>`. The registry is ECR
Public because `make lint-docker-policy` forbids Docker Hub in any Dockerfile (#370),
after four migrations away from Docker Hub's pull limits. BuildKit resolves that
manifest on every build, even when the GitHub Actions layer cache holds every layer.

ECR Public caps anonymous pulls per source IP, and GitHub's hosted runners share their
IPs. The refusal it sends is `429 toomanyrequests: Data limit exceeded` — a quota on the
address, not a burst limit. #505 added a wait of about ten minutes with a growing
back-off before the build; on the runners it then failed six attempts out of six, on the
scheduled Storybook build (#509), every nightly mutation census shard (#506) and the
Dependabot pull requests' static and dependency-cruiser jobs. It threw away the
registry's error text, so the logs never said why.

The `FROM` line carries the manifest digest, and the digest identifies the content: a
fetch by digest from any registry returns the same bytes or fails. `mirror.gcr.io` is
Google's pull-through cache of Docker Hub, and ECR Public's `docker/library` namespace
republishes the same Docker official images with the same digests. BuildKit's named
build contexts can redirect one `FROM` ref to another source without editing the
Dockerfile. A local probe confirmed the combination: with the named context, BuildKit
loaded metadata only from `mirror.gcr.io`, the layer cache written by an ECR build was
reused, and the image ID matched the ECR build exactly.

The options genuinely available were to keep waiting (it does not clear a quota), to
authenticate to ECR Public (a credential and an AWS role on every pull request,
including forks and Dependabot, which get no secrets), to move the `FROM` to another
registry (reverses #370 for every build, local ones included), or to change only how CI
transports the bytes it already pins.

## Decision

We fetch the base image from the digest-identical `mirror.gcr.io` copy whenever ECR
Public refuses it in CI, and never change what is fetched.

- `scripts/ci/base-image-source.sh` reads the single `FROM <ref> AS base` line and
  derives `mirror.gcr.io/library/<name>@sha256:<same digest>`. It refuses — rather than
  guesses — any ref outside ECR Public's `docker/library` namespace, any ref without a
  64-character lowercase `sha256` digest, a `--platform` flag, a continued line, and zero
  or several `base` stages. The mirror ref never carries a tag, so no mutable tag can
  decide the bytes.
- The dev-container composite asks ECR Public for the manifest once, prints the
  registry's error text as a warning when it refuses, and builds with a
  `build-contexts` redirect in that case. The second build attempt always uses the
  mirror. The script writes the step outputs itself, so the workflow never appends an
  opaque command's output to `$GITHUB_OUTPUT`.
- Every Dockerfile stays on ECR Public, so `make lint-docker-policy` and local builds are
  unchanged. `tests/bats/base_image_source.bats` pins the derivation and each refusal.

Out of scope: the compose-built prod and test stacks, the nightly Docker build canary,
and `devcontainer-smoke.yml`, which build through `docker compose` or `devcontainers/ci`
and cannot take a named context without changing the compose files or the action.

## Consequences

### What this buys

The containerised gates stop failing on a quota the repository cannot raise, without a
credential, and without loosening either pin. A refusal is now named in the log instead
of being inferred from a timeout, and a refused run costs one manifest request rather
than ten minutes.

### What this costs

A CI build may now depend on a second third party. `mirror.gcr.io` caches frequently
pulled images and is not obliged to hold a given digest: after a Dependabot bump the new
digest can be missing there while ECR Public is also refusing, and that run fails. The
image is still byte-identical when it is served, but its transport is Google's cache of
Docker Hub — the registry #370 moved away from — so its availability, not its content,
is what the build trusts. The redirect also only works while the base ref has the
`docker/library` shape; a base image from another namespace fails closed here and needs
its own decision.

### What would reverse it

ECR Public raising or removing its anonymous quota for GitHub's runner ranges, the
repository gaining a pull-through cache or authenticated pulls it controls, or
`mirror.gcr.io` refusing digests often enough that the fallback stops helping.
