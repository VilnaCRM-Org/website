import { render } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import { DefaultFooter } from '@/components/UiFooter/DefaultFooter';

import { mockedSocialLinks } from './constants';

const mockedDate: number = new Date().getFullYear();
const defaultFooterClass: string = '.MuiStack-root';
const logoAlt: string = t('footer.logo_alt');
const copyright: RegExp = new RegExp(t('footer.copyright'));

describe('DefaultFooter', () => {
  it('should render the component correctly', () => {
    const { container, getByAltText, getByText } = render(
      <DefaultFooter socialLinks={mockedSocialLinks} />
    );

    expect(container.querySelector(defaultFooterClass)).toBeInTheDocument();
    expect(getByAltText(logoAlt)).toBeInTheDocument();
    expect(getByText(copyright)).toBeInTheDocument();
    expect(getByText(mockedDate.toString())).toBeInTheDocument();
  });
});
