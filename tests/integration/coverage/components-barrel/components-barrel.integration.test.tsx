/**
 * Integration coverage: the `@/components` barrel and `UiButton`'s polymorphic
 * (`component` / `href`) prop forwarding — paths the registration flow alone
 * does not exercise.
 */
import { render, screen } from '@testing-library/react';

import * as components from '@/components';
import { UiButton } from '@/components';

describe('integration: components barrel', () => {
  it('re-exports every public Ui component through the barrel', () => {
    const exported = Object.values(components);
    expect(exported.length).toBeGreaterThan(0);
    exported.forEach(component => expect(component).toBeDefined());
  });

  it('forwards the polymorphic `component` and `href` props on UiButton', () => {
    render(
      <UiButton component="a" href="https://example.com" variant="text" size="medium">
        link button
      </UiButton>
    );

    const link = screen.getByRole('link', { name: 'link button' });
    expect(link).toHaveAttribute('href', 'https://example.com');
  });
});
