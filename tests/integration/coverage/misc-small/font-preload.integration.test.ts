/**
 * Integration: the Golos preload href list `pages/_document.tsx` renders.
 *
 * The faces are declared in `styles/global.css` so the `@vilnacrm/ui-toolkit`
 * themes can resolve them by their real family names. That declaration alone
 * emits no `<link rel="preload">`, which `next/font` used to provide, so this
 * module imports the same six `.woff2` assets to recover their built URLs.
 *
 * What is worth guarding is the SET: a weight silently dropped from this list
 * still renders (the stylesheet declares it) but stops being preloaded, which is
 * invisible in every other suite.
 */
import { GOLOS_PRELOAD_HREFS } from '@/config/Fonts/preload';

const GOLOS_WEIGHT_COUNT: number = 6;

describe('Golos preload hrefs', () => {
  it('lists every Golos weight the stylesheet declares, once each', () => {
    expect(GOLOS_PRELOAD_HREFS).toHaveLength(GOLOS_WEIGHT_COUNT);
    expect(new Set(GOLOS_PRELOAD_HREFS).size).toBe(GOLOS_WEIGHT_COUNT);
  });

  it('names the Regular, Medium, SemiBold, Bold, ExtraBold and Black faces', () => {
    const joined: string = GOLOS_PRELOAD_HREFS.join(' ');

    ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black'].forEach(weight => {
      expect(joined).toContain(`GolosText-${weight}`);
    });
  });

  it('resolves each entry to a woff2 asset rather than an empty string', () => {
    GOLOS_PRELOAD_HREFS.forEach(href => {
      expect(href).toMatch(/\.woff2$/);
    });
  });
});
