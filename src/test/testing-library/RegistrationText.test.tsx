import { render } from '@testing-library/react';
import React from 'react';

import { createTranslation, TranslationFunctionType } from '@/test/translate';

import RegistrationText from '../../features/landing/components/Possibilities/RegistrationText/RegistrationText';

const t: TranslationFunctionType = createTranslation('pages/i18n');

const mainHeadingText: string = t('unlimited_possibilities.main_heading_text');
const secondaryHeadingText: string = t('unlimited_possibilities.secondary_heading_text');

describe('RegistrationText component', () => {
  it('renders main and secondary heading text', () => {
    const { getByText } = render(<RegistrationText />);

    expect(getByText(mainHeadingText)).toBeInTheDocument();
    expect(getByText(secondaryHeadingText)).toBeInTheDocument();
  });
});
