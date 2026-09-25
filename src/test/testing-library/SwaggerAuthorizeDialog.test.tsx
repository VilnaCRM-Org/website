import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AxeResults } from 'axe-core';
import i18n, { t } from 'i18next';
import { axe } from 'jest-axe';
import React, { ComponentType, ReactNode } from 'react';

import {
  authorizeDialogPlugin,
  ButtonProps,
  CloseIconProps,
  withCloseLabel,
  withLabelInName,
} from '@swagger/components/api-documentation/authorize-dialog';

import { expectNoA11yViolations } from '../a11y/expect-no-a11y-violations';

/**
 * label-content-name-mismatch is always `incomplete` under jsdom (no canvas), so the Button
 * cases assert the accessible name; the rule's verdict is the e2e swaggerAuthorizeDialog scan.
 * Loading / error — Not applicable: synchronous wrappers with no async boundary.
 * Permission / auth — Not applicable: the wrappers render the same for every visitor.
 * The icon stub mirrors close.jsx: aria-hidden precedes {...rest}, so only an explicit
 * undefined removes it.
 */
function UpstreamCloseIcon({
  width = 20,
  height = 20,
  ...rest
}: CloseIconProps): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      width={width}
      height={height}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d="M14.348 14.849 10 11.819" />
    </svg>
  );
}

function UpstreamButton({ className = '', ...rest }: ButtonProps): React.ReactElement {
  return <button type="button" {...rest} className={`${className} button`} />;
}

function CloseControl({ icon }: { icon: ReactNode }): React.ReactElement {
  return (
    <button type="button" className="close-modal">
      {icon}
    </button>
  );
}

const LabelledCloseIcon: ComponentType<CloseIconProps> = withCloseLabel(UpstreamCloseIcon);
const LabelInNameButton: ComponentType<ButtonProps> = withLabelInName(UpstreamButton);

async function buttonNameViolations(container: HTMLElement): Promise<string[]> {
  const results: AxeResults = (await axe(container, {
    runOnly: { type: 'rule', values: ['button-name'] },
  })) as AxeResults;

  return results.violations.flatMap(violation => violation.nodes.map(node => node.html));
}

describe('withCloseLabel (#433 button-name)', () => {
  const closeLabel: () => string = () => t('api_documentation.authorize_dialog.close');

  it('names the close-modal button from its icon', () => {
    render(<CloseControl icon={<LabelledCloseIcon />} />);

    const closeButton: HTMLElement = screen.getByRole('button', { name: closeLabel() });

    expect(closeButton).toHaveClass('close-modal');
  });

  it('exposes the svg as a named image instead of hiding it', () => {
    render(<CloseControl icon={<LabelledCloseIcon />} />);

    const icon: HTMLElement = screen.getByRole('img', { name: closeLabel() });

    expect(icon).not.toHaveAttribute('aria-hidden');
    expect(icon).toHaveAttribute('focusable', 'false');
    expect(icon).toHaveAttribute('width', '20');
  });

  it('adds no text content, so the dialog keeps a single "Close" text button', () => {
    render(<CloseControl icon={<LabelledCloseIcon />} />);

    expect(screen.getByRole('button', { name: closeLabel() })).toHaveTextContent(/^$/);
  });

  it('keeps the props swagger-ui passes to the icon', () => {
    render(<CloseControl icon={<LabelledCloseIcon width={16} className="close-icon" />} />);

    const icon: HTMLElement = screen.getByRole('img', { name: closeLabel() });

    expect(icon).toHaveAttribute('width', '16');
    expect(icon).toHaveClass('close-icon');
  });

  it('fails button-name on the upstream markup and passes once wrapped', async () => {
    const upstream: HTMLElement = render(<CloseControl icon={<UpstreamCloseIcon />} />).container;
    const wrapped: HTMLElement = render(<CloseControl icon={<LabelledCloseIcon />} />).container;

    await expect(buttonNameViolations(upstream)).resolves.toEqual([
      expect.stringMatching(/^<button type="button" class="close-modal">/),
    ]);
    await expect(buttonNameViolations(wrapped)).resolves.toEqual([]);
    await expectNoA11yViolations(wrapped);
  });

  describe('in Ukrainian', () => {
    const initialLanguage: string = i18n.language;

    beforeEach(async () => {
      await act(async () => {
        await i18n.changeLanguage('uk');
      });
    });

    afterEach(async () => {
      await act(async () => {
        await i18n.changeLanguage(initialLanguage);
      });
    });

    it('reads the localized label', () => {
      render(<CloseControl icon={<LabelledCloseIcon />} />);

      expect(
        screen.getByRole('button', { name: i18n.t('api_documentation.authorize_dialog.close') })
      ).toHaveAccessibleName('Закрити діалог');
    });
  });
});

describe('withLabelInName (#433 label-content-name-mismatch)', () => {
  it.each<[string, string, string]>([
    ['the OAuth2 authorize button', 'Apply given OAuth2 credentials', 'Authorize'],
    ['the OAuth2 logout button', 'Remove authorization', 'Logout'],
    ['the API-key authorize button', 'Apply credentials', 'Authorize'],
  ])('names %s by its visible text', (_case, ariaLabel, visibleText) => {
    render(
      <LabelInNameButton className="btn modal-btn auth authorize" aria-label={ariaLabel}>
        {visibleText}
      </LabelInNameButton>
    );

    const button: HTMLElement = screen.getByRole('button', { name: visibleText });

    expect(button).toHaveAccessibleName(visibleText);
    expect(button).not.toHaveAttribute('aria-label');
    expect(screen.queryByRole('button', { name: ariaLabel })).not.toBeInTheDocument();
  });

  it('keeps every other prop, so the click handler and classes still work', async () => {
    const onClick: jest.Mock = jest.fn();

    render(
      <LabelInNameButton
        type="submit"
        className="btn modal-btn auth authorize"
        aria-label="Apply credentials"
        onClick={onClick}
      >
        Authorize
      </LabelInNameButton>
    );

    const button: HTMLElement = screen.getByRole('button', { name: 'Authorize' });
    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveClass('btn', 'modal-btn', 'auth', 'authorize', 'button');
  });

  it('leaves a button without an aria-label unchanged', () => {
    render(<LabelInNameButton className="btn modal-btn auth btn-done">Close</LabelInNameButton>);

    expect(screen.getByRole('button', { name: 'Close' })).not.toHaveAttribute('aria-label');
  });

  it.each<[string, ReactNode]>([
    ['array children', ['Edit', ' ']],
    ['an element child', <span key="icon">×</span>],
    ['whitespace-only text', '   '],
  ])('keeps the aria-label when the button has %s', (_case, children) => {
    render(<LabelInNameButton aria-label="Edit the example">{children}</LabelInNameButton>);

    expect(screen.getByRole('button', { name: 'Edit the example' })).toHaveAttribute(
      'aria-label',
      'Edit the example'
    );
  });
});

describe('authorizeDialogPlugin', () => {
  it('registers both wrappers under the component names swagger-ui looks up', () => {
    expect(authorizeDialogPlugin.wrapComponents.CloseIcon).toBe(withCloseLabel);
    expect(authorizeDialogPlugin.wrapComponents.Button).toBe(withLabelInName);
  });
});
