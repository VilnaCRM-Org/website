/**
 * Loading / error — Not applicable: synchronous wrappers with no async boundary.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';
import React, { ComponentType, ReactNode } from 'react';

import {
  authorizeDialogPlugin,
  ButtonProps,
  CloseIconProps,
  withCloseLabel,
  withLabelInName,
} from '@swagger/components/api-documentation/authorize-dialog';
import type { SwaggerSystem } from '@swagger/components/api-documentation/responses-table';

import { applySwaggerPlugins } from '../../utils/swagger-plugins';

const system: SwaggerSystem = {
  fn: { withErrorBoundary: Component => Component },
  getComponent: () => {
    throw new Error('the authorize dialog wrappers never resolve components');
  },
};

function UpstreamCloseIcon(props: CloseIconProps): React.ReactElement {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" {...props}>
      <path d="M14.348 14.849 10 11.819" />
    </svg>
  );
}

function UpstreamButton({ className = '', ...rest }: ButtonProps): React.ReactElement {
  return <button type="button" {...rest} className={`${className} button`} />;
}

const CloseIcon: ComponentType<CloseIconProps> = applySwaggerPlugins(
  'CloseIcon',
  UpstreamCloseIcon,
  system
);
const Button: ComponentType<ButtonProps> = applySwaggerPlugins('Button', UpstreamButton, system);

describe('integration: authorize dialog plugins (#433)', () => {
  it('names the icon-only close-modal button', () => {
    render(
      <button type="button" className="close-modal">
        <CloseIcon />
      </button>
    );

    expect(
      screen.getByRole('button', { name: t('api_documentation.authorize_dialog.close') })
    ).toHaveClass('close-modal');
  });

  it.each<[string, string]>([
    ['Apply given OAuth2 credentials', 'Authorize'],
    ['Remove authorization', 'Logout'],
  ])('replaces the %p label with the visible %p', (ariaLabel, text) => {
    render(<Button aria-label={ariaLabel}>{text}</Button>);

    expect(screen.getByRole('button', { name: text })).not.toHaveAttribute('aria-label');
  });

  it.each<[string, ReactNode]>([
    ['array children', ['Cancel', ' ']],
    ['blank text', ' '],
  ])('keeps the aria-label for %s', (_case, children) => {
    render(<Button aria-label="Cancel editing">{children}</Button>);

    expect(screen.getByRole('button', { name: 'Cancel editing' })).toBeInTheDocument();
  });

  it('registers the wrappers under the names swagger-ui looks up', () => {
    expect(authorizeDialogPlugin.wrapComponents).toEqual({
      CloseIcon: withCloseLabel,
      Button: withLabelInName,
    });
  });

  it('leaves components no plugin wraps untouched', () => {
    expect(applySwaggerPlugins('Unwrapped', UpstreamButton, system)).toBe(UpstreamButton);
  });
});
