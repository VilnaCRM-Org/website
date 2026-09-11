export const BLANK_TARGET = '_blank' as const;

export const REQUIRED_BLANK_REL_TOKENS: readonly string[] = Object.freeze([
  'noopener',
  'noreferrer',
] as const);

export function resolveExternalLinkRel(target?: string, rel?: string): string | undefined {
  if (target?.toLowerCase() !== BLANK_TARGET) {
    return rel;
  }

  const tokens: string[] = (rel ?? '').split(/\s+/).filter(Boolean);
  const missing: readonly string[] = REQUIRED_BLANK_REL_TOKENS.filter(
    token => !tokens.includes(token)
  );

  return [...tokens, ...missing].join(' ');
}
