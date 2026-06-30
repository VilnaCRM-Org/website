/**
 * Integration coverage for the swagger `Navigation` component.
 *
 * Imported through the barrel (`components/Navigation/index.ts`) so the
 * re-export executes. Renders the real i18n text/alt and exercises the click
 * handler, which delegates to `window.location.assign('/')`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { t } from 'i18next';

import Navigation from '../../../../src/features/swagger/components/navigation';

const homeLabel = t('navigation.navigate_to_home_page');
const arrowAlt = t('navigation.back_arrow_description');

describe('integration: swagger Navigation', () => {
  // jsdom 26+ hides Location methods behind an internal implementation symbol.
  const getLocationImpl = (): Location => {
    const implSymbol = Reflect.ownKeys(window.location).find(
      (key): key is symbol => typeof key === 'symbol'
    );
    return implSymbol
      ? (window.location as unknown as Record<symbol, Location>)[implSymbol]
      : window.location;
  };

  let assignSpy: jest.SpyInstance;

  beforeEach(() => {
    assignSpy = jest.spyOn(getLocationImpl(), 'assign').mockImplementation(() => {});
  });

  afterEach(() => {
    assignSpy.mockRestore();
  });

  it('renders the translated label and arrow alt text', () => {
    render(<Navigation />);

    expect(screen.getByText(homeLabel)).toBeInTheDocument();
    expect(screen.getByAltText(arrowAlt)).toBeInTheDocument();
  });

  it('navigates to the home page when clicked', () => {
    render(<Navigation />);

    fireEvent.click(screen.getByText(homeLabel));

    expect(assignSpy).toHaveBeenCalledWith('/');
  });
});
