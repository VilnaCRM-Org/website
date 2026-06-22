import { render } from '@testing-library/react';

import UiCardList from '@/components/ui-card-list';

import { cardList } from './constants';

jest.mock('../../components/ui-card-list/card-swiper', () =>
  jest.fn(() => <div data-testid="card-swiper" />)
);

describe('UiCardList component', () => {
  it('renders CardSwiper with correct props', () => {
    const { getByTestId } = render(<UiCardList cardList={cardList} />);

    const cardSwiper: HTMLElement = getByTestId('card-swiper');
    expect(cardSwiper).toBeInTheDocument();
  });
});
