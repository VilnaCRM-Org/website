# Sign-up form hardening

The sign-up form is the only surface on this static site that accepts user input, so a
handful of its rules are load-bearing rather than incidental. Issues #378 and #382 fixed
them finding by finding; the landing README summarises the contract, and this note keeps
the reasoning that used to sit in the source (ADR 0005). Each section names the module
that carries the rule and the spec that pins it.

## F1 — Transport (`src/config/env.ts`)

The form POSTs a plaintext password to `NEXT_PUBLIC_GRAPHQL_API_URL`. Nothing previously
required that hop to be encrypted, so a deploy that pointed the variable at a remote
`http://` host — the repo's own `.env` uses `http://` for every URL — would have leaked
the password to any on-path attacker with no build-time signal at all.

Cleartext is therefore accepted only for loopback, where there is no network hop to
intercept and where the dev and Docker stacks genuinely run; remote `http://` fails the
build. `NEXT_PUBLIC_API_URL` is held to the same rule even though the mutation does not
use it: it is a Sentry trace-propagation target, so the browser attaches trace headers to
requests bound for that origin, which is not something to hand to a cleartext remote host
either. The complementary invariant — that the _committed production_ config is `https`
and never loopback — is `src/test/unit/prod-env-transport.test.ts`, because `NODE_ENV`
alone cannot distinguish a production export from a Storybook build. The shape of the
matching pattern is explained in `docs/extending-the-website.md`.

## F2 — Links that open a new browsing context

`src/shared/externalLinkRel.ts` is the single hardening point. A `target="_blank"` link
without `rel="noopener"` hands the opened document a live `window.opener` handle back into
this origin (reverse tabnabbing), and without `rel="noreferrer"` the full referring URL
leaks to the third-party destination. Modern browsers imply `noopener` for `_blank`, but
older and embedded webviews do not, and the referrer leak is unconditional — so both
tokens are set explicitly rather than inherited from browser behaviour. Callers may still
pass their own `rel`: the required tokens are merged into whatever was provided instead
of replacing it, so a link can add `nofollow` without silently losing the hardening. HTML
compares the reserved browsing-context names case-insensitively, so `_BLANK` is hardened
exactly like `_blank`.

- `src/components/ui-link` always leaves with `rel="noopener noreferrer"` on a `_blank`
  link, whether or not the caller remembered to pass it — which is why it is deliberately
  **not** listed in the ESLint `linkComponents` setting for `react/jsx-no-target-blank`:
  flagging it would only demand redundant markup.
- `src/components/social-media/social-media-item` renders `item.linkHref`, a free-form
  string and so the external-link sink most likely to become dynamic; it opens a new tab
  and therefore always carries the full hardening. Its icon is decorative: the link owns
  the accessible name through `aria-label`, and a second, differently-worded name on the
  image would leave assistive tech announcing two names for one control.

## F3 — Telemetry, autofill and the accessibility tree

**Handled-error reporting** (`src/lib/telemetry/report-error.ts`). A failed submission
used to produce a toast and nothing else — no exception, no counter, no log, since
`compiler.removeConsole` already strips `console.*` from the production bundle — so
credential stuffing or enumeration probes against the live mutation were invisible from
the application side. `reportHandledError` sends the exception plus two **static** tags
(`feature`, `action`) and nothing derived from the submitted values; `captureException`
serialises whatever it is given, so the PII contract is that nothing else is ever passed.
`auth-layout.tsx` calls it from the submit failure path for the same reason.

**Session replay is masked** (`pages/_app.tsx`). The only interactive surface is this
form, so an unmasked replay would record the password field keystroke by keystroke.
Masking is Sentry's default; pinning `maskAllInputs`, `maskAllText`, `blockAllMedia` and
`sendDefaultPii: false` means an upstream default change cannot silently start capturing
credentials. `tracePropagationTargets` drops empty origins, because `''`
substring-matches every URL and would attach trace headers to all outbound requests.

**Password managers** (`sign-up-fields.tsx`, `src/components/ui-input/types.ts`).
Browser autofill keys off `name` and `autocomplete` together; without both, a credential
field is effectively invisible to a password manager and no strong password is ever
offered. Both password fields use `new-password` — this is account creation, never a
sign-in.

