import { ThemeProvider } from '@mui/material';
import { render, fireEvent } from '@testing-library/react';

import { UiButton } from '@/components';
import { theme } from '@/components/UiButton/theme';

import { testText } from './constants';

describe('UiButton', () => {
  it('renders the button with the correct props', () => {
    const onClick: () => void = jest.fn();
    const { getByRole } = render(
      <ThemeProvider theme={theme}>
        <UiButton
          variant="contained"
          size="medium"
          disabled={false}
          fullWidth={false}
          type="button"
          onClick={onClick}
          sx={{ color: 'red' }}
          name="my-button"
        >
          {testText}
        </UiButton>
      </ThemeProvider>
    );

    const button: HTMLElement = getByRole('button', { name: testText });
    expect(button).toBeEnabled();
    expect(button).toBeInTheDocument();
  });

  it('forwards native button attributes to the rendered button element', () => {
    const { getByRole } = render(
      <ThemeProvider theme={theme}>
        <UiButton id="cta-button" data-testid="cta-button" aria-describedby="button-help">
          {testText}
        </UiButton>
      </ThemeProvider>
    );

    const button: HTMLElement = getByRole('button', { name: testText });

    expect(button).toHaveAttribute('id', 'cta-button');
    expect(button).toHaveAttribute('data-testid', 'cta-button');
    expect(button).toHaveAttribute('aria-describedby', 'button-help');
  });

  it('forwards native link attributes when rendered as an anchor', () => {
    const { getByRole } = render(
      <ThemeProvider theme={theme}>
        <UiButton
          href="#signUp"
          id="cta-link"
          data-testid="cta-link"
          target="_blank"
          rel="noreferrer"
          aria-describedby="link-help"
        >
          {testText}
        </UiButton>
      </ThemeProvider>
    );

    const link: HTMLElement = getByRole('link', { name: testText });

    expect(link).toHaveAttribute('id', 'cta-link');
    expect(link).toHaveAttribute('data-testid', 'cta-link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(link).toHaveAttribute('aria-describedby', 'link-help');
  });

  it('calls the onClick handler when the button is clicked', () => {
    const onClick: () => void = jest.fn();
    const { getByRole } = render(
      <ThemeProvider theme={theme}>
        <UiButton onClick={onClick}>{testText}</UiButton>
      </ThemeProvider>
    );

    const button: HTMLElement = getByRole('button', { name: testText });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
