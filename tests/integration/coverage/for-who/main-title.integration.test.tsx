/**
 * Integration coverage for the `MainTitle` sub-component of ForWhoSection and
 * its barrel re-export. Renders the `Trans`-driven description and CTA link.
 */
import { render } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import { MainTitle as MainTitleBarrel } from '@components/ForWhoSection/MainTitle';
import MainTitle from '@components/ForWhoSection/MainTitle/MainTitle';

const mainHeading: string = t('for_who.heading_main');
const mainText: string = t('for_who.text_main');
const ctaText: string = t('for_who.button_text');

describe('MainTitle integration', () => {
  it('re-exports MainTitle from its barrel', () => {
    expect(MainTitleBarrel).toBe(MainTitle);
  });

  it('renders the main heading and description', () => {
    const { getByText } = render(React.createElement(MainTitle));

    expect(getByText(mainHeading)).toBeInTheDocument();
    expect(getByText(mainText)).toBeInTheDocument();
  });

  it('renders the CTA as a link without nested button semantics', () => {
    const { getByRole, queryByRole } = render(React.createElement(MainTitle));
    const ctaLink: HTMLElement = getByRole('link', { name: ctaText });

    expect(ctaLink).toHaveAttribute('href', '#signUp');
    expect(queryByRole('button', { name: ctaText })).not.toBeInTheDocument();
  });
});
