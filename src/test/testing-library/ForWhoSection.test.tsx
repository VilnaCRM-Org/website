import { render } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import ForWhoSection from '../../features/landing/components/for-who-section/for-who-section';

const forWhoButton: string = t('for_who.button_text');

describe('ForWhoSection component', () => {
  it('should render sign up links without nested button semantics', () => {
    const { getAllByText, queryAllByRole } = render(React.createElement(ForWhoSection));

    expect(getAllByText(forWhoButton)).toHaveLength(3);
    getAllByText(forWhoButton).forEach(element => {
      expect(element.closest('a')).toHaveAttribute('href', '#signUp');
    });
    expect(queryAllByRole('button', { name: forWhoButton })).toHaveLength(0);
  });

  it('should have the correct number of images with empty alt text and images with proper alt text', () => {
    const { getAllByAltText } = render(React.createElement(ForWhoSection));

    const imagesWithEmptyAlt: HTMLElement[] = getAllByAltText('');
    expect(imagesWithEmptyAlt).toHaveLength(9);

    const imagesWithAltText: HTMLElement[] = getAllByAltText('Vector');
    expect(imagesWithAltText).toHaveLength(4);
  });

  it('names the two product screenshots from the bundle, never from a raw key', () => {
    // The screens used to read `t('alts.big_screen')`, a key no bundle declares, so
    // i18next returned the key itself and screen readers voiced "alts dot big screen".
    const { getByAltText, queryByAltText } = render(React.createElement(ForWhoSection));

    expect(getByAltText(t('for_who.image_alt.big_screen'))).toBeInTheDocument();
    expect(getByAltText(t('for_who.image_alt.small_screen'))).toBeInTheDocument();
    expect(queryByAltText(/^alts\./)).not.toBeInTheDocument();
    expect(t('for_who.image_alt.big_screen')).not.toMatch(/^for_who\./);
  });
});
