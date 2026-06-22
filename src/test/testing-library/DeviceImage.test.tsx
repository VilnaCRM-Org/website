import { render } from '@testing-library/react';

import DeviceImage from '../../features/landing/components/about-us/device-image/device-image';

const notchContainerClass: string = '.MuiBox-root';
const mainImageAltText: string = 'Main image';

describe('DeviceImage component', () => {
  it('renders without crashing', () => {
    render(<DeviceImage />);
  });

  it('renders MainImage component', () => {
    const { getByAltText } = render(<DeviceImage />);
    expect(getByAltText(mainImageAltText)).toBeInTheDocument();
  });

  it('renders Notch component', () => {
    const { container } = render(<DeviceImage />);
    expect(container.querySelector(notchContainerClass)).toBeInTheDocument();
  });
});
