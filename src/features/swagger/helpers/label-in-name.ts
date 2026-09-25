export function labelInName(children: unknown, ariaLabel: string | undefined): string | undefined {
  const visibleText: string = typeof children === 'string' ? children.trim() : '';

  return visibleText.length > 0 ? undefined : ariaLabel;
}
