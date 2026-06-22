/**
 * Integration coverage for the Notification barrel (`index.tsx`).
 *
 * Imports the default export through the barrel and renders it inside the
 * integration jsdom-fetch environment with i18next initialised by
 * `jest.setup.ts`. Rendering both the success and error variants through the
 * barrel proves the re-export resolves to the real `Notification` controller.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';

import Notification from '@components/Notification';
import { NotificationStatus } from '@components/Notification/types';

const successTitle: string = t('notifications.success.title');
const errorTitle: string = t('notifications.error.title');

describe('Notification barrel integration', () => {
  it('renders the success variant through the barrel export', () => {
    render(
      <Notification
        type={NotificationStatus.SUCCESS}
        isOpen
        setIsOpen={jest.fn()}
        onRetry={jest.fn()}
        loading={false}
      />
    );

    expect(screen.getByText(successTitle)).toBeInTheDocument();
  });

  it('renders the error variant through the barrel export', () => {
    render(
      <Notification
        type={NotificationStatus.ERROR}
        isOpen
        setIsOpen={jest.fn()}
        onRetry={jest.fn()}
        loading={false}
      />
    );

    expect(screen.getByText(errorTitle)).toBeInTheDocument();
  });
});