**ARIA lands on the `<input>`** (`src/components/ui-input`, `ui-text-field-form`). Passed
as top-level `TextField` props, `aria-*` attributes decorate the wrapping `FormControl`,
where assistive tech never reads them. Each is emitted only when it carries meaning —
`aria-required="false"` and an empty `aria-describedby` are noise. `aria-required` is
emitted instead of the native `required`, which would hand validation to the browser and
pre-empt the react-hook-form messages the suites assert. The `id` prop was once accepted
by the type (inherited from `TextFieldProps`) but silently dropped, so every
`<label htmlFor>` pointed at nothing; an external `aria-describedby` is composed with the
internally-owned validation-message id rather than replacing it.

**The validation message is a live region** (`ui-text-field-form/index.tsx`). Its
container is rendered unconditionally: a live region has to exist in the accessibility
tree before its content changes, otherwise mounting and filling it in the same commit is
announced inconsistently across screen readers. `aria-live="polite"` rather than
`role="alert"` keeps blur-triggered validation from interrupting the label of the field
the user has just moved to. The node is absolutely positioned inside a fixed-height row,
so an empty one occupies no space. `src/components/ui-typography` forwards props through
an explicit allow-list, which is why `aria-live` / `aria-atomic` are named there. The
field also receives `field.name` (not the prop) so the submitted name always tracks the
registered field, and `field.ref` — react-hook-form's callback ref — so the library can
move focus to the first invalid input on submit. `required` is accepted either as a
message/boolean or as a `{ value, message }` object whose `value` can be `false`;
coercing the object itself would announce every such field as required.

**The form is named by its own localized heading** (`auth-form.tsx`), not a hardcoded
English identifier screen readers used to announce verbatim.

## F4 — Password policy and confirmation

- **Policy** (`validations/password.ts`): 8–64 characters with at least one digit, one
  uppercase and one lowercase letter, Unicode-aware so a Cyrillic password such as
  `Пароль123` satisfies the case rules the same way a Latin one does. Length + digit +
  uppercase alone accepted `PASSWORD1`; requiring a lowercase letter brings the enforced
  policy in line with the character classes the tip already advertises.
- **The policy is stated up front** (`sign-up-fields.tsx`, `visuallyHidden` in
  `styles.ts`): the tooltip is a pointer-only affordance, so the rules also need a form
  the keyboard and screen-reader path can reach before the first rejection. The hidden
  statement is an absolutely positioned, 1px clipped box that takes part in no flex
  layout, so it adds no gap and moves no pixel in the visual baselines.
- **Confirm password** (`validations/confirm-password.ts`, `types/authentication/form.ts`)
  is a client-side typo guard only, never part of the mutation input. Registration is the
  one place a typo is unrecoverable — the account is created with a password the user
  never intended and cannot guess afterwards. The rule reads the sibling `Password` value
  react-hook-form passes as the second `validate` argument, so it stays a pure function of
  the form values. There is deliberately **no** react-hook-form `deps` link between the
  two fields: it would `trigger()` the confirmation the moment the password is touched,
  showing a "required" error on a field the user has not reached yet, which contradicts
  the form's `onTouched` mode. A mismatch can still never be submitted — `handleSubmit`
  re-validates every field before calling `onSubmit`.
- **Card height** (`auth-form/styles.ts`, `notification/styles.success.ts`). The form
  card clips with `overflow: hidden` + `contain: content` rather than scrolling, so its
  two `maxHeight` caps are sized against the field count. Both were raised by one input
  row when the confirm-password field landed — by the row height that actually applies at
  each breakpoint, which is not the same number: ≤1130px renders a 4.938rem input (see
  `ui-input/theme.ts`) for a ~123.8px row, while ≤sm falls back to the 4.5rem
  `inputWrapper` minimum for an 87px row. Sizing both from the mobile row would leave the
  submit button flush against the card edge on every tablet/laptop width, a band no visual
  baseline covers. The success notification replaces the card in place, so it has no
  `maxHeight` at all — `height: 100%` resolves against the form wrapper, which the card
  sizes. The old `maxHeight: 40.438rem` was paired with a `formContent.minHeight` of the
  same value, so it matched only while the form was at its minimum height; the extra
  field made the card taller and left the notification ending short of the section on
  every viewport wider than `sm`. The per-breakpoint `minHeight` values remain as floors.

## Error copy (`src/features/landing/helpers/handleApolloError.ts`)

Anything the status / `UNAUTHORIZED` mapping does not recognise falls back to a generic
localized message. Echoing `graphQLErrors[].message` verbatim — as that branch used to —
turns the sign-up form into an account-enumeration oracle ("user with this email already
exists") and pipes internal server wording straight into the UI (#378 F2, CWE-209).
