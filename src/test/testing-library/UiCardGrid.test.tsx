import { render } from '@testing-library/react';

import CardGrid from '@/components/ui-card-list/card-grid';

import { cardList, largeCardList, smallCardList } from './constants';

jest.mock('../../components/ui-card-item', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="mock-ui-card-item" />),
}));

describe('CardGrid component', () => {
  it('renders with correct props', () => {
    const { getByTestId } = render(<CardGrid cardList={cardList} />);

    const cardGrid: HTMLElement = getByTestId('mock-ui-card-item');
    expect(cardGrid).toBeInTheDocument();
  });

  it('renders with smallGrid style when cardList[0].type is smallCard', () => {
    const { container } = render(<CardGrid cardList={smallCardList} />);

    const gridElement: ChildNode | null = container.firstChild;
    const computedStyles: CSSStyleDeclaration = window.getComputedStyle(gridElement as Element);

    expect(computedStyles).toHaveProperty('gridTemplateColumns');
  });

  it('renders with largeGrid style when cardList[0].type is largeGrid', () => {
    const { container } = render(<CardGrid cardList={largeCardList} />);

    const gridElement: ChildNode | null = container.firstChild;
    const computedStyles: CSSStyleDeclaration = window.getComputedStyle(gridElement as Element);

    expect(computedStyles).toHaveProperty('gridTemplateColumns');
  });
});
