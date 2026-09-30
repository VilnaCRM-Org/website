import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';
import React from 'react';

import MyApp from '../../../pages/_app';

type DynamicOptions = { loading?: () => React.ReactNode };

jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock(
  'next/dynamic',
  () =>
    (_loader: unknown, options?: DynamicOptions): (() => React.ReactNode) =>
    (): React.ReactNode =>
      options?.loading?.() ?? null
);
jest.mock('../../lib/pwa/register-service-worker', () => ({ initServiceWorker: jest.fn() }));
jest.mock(
  '../../components/header-placeholder',
  () =>
    function MockHeaderPlaceholder(): React.ReactElement {
      return <p>Header placeholder</p>;
    }
);

function Page(): React.ReactElement {
  return <p>Page content</p>;
}

describe('pages/_app header placeholder', () => {
  it.each(['/', '/en', '/swagger'])(
    'holds the header place on %s until the client-only header chunk mounts',
    (pathname: string) => {
      (useRouter as jest.Mock).mockReturnValue({ pathname });

      render(<MyApp Component={Page} />);

      expect(
        screen
          .getByText('Header placeholder')
          .compareDocumentPosition(screen.getByText('Page content'))
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  );
});
