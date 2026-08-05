/**
 * Hardening for links that open a new browsing context (#382 F2).
 *
 * A `target="_blank"` link without `rel="noopener"` hands the opened document a
 * live `window.opener` handle back into this origin (reverse tabnabbing), and
 * without `rel="noreferrer"` the full referring URL leaks to the third-party
 * destination. Modern browsers imply `noopener` for `_blank`, but older and
 * embedded webviews do not, and the referrer leak is unconditional — so both
 * tokens are set explicitly rather than inherited from browser behaviour.
 *
 * Callers may still pass their own `rel`: the required tokens are merged into
 * whatever was provided instead of replacing it, so a link can add e.g.
 * `nofollow` without silently losing the hardening.
 */

export const BLANK_TARGET = '_blank' as const;

export const REQUIRED_BLANK_REL_TOKENS: readonly string[] = Object.freeze([
  'noopener',
  'noreferrer',
] as const);

export function resolveExternalLinkRel(target?: string, rel?: string): string | undefined {
  if (target !== BLANK_TARGET) {
    return rel;
  }

  const tokens: string[] = (rel ?? '').split(/\s+/).filter(Boolean);
  const missing: readonly string[] = REQUIRED_BLANK_REL_TOKENS.filter(
    token => !tokens.includes(token)
  );

  return [...tokens, ...missing].join(' ');
}
