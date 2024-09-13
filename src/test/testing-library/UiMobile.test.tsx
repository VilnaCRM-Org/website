import { render } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import { Mobile } from '@/components/UiFooter/Mobile';

import { mockedSocialLinks } from './constants';
import { createLocalizedRegExp } from './utils';

const mockedDate: number = new Date().getFullYear();
const defaultFooterClass: string = '.MuiContainer-root';
const logoAlt: string = t('footer.logo_alt');
const copyright: RegExp = createLocalizedRegExp('footer.copyright');

describe('DefaultFooter', () => {
  it('should render the component correctly', () => {
    const { container, getByAltText, getByText } = render(
      <Mobile socialLinks={mockedSocialLinks} />
    );

    expect(container.querySelector(defaultFooterClass)).toBeInTheDocument();
    expect(getByAltText(logoAlt)).toBeInTheDocument();
    expect(getByText(copyright)).toBeInTheDocument();
    expect(getByText(mockedDate.toString())).toBeInTheDocument();
  });
});
