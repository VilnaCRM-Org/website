import { render } from '@testing-library/react';

import { UiLink } from '@/components';

import { testText, testUrl } from './constants';

describe('UiLink', () => {
  it('renders the Link with the provided children and href', () => {
    const testHref: string = testUrl;
    const { getByText } = render(<UiLink href={testHref}>{testText}</UiLink>);
    const linkElement: HTMLElement = getByText(testText);
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', testHref);
  });

  it('applies the theme provided to the Link', () => {
    const { getByText } = render(<UiLink href={testUrl}>{testText}</UiLink>);
    const linkElement: HTMLElement = getByText(testText);
    expect(linkElement).toBeInTheDocument();
  });

  // #382 F2: a new-tab link must never rely on the caller remembering `rel`.
  it('hardens a new-tab link even when no rel is passed', () => {
    const { getByText } = render(
      <UiLink href={testUrl} target="_blank">
        {testText}
      </UiLink>
    );

    expect(getByText(testText)).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps a caller-supplied rel and adds the missing hardening tokens', () => {
    const { getByText } = render(
      <UiLink href={testUrl} target="_blank" rel="nofollow">
        {testText}
      </UiLink>
    );

    expect(getByText(testText)).toHaveAttribute('rel', 'nofollow noopener noreferrer');
  });

  it('hardens a case-variant blank target the same way', () => {
    const { getByText } = render(
      <UiLink href={testUrl} target="_BLANK">
        {testText}
      </UiLink>
    );

    expect(getByText(testText)).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('leaves a same-tab link without a rel attribute', () => {
    const { getByText } = render(<UiLink href={testUrl}>{testText}</UiLink>);

    expect(getByText(testText)).not.toHaveAttribute('rel');
  });
});
