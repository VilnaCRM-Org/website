import { render } from '@testing-library/react';

import Notch from '../../features/landing/components/about-us/notch/notch';

const notchTestId: string = '.MuiBox-root';

it('renders notch', () => {
  const { container } = render(<Notch />);
  expect(container.querySelector(notchTestId)).toBeInTheDocument();
});
