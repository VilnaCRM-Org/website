/**
 * Integration: the Golos preload href list `pages/_document.tsx` renders.
 *
 * The faces are declared in `styles/global.css` so the `@vilnacrm/ui-toolkit`
 * themes can resolve them by their real family names. That declaration alone
 * emits no `<link rel="preload">`, which `next/font` used to provide, so this
 * module imports the same six `.woff2` assets to recover their built URLs.
 *
 * Two properties are guarded. The SET: a weight silently dropped from this list
 * still renders (the stylesheet declares it) but stops being preloaded, which is
 * invisible in every other suite. And the CONVERGENCE: the preload tag and the
 * `@font-face` rule reach the same face through two independent build paths — a
 * webpack `asset/resource` import here, a CSS `url()` there — and nothing else
 * proves they land on one file per weight. If the two ever diverge the build
 * ships two copies of every face and preloads six the stylesheet never uses,
 * and no other gate in the repository would notice (NFR9).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

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

  it('preloads the same file the stylesheet declares, for every weight', () => {
    const stylesheet: string = readFileSync(path.join(process.cwd(), 'styles/global.css'), 'utf8');
    const declaredFaces: string[] = [
      ...stylesheet.matchAll(/url\('([^']*GolosText-[^']+\.woff2)'\)/g),
    ].map(match => path.basename(match[1] as string));

    expect(declaredFaces).toHaveLength(GOLOS_WEIGHT_COUNT);

    // Compared by basename: the stylesheet names the source file and the
    // preload carries webpack's emitted URL, which appends a content hash. The
    // build reuses one asset for both only while these agree.
    GOLOS_PRELOAD_HREFS.forEach(href => {
      const weight: string = path.basename(href).replace(/\.[^.]*\.woff2$/, '.woff2');

      expect(declaredFaces).toContain(weight);
    });
  });
});
