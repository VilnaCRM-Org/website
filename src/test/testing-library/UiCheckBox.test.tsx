import { render, fireEvent } from '@testing-library/react';

import { UiCheckbox } from '@/components';

import { expectNoA11yViolations } from '../a11y/expect-no-a11y-violations';

import { testText } from './constants';

const CHECKBOX_BOX_SELECTOR: string = '.ui-checkbox-box';
const DEFAULT_BORDER_COLOR: string = '#D0D4D8';
const HOVER_BORDER_COLOR: string = '#1eaeff';
const ERROR_BORDER_COLOR: string = '#DC3939';

const mockOnChange: () => void = jest.fn();

describe('UiCheckbox', () => {
  it('renders the checkbox with the provided label', () => {
    const { getByLabelText } = render(<UiCheckbox label={testText} onChange={mockOnChange} />);
    const checkboxLabel: HTMLElement = getByLabelText(testText);

    expect(checkboxLabel).toBeInTheDocument();
  });

  it('calls the onChange function when the checkbox is clicked', () => {
    const { getByRole } = render(<UiCheckbox onChange={mockOnChange} label={testText} />);
    const checkboxInput: HTMLElement = getByRole('checkbox');
    fireEvent.click(checkboxInput);
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('disables the checkbox when the disabled prop is true', () => {
    const { getByRole } = render(<UiCheckbox disabled onChange={mockOnChange} label={testText} />);
    const checkboxInput: HTMLElement = getByRole('checkbox');
    expect(checkboxInput).toBeDisabled();
  });

  // The checkbox renders MUI's control, so the styled box is the `icon` span the
  // component draws next to the (visually hidden) native input. The border
  // tokens are unchanged; only the node carrying them moved.
  function getCheckboxBox(container: HTMLElement): HTMLElement {
    const box: HTMLElement | null = container.querySelector(CHECKBOX_BOX_SELECTOR);
    if (box === null) throw new Error(`No element matched ${CHECKBOX_BOX_SELECTOR}`);
    return box;
  }

  it('applies default style when there is no error', () => {
    const { container } = render(<UiCheckbox label="Test" onChange={mockOnChange} />);

    expect(getCheckboxBox(container)).toHaveStyle(`border-color: ${DEFAULT_BORDER_COLOR}`);
  });

  // jsdom never applies `:hover`, so the token has to be read off the stylesheet
  // Emotion emitted rather than off a computed style. The pre-toolkit spec read
  // it out of the local `styles` object; that object now lives in the toolkit, and
  // reaching into a dependency's internals would assert the package rather than
  // what this app ships. The rendered rule is the observable both versions share,
  // so the hover token keeps its regression guard through the rendering-path
  // change the PR flags for visual review.
  it('keeps the hover border token on the styled box', () => {
    const { container } = render(<UiCheckbox label="Test" onChange={mockOnChange} />);
    getCheckboxBox(container);

    const emittedCss: string = Array.from(document.querySelectorAll('style'))
      .map(styleTag => styleTag.textContent ?? '')
      .join('');
    const hoverRule: string | undefined = emittedCss
      .replace(/\s+/g, '')
      .toLowerCase()
      .split('}')
      .find(
        rule =>
          rule.includes(':hover') && rule.includes(CHECKBOX_BOX_SELECTOR.slice(1).toLowerCase())
      );

    expect(hoverRule).toBeDefined();
    expect(hoverRule).toContain(`border-color:${HOVER_BORDER_COLOR}`);
  });

  it('applies error style when error prop is true', () => {
    const { container, getByRole } = render(
      <UiCheckbox error label={testText} onChange={mockOnChange} />
    );

    expect(getCheckboxBox(container)).toHaveStyle(`border-color: ${ERROR_BORDER_COLOR}`);
    expect(getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  });
  it('controls checkbox state with checked prop', () => {
    const { getByRole, rerender } = render(
      <UiCheckbox label="Test" onChange={mockOnChange} checked />
    );

    const checkboxInput: HTMLElement = getByRole('checkbox');
    expect(checkboxInput).toBeChecked();

    rerender(<UiCheckbox label="Test" onChange={mockOnChange} checked={false} />);
    expect(checkboxInput).not.toBeChecked();
  });

  it('has no WCAG 2.1 AA violations', async () => {
    const { container } = render(<UiCheckbox label={testText} onChange={mockOnChange} />);

    await expectNoA11yViolations(container);
  });
});
