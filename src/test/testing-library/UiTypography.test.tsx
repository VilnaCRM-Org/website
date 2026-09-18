import { render } from '@testing-library/react';

import { UiTypography } from '@/components';

import { testText } from './constants';

describe('UiTypography', () => {
  it('should render the Typography component with the correct props', () => {
    const { getByText } = render(
      <UiTypography component="a" variant="h1">
        {testText}
      </UiTypography>
    );

    const typography: HTMLElement = getByText(testText);
    expect(typography).toBeInTheDocument();
  });

  it('should render the Typography component with the default props', () => {
    const { getByText } = render(<UiTypography>{testText}</UiTypography>);

    const typography: HTMLElement = getByText(testText);
    expect(typography.tagName).toBe('P');
  });

  it('forwards aria-hidden so a decorative glyph can be hidden from assistive tech', () => {
    const { getByText } = render(<UiTypography aria-hidden>{testText}</UiTypography>);

    expect(getByText(testText)).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders no aria-hidden attribute unless asked to', () => {
    const { getByText } = render(<UiTypography>{testText}</UiTypography>);

    expect(getByText(testText)).not.toHaveAttribute('aria-hidden');
  });
});
