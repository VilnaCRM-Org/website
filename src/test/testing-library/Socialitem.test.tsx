import { render } from '@testing-library/react';
import React from 'react';

import SocialItem from '../../features/landing/components/auth-section/social-item/social-item';

import { testSocialLink } from './fixtures/auth-social.fixtures';

describe('SocialItem', () => {
  test('renders social item with decorative icon and visible title', () => {
    const { container, queryByAltText, getByText } = render(
      React.createElement(SocialItem, { item: testSocialLink })
    );

    const titleElement: HTMLElement = getByText(testSocialLink.title);
    expect(titleElement).toBeInTheDocument();

    expect(queryByAltText(testSocialLink.title)).not.toBeInTheDocument();

    const imageElement: HTMLImageElement | null = container.querySelector('img');
    expect(imageElement).toBeInTheDocument();
    expect(imageElement).toHaveAttribute('alt', '');
  });
});
