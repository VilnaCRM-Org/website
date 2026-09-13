/**
 * Integration coverage for `SwaggerPage`, the feature-owned lazy boundary around
 * the browser-only Swagger UI (`next/dynamic` with `ssr: false`).
 *
 * The feature owns this boundary — rather than `pages/swagger.tsx` — so the
 * barrel exposes nothing that would pull `swagger-ui-react` into the page's
 * initial chunk. `next/dynamic` is replaced with a minimal loader that renders
 * the `loading` element first and the resolved module after, which is the
 * observable contract: a spinner while the chunk downloads, then the page.
 *
 * Invalid input / boundary — Not applicable: the component takes no props.
 * Error — Not applicable: a failed chunk load is handled by Next's own runtime,
 * which is outside this module.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import { SwaggerPage } from '../../../../src/features/swagger';
import useSwagger from '../../../../src/features/swagger/hooks/useSwagger';

jest.mock('../../../../src/features/swagger/hooks/useSwagger');

jest.mock('swagger-ui-react', () => ({
  __esModule: true,
  default: function SwaggerUI(): React.ReactElement {
    return <div>SwaggerUI rendered</div>;
  },
}));

type LoadedModule = { default: React.ComponentType };
type Options = { loading: () => React.ReactElement };

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<LoadedModule>, options: Options): React.ComponentType => {
    const { useEffect, useState } = jest.requireActual<typeof import('react')>('react');

    function Dynamic(): React.ReactElement {
      const [Loaded, setLoaded] = useState<React.ComponentType | null>(null);

      useEffect(() => {
        loader().then(mod => setLoaded(() => mod.default));
      }, []);

      return Loaded ? <Loaded /> : options.loading();
    }

    return Dynamic;
  },
}));

const mockUseSwagger = jest.mocked(useSwagger);

describe('integration: SwaggerPage', () => {
  beforeEach(() => {
    mockUseSwagger.mockReturnValue({ error: null, swaggerContent: null });
  });

  it('shows a spinner while the Swagger chunk loads, then renders the page', async () => {
    render(<SwaggerPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    expect(await screen.findByRole('navigation')).toBeInTheDocument();
    expect(screen.getByText(t('navigation.navigate_to_home_page'))).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
