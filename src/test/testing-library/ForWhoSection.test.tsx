import { render } from '@testing-library/react';
import React from 'react';

import { createTranslation, TranslationFunctionType } from '@/test/translate';

import ForWhoSection from '../../features/landing/components/ForWhoSection/ForWhoSection';

const t: TranslationFunctionType = createTranslation('pages/i18n');

const forWhoLabel: string = t('for_who.aria_label');

describe('ForWhoSection component', () => {
  it('should render the ForWhoSection component without errors', () => {
    const { getAllByLabelText } = render(<ForWhoSection />);

    expect(getAllByLabelText(forWhoLabel)[0]).toBeInTheDocument();
  });
});
