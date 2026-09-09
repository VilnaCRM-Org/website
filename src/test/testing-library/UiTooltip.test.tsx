import { ThemeProvider } from '@mui/material';
import { render, RenderResult, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UiTooltip } from '@/components';
import theme from '@/components/ui-color-theme';

import { testText } from './constants';

const title: string = testText;
const TRIGGER_LABEL: string = 'Password hint';

/**
 * The keyboard and ARIA contract the toolkit's tooltip adds over the local one
 * this repo used to ship (#458, FR7). It is the accessibility upgrade the swap
 * exists to buy, so it is asserted here rather than assumed: a pointer-only
 * tooltip is unreachable for a keyboard user, and an `aria-expanded` that never
 * changes tells a screen-reader user the wrong thing.
 */
function renderTooltip(): RenderResult {
  return render(
    <ThemeProvider theme={theme}>
      <UiTooltip title={title} placement="top" arrow triggerLabel={TRIGGER_LABEL}>
        <div>{testText}</div>
      </UiTooltip>
    </ThemeProvider>
  );
}

describe('UiTooltip', () => {
  it('exposes the trigger as a focusable button with an accessible name', () => {
    const { getByRole } = renderTooltip();
    const trigger: HTMLElement = getByRole('button', { name: TRIGGER_LABEL });

    expect(trigger).toHaveAttribute('tabindex', '0');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on Enter and reflects the open state in aria-expanded', async () => {
    const { getByRole } = renderTooltip();
    const trigger: HTMLElement = getByRole('button', { name: TRIGGER_LABEL });

    trigger.focus();
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
    expect(trigger).toHaveAttribute('aria-controls');
  });

  it('opens on Space, so the trigger behaves like the button role it claims', async () => {
    const { getByRole } = renderTooltip();
    const trigger: HTMLElement = getByRole('button', { name: TRIGGER_LABEL });

    trigger.focus();
    await userEvent.keyboard(' ');

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('closes on Escape without moving focus away from the trigger', async () => {
    const { getByRole } = renderTooltip();
    const trigger: HTMLElement = getByRole('button', { name: TRIGGER_LABEL });

    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
    expect(trigger).toHaveFocus();
  });

  // Both real call sites (`sign-up-fields.tsx`, `ui-card-item/card-content.tsx`)
  // wrap content that already names the control — an `<Image>` with localized
  // alt text, and visible typography. They deliberately pass no `triggerLabel`:
  // an `aria-label` would OVERRIDE that visible text, and a name that does not
  // contain it breaks WCAG 2.5.3 (Label in Name). This asserts the default path
  // those call sites actually use.
  it('takes its accessible name from its contents when no triggerLabel is given', () => {
    const { getByRole } = render(
      <ThemeProvider theme={theme}>
        <UiTooltip title={title} placement="top" arrow>
          <span>{testText}</span>
        </UiTooltip>
      </ThemeProvider>
    );

    expect(getByRole('button', { name: testText })).toBeInTheDocument();
  });

  it('still opens on click, so the pointer path the site already shipped survives', async () => {
    const { getByRole } = renderTooltip();
    const trigger: HTMLElement = getByRole('button', { name: TRIGGER_LABEL });

    await userEvent.click(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
