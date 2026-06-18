import { render } from '@testing-library/react';
import { t } from 'i18next';

import { RegistrationText } from '@components/Possibilities/RegistrationText';
import RegistrationTextDefault from '@components/Possibilities/RegistrationText/RegistrationText';

describe('RegistrationText integration', () => {
  it('renders the main and secondary heading text via the barrel export', () => {
    const { getByText } = render(<RegistrationText />);

    expect(getByText(t('unlimited_possibilities.main_heading_text'))).toBeInTheDocument();
    expect(getByText(t('unlimited_possibilities.secondary_heading_text'))).toBeInTheDocument();
  });

  it('renders identical content from the default export', () => {
    const { getByText } = render(<RegistrationTextDefault />);

    expect(getByText(t('unlimited_possibilities.main_heading_text'))).toBeInTheDocument();
    expect(getByText(t('unlimited_possibilities.secondary_heading_text'))).toBeInTheDocument();
  });
});
