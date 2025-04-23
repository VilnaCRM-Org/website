import { render, within } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import ForWhoSection from '../../features/landing/components/ForWhoSection/ForWhoSection';

const forWhoLabel: string = t('for_who.aria_label');

describe('ForWhoSection component', () => {
  it('should render the ForWhoSection component without errors', () => {
    const { getAllByLabelText } = render(<ForWhoSection />);
    expect(getAllByLabelText(forWhoLabel)[0]).toBeInTheDocument();
  });

  it('should render MainTitle component', () => {
    const { getByText } = render(<ForWhoSection />);
    expect(getByText(/Для кого/i)).toBeInTheDocument();
  });

  it('should render 18 decorative images with empty alt', () => {
    const { getAllByAltText } = render(<ForWhoSection />);
    const decorativeImages = getAllByAltText('');
    expect(decorativeImages).toHaveLength(18); 
  });

  it('should render 6 images in svgGroup', () => {
    const { container } = render(<ForWhoSection />);
    const svgContainer = container.querySelector('[class*="svg"]');
    const images = svgContainer ? within(svgContainer as HTMLElement).getAllByRole('img') : [];
    expect(images).toHaveLength(6); 
  });

  it('should render 5 images in squareGroup (3 decorative + 2 main)', () => {
    const { container, getByTestId } = render(<ForWhoSection />);
    const squareContainer = container.querySelector('[class*="square"]');
    const images = squareContainer ? within(squareContainer as HTMLElement).getAllByRole('img') : [];
    
    expect(images).toHaveLength(5);
    expect(getByTestId('big-screen')).toBeInTheDocument();
    expect(getByTestId('small-screen')).toBeInTheDocument();
  });

  it('should render Cards component twice', () => {
    const { container } = render(<ForWhoSection />);
    const cardsContainers = container.querySelectorAll('[class*="CardsWrapper"]');
    expect(cardsContainers).toHaveLength(2);
  });

  it('should have proper alt text for main images', () => {
    const { getByAltText } = render(<ForWhoSection />);
    expect(getByAltText(t('alts.bigScreen'))).toBeInTheDocument();
    expect(getByAltText(t('alts.smallScreen'))).toBeInTheDocument();
  });

  it('should generate unique keys for decorative images', () => {
    const { container } = render(<ForWhoSection />);
    const decorativeImages = container.querySelectorAll('[key^="decorative-"]');
    const keys = Array.from(decorativeImages).map(img => img.getAttribute('key'));
    
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('should have correct decorative images structure', () => {
    const { container } = render(<ForWhoSection />);

    const svgContainer = container.querySelector('[class*="svg"]');
    const svgImages = svgContainer ? within(svgContainer as HTMLElement).getAllByRole('img') : [];
    expect(svgImages.length).toBeGreaterThan(0);

    const squareContainer = container.querySelector('[class*="square"]');
    const squareImages = squareContainer ? 
      within(squareContainer as HTMLElement).getAllByRole('img') : [];
    expect(squareImages.length).toBeGreaterThan(2); 
  });
});