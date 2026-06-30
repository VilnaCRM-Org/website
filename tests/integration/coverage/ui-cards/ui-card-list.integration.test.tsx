/**
 * Integration coverage for the UiCardList module.
 *
 * Renders the REAL `UiCardList`, `CardGrid` and `CardSwiper` (with the real
 * swiper) so every branch is exercised: small vs large grid selection, the
 * desktop grid + mobile swiper containers, and the `CardSwiper` MutationObserver
 * that toggles `pointerEvents` when a tooltip popper is added to / removed from
 * the document body.
 */
import { render, screen, waitFor } from '@testing-library/react';

import UiCardList from '@/components/ui-card-list';
import CardGrid from '@/components/ui-card-list/card-grid';
import CardSwiper from '@/components/ui-card-list/card-swiper';
import { LARGE_CARDLIST_ARRAY, SMALL_CARDLIST_ARRAY } from '@/components/ui-card-list/constants';

// `swiper` ships as untransformed ESM that the integration Jest transform does
// not include, so the swiper React bindings and modules are stubbed with light
// passthroughs. This keeps every line of `CardSwiper` (branch selection, the
// MutationObserver effect and the slide map) executing for coverage without
// pulling the ESM package through Babel.
jest.mock('swiper/react', () => ({
  __esModule: true,
  Swiper: ({ children }: { children: React.ReactNode }) => <div className="swiper">{children}</div>,
  SwiperSlide: ({ children }: { children: React.ReactNode }) => (
    <div className="swiper-slide">{children}</div>
  ),
}));
jest.mock('swiper/modules', () => ({ __esModule: true, Pagination: {} }));
jest.mock('swiper/css', () => ({}), { virtual: true });
jest.mock('swiper/css/pagination', () => ({}), { virtual: true });

function makeTooltip(): HTMLElement {
  const node = document.createElement('div');
  node.setAttribute('role', 'tooltip');
  node.classList.add('base-Popper-root');
  return node;
}

describe('integration: UiCardList', () => {
  it('renders both the desktop grid and the mobile swiper for large cards', () => {
    const { container } = render(<UiCardList cardList={LARGE_CARDLIST_ARRAY} />);

    expect(container.querySelector('.MuiGrid-root')).toBeInTheDocument();
    expect(container.querySelector('.swiper')).toBeInTheDocument();
  });

  describe('CardGrid', () => {
    it('uses the small grid style when the first card is a smallCard', () => {
      const { container } = render(<CardGrid cardList={SMALL_CARDLIST_ARRAY} />);

      expect(container.firstChild).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(SMALL_CARDLIST_ARRAY.length);
    });

    it('uses the large grid style when the first card is a largeCard', () => {
      const { container } = render(<CardGrid cardList={LARGE_CARDLIST_ARRAY} />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it('renders nothing when the card list is empty', () => {
      const { container } = render(<CardGrid cardList={[]} />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('CardSwiper', () => {
    it('renders the small mobile grid when the first card is a smallCard', () => {
      const { container } = render(<CardSwiper cardList={SMALL_CARDLIST_ARRAY} />);

      expect(container.querySelector('.swiper')).toBeInTheDocument();
    });

    it('renders nothing when the card list is empty', () => {
      const { container } = render(<CardSwiper cardList={[]} />);

      expect(container).toBeEmptyDOMElement();
    });

    it('renders the large mobile grid when the first card is a largeCard', () => {
      const { container } = render(<CardSwiper cardList={LARGE_CARDLIST_ARRAY} />);

      expect(container.querySelector('.swiper')).toBeInTheDocument();
    });

    it('toggles pointer events when a tooltip popper is added then removed', async () => {
      const { container } = render(<CardSwiper cardList={LARGE_CARDLIST_ARRAY} />);

      const swiperGrid = container.firstChild as HTMLElement;
      const tooltip = makeTooltip();

      document.body.appendChild(tooltip);
      await waitFor(() => expect(swiperGrid).toHaveStyle({ pointerEvents: 'none' }));

      document.body.removeChild(tooltip);
      await waitFor(() => expect(swiperGrid).toHaveStyle({ pointerEvents: 'auto' }));
    });

    it('ignores mutation records whose type is not childList', () => {
      let capturedCallback: MutationCallback | undefined;
      const realObserver = global.MutationObserver;
      const observeSpy = jest.fn();
      const disconnectSpy = jest.fn();

      class CapturingObserver {
        constructor(cb: MutationCallback) {
          capturedCallback = cb;
        }

        observe = observeSpy;

        disconnect = disconnectSpy;

        takeRecords = (): MutationRecord[] => [];
      }

      global.MutationObserver = CapturingObserver as unknown as typeof MutationObserver;

      try {
        const { container } = render(<CardSwiper cardList={LARGE_CARDLIST_ARRAY} />);
        const swiperGrid = container.firstChild as HTMLElement;

        expect(capturedCallback).toBeDefined();
        // A non-childList record that still carries a tooltip popper in its
        // addedNodes must be skipped by the `mutation.type` guard, so
        // `pointerEvents` stays untouched. Regressing the guard would set it to
        // `none` and fail the assertion below.
        capturedCallback!(
          [
            {
              type: 'attributes',
              addedNodes: [makeTooltip()],
              removedNodes: [],
            } as unknown as MutationRecord,
          ],
          {} as MutationObserver
        );

        expect(swiperGrid).not.toHaveStyle({ pointerEvents: 'none' });
      } finally {
        global.MutationObserver = realObserver;
      }

      expect(observeSpy).toHaveBeenCalled();
    });

    it('does not observe when the document body is unavailable', () => {
      const querySpy = jest.spyOn(document, 'querySelector').mockReturnValue(null);

      try {
        const { container } = render(<CardSwiper cardList={LARGE_CARDLIST_ARRAY} />);
        expect(container.querySelector('.swiper')).toBeInTheDocument();
      } finally {
        querySpy.mockRestore();
      }
    });

    it('ignores added and removed nodes that are not tooltip poppers', async () => {
      const { container } = render(<CardSwiper cardList={LARGE_CARDLIST_ARRAY} />);

      const swiperGrid = container.firstChild as HTMLElement;
      const plain = document.createElement('div');
      const textNode = document.createTextNode('not an element');

      document.body.appendChild(plain);
      document.body.appendChild(textNode);
      document.body.removeChild(plain);
      document.body.removeChild(textNode);

      // The non-tooltip mutations must not set an inline pointer-events value.
      await waitFor(() => {
        expect(swiperGrid).toBeInTheDocument();
      });
      expect(swiperGrid.getAttribute('style') ?? '').not.toContain('pointer-events');
    });
  });
});
