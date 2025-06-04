import { render } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import RegistrationText from '../../features/landing/components/Possibilities/RegistrationText/RegistrationText';

const mainHeadingText: string = t('unlimited_possibilities.main_heading_text');
const secondaryHeadingText: string = t('unlimited_possibilities.secondary_heading_text');

describe('RegistrationText component', () => {
  it('renders main and secondary heading text', () => {
    const { getByText } = render(<RegistrationText />);

    expect(getByText(mainHeadingText)).toBeInTheDocument();
    expect(getByText(secondaryHeadingText)).toBeInTheDocument();
  });
});
