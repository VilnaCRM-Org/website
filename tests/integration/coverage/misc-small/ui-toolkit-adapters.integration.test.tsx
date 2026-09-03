/**
 * Integration: the `@vilnacrm/ui-toolkit` adapters.
 *
 * `UiButton` and `UiLink` are the two primitives this repo does not take from the
 * toolkit verbatim — each re-adds a contract the toolkit forwards at runtime but
 * does not model. These cases drive both sides of every branch in that seam
 * against the REAL toolkit components.
 */
import { render } from '@testing-library/react';

import { UiButton, UiLink } from '@/components';

const HARDENED_REL: string = 'noopener noreferrer';
const HREF: string = 'https://example.com';
const LABEL: string = 'Example';

describe('UiButton adapter', () => {
  it('forwards rel and target onto the anchor MUI renders for an href', () => {
    const { getByRole } = render(
      <UiButton href={HREF} target="_blank" rel="noreferrer">
        {LABEL}
      </UiButton>
    );

    const link: HTMLElement = getByRole('link', { name: LABEL });

    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('emits neither attribute when the caller passes neither', () => {
    const { getByRole } = render(<UiButton type="button">{LABEL}</UiButton>);

    const button: HTMLElement = getByRole('button', { name: LABEL });

    expect(button).not.toHaveAttribute('target');
    expect(button).not.toHaveAttribute('rel');
  });
});

describe('UiLink adapter', () => {
  it('hardens a lower-case blank target', () => {
    const { getByRole } = render(
      <UiLink href={HREF} target="_blank">
        {LABEL}
      </UiLink>
    );

    expect(getByRole('link', { name: LABEL })).toHaveAttribute('rel', HARDENED_REL);
  });

  it('hardens a case-variant blank target the toolkit would miss', () => {
    const { getByRole } = render(
      <UiLink href={HREF} target="_BLANK">
        {LABEL}
      </UiLink>
    );

    expect(getByRole('link', { name: LABEL })).toHaveAttribute('rel', HARDENED_REL);
  });

  it('keeps caller tokens and de-duplicates the hardening ones', () => {
    const { getByRole } = render(
      <UiLink href={HREF} target="_blank" rel="nofollow noopener">
        {LABEL}
      </UiLink>
    );

    expect(getByRole('link', { name: LABEL })).toHaveAttribute(
      'rel',
      'nofollow noopener noreferrer'
    );
  });

  it('leaves a same-tab link alone and adds no new-tab hint to its name', () => {
    const { getByRole } = render(<UiLink href={HREF}>{LABEL}</UiLink>);

    const link: HTMLElement = getByRole('link', { name: LABEL });

    expect(link).not.toHaveAttribute('rel');
    expect(link).toHaveTextContent(LABEL);
  });

  it('renders a caller-supplied localized new-tab label', () => {
    const { getByRole } = render(
      <UiLink href={HREF} target="_blank" newTabLabel="(відкриється у новій вкладці)">
        {LABEL}
      </UiLink>
    );

    expect(
      getByRole('link', { name: `${LABEL} (відкриється у новій вкладці)` })
    ).toBeInTheDocument();
  });
});
