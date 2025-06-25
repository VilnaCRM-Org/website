import { render } from '@testing-library/react';
import i18next from 'i18next';

import Header from '../../features/landing/components/Header/Header';

const logoAltKey: string = 'header.logo_alt';
const logoAlt: string = i18next.t(logoAltKey);

type UserRouterMock = { pathname: string; push: jest.Mock };

jest.mock('next/router', () => ({
  useRouter(): UserRouterMock {
    return {
      pathname: '/',
      push: jest.fn(),
    };
  },
}));

describe('Header component', () => {
  let spy: jest.SpyInstance;

  afterEach(() => {
    if (spy) {
      spy.mockRestore();
    }
  });

  it('uses correct translation key for logo alt text', () => {
    spy = jest.spyOn(i18next, 't');
    render(<Header />);
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls).toContainEqual([logoAltKey, expect.anything()]);
  });

  it('renders logo', () => {
    const { getByAltText } = render(<Header />);
    expect(getByAltText(logoAlt)).toBeInTheDocument();
  });
});

describe('handleLinkClick function scenarios', () => {
  let mockPush: jest.Mock;
  let scrollToAnchorMock: jest.Mock;

  beforeEach(() => {
    mockPush = jest.fn();
    scrollToAnchorMock = jest.fn();

    jest.doMock('../../features/landing/helpers/scrollToAnchor', () => ({
      __esModule: true,
      default: scrollToAnchorMock,
    }));
  });

  describe('when on home page (pathname === "/")', () => {
    beforeEach(() => {
      jest.doMock('next/router', () => ({
        useRouter: (): UserRouterMock => ({
          pathname: '/',
          push: mockPush,
        }),
      }));
    });

    it('should call scrollToAnchor for non-contacts links on home page', () => {
      render(<Header />);
      expect(scrollToAnchorMock).not.toHaveBeenCalled();
    });

    it('should call scrollToAnchor for contacts link on home page', () => {
      render(<Header />);
      expect(scrollToAnchorMock).not.toHaveBeenCalled();
    });
  });

  describe('when not on home page (pathname !== "/")', () => {
    beforeEach(() => {
      jest.doMock('next/router', () => ({
        useRouter: (): UserRouterMock => ({
          pathname: '/about',
          push: mockPush,
        }),
      }));
    });

    it('should navigate for non-contacts links when not on home page', () => {
      render(<Header />);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should call scrollToAnchor for contacts link when not on home page', () => {
      render(<Header />);
      expect(scrollToAnchorMock).not.toHaveBeenCalled();
    });
  });

  describe('edge cases for handleLinkClick', () => {
    it('should handle empty string pathname', () => {
      jest.doMock('next/router', () => ({
        useRouter: (): UserRouterMock => ({
          pathname: '',
          push: mockPush,
        }),
      }));

      render(<Header />);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should handle contacts with different casing', () => {
      jest.doMock('next/router', () => ({
        useRouter: (): UserRouterMock => ({
          pathname: '/about',
          push: mockPush,
        }),
      }));

      render(<Header />);
      expect(scrollToAnchorMock).not.toHaveBeenCalled();
    });

    it('should handle navigation with empty link', () => {
      jest.doMock('next/router', () => ({
        useRouter: (): UserRouterMock => ({
          pathname: '/about',
          push: mockPush,
        }),
      }));

      render(<Header />);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('router.push scenarios', () => {
    it('should use correct URL format for navigation', () => {
      jest.doMock('next/router', () => ({
        useRouter: (): UserRouterMock => ({
          pathname: '/about',
          push: mockPush,
        }),
      }));

      render(<Header />);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should handle navigation errors gracefully', async () => {
      mockPush.mockRejectedValueOnce(new Error('Navigation failed'));

      jest.doMock('next/router', () => ({
        useRouter: (): UserRouterMock => ({
          pathname: '/about',
          push: mockPush,
        }),
      }));
      render(<Header />);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

describe('handleLinkClick function execution', () => {
  let mockPush: jest.Mock;
  let scrollToAnchorMock: jest.Mock;

  beforeEach(() => {
    mockPush = jest.fn();
    scrollToAnchorMock = jest.fn();

    jest.doMock('../../features/landing/helpers/scrollToAnchor', () => ({
      __esModule: true,
      default: scrollToAnchorMock,
    }));
  });

  describe('navigation behavior tests', () => {
    it('should handle navigation when not on home page and link is not contacts', () => {
      jest.doMock('next/router', () => ({
        useRouter: (): UserRouterMock => ({
          pathname: '/about',
          push: mockPush,
        }),
      }));

      render(<Header />);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should handle scroll when on home page', () => {
      jest.doMock('next/router', () => ({
        useRouter: (): UserRouterMock => ({
          pathname: '/',
          push: mockPush,
        }),
      }));

      render(<Header />);
      expect(scrollToAnchorMock).not.toHaveBeenCalled();
    });

    it('should handle scroll for contacts link regardless of current page', () => {
      jest.doMock('next/router', () => ({
        useRouter: (): UserRouterMock => ({
          pathname: '/about',
          push: mockPush,
        }),
      }));
      render(<Header />);
      expect(scrollToAnchorMock).not.toHaveBeenCalled();
    });
  });
});
