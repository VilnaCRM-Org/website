# The offline shell

The site's `site.webmanifest` declares `display: "standalone"`, so it is installable;
`public/sw.js` and `pages/offline.tsx` are what make that promise honest (issue #338).
`CLAUDE.md` ("Offline posture and the service worker") lists the constraints and the
gates; this note is the rationale behind the two halves that live in `src/` (ADR 0005).

## The document: `src/features/offline`

`pages/offline.tsx` is exported to `out/offline.html`, precached by the worker, and
reached only as `/offline.html` from inside the worker's `respondWith` — never by
navigation. The CloudFront edge function hard-404s the extensionless `/offline`, and
serving from cache keeps the address bar on the URL the visitor actually asked for. It is
`noindex` because it is a network artefact, not content.

`OfflineShell` is styled with inline `style` attributes rather than MUI `sx`. By
definition the document is served while the network is down, so neither the emotion
runtime nor the extracted `_next/static` CSS bundle can load — anything that needs
JavaScript or a stylesheet request would render as unstyled markup. Inline attributes are
serialized into the exported HTML itself, so they are the only styling that survives.
The style objects still live in the sibling `styles.ts` and read their colours from the
shared theme, so they cannot drift from the rest of the site.

- The font stack names only faces the operating system already has: the Golos webfont is
  a `_next/static` request that cannot resolve offline.
- The way back is a **link**, not a button. No JavaScript runs in this document, so a
  control that needs a click handler would be dead; `next/link` renders a plain
  `<a href="/">` into the exported HTML, so the navigation works with the runtime absent.
- The link is `darkPrimary` on `primary`, not white on `primary`: white measures 2.46:1,
  below the 4.5:1 that SC 1.4.3 needs for a 16px/600 label, and #423's contrast waiver is
  scoped to the three routes it was measured against so a new page fails closed. The
  chosen pair measures 6.96:1.

## Registration: `src/lib/pwa/register-service-worker.ts`

The worker itself lives in `public/sw.js` and is a fallback-only shell (see its header for
why it never caches at runtime). This module is the browser-side half: it decides whether
registering is safe, and when. It mirrors `src/lib/web-vitals/report-web-vitals.ts` —
ambient globals are read off `globalThis` through a cast rather than referenced bare, the
decision is a pure argument-injected predicate, and the orchestrator wired into
`pages/_app.tsx` stays a one-line call.

- **Scope.** The worker is served from `public/`, so its scope is the whole origin — every
  route gets the offline shell without a `Service-Worker-Allowed` header the static export
  cannot set.
- **`navigator` is modelled as optional.** It is absent in the Node Jest layers, and the
  DOM lib types `navigator.serviceWorker` as always present even though it is missing on
  insecure origins, in jsdom, and in some privacy modes — so both are widened to optional
  and the absence is handled as data rather than as an environment check.
- **Production only.** A worker installed by `next dev` would serve its shell across HMR
  reloads and mask a genuinely broken dev build. `shouldRegisterServiceWorker` takes both
  inputs as arguments so the decision is deterministic, and its type predicate lets the
  caller use the narrowed container without a redundant re-check.
- **Failures go to Sentry.** A rejected `register()` (unsupported scope, blocked storage,
  a 404 on the script after a partial deploy) must stay silent for the visitor — the site
  works without a worker — but must not vanish, so it is reported rather than logged to a
  console nobody reads.
- **Deferred until `load`.** Registration never competes with hydration or the LCP paint.
  `_app`'s effect can run either side of `load` depending on how long the subresources
  take, so an already-complete document runs the callback immediately rather than waiting
  for an event that will never fire again; `once` lets the browser drop the listener after
  it fires instead of holding the closure for the page's lifetime.
- **Registered from the routing root** (`pages/_app.tsx`) so the shell covers every route.
