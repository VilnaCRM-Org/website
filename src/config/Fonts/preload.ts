/**
 * The URLs of the Golos Text faces, so `_document` can preload them.
 *
 * Declaring the faces in `styles/global.css` (rather than through `next/font`)
 * is what lets the `@vilnacrm/ui-toolkit` themes resolve them by their real
 * names, but it also drops the `<link rel="preload">` tags `next/font` used to
 * emit. Without those the browser only discovers a face once layout demands it,
 * which lengthens the `font-display: swap` window — a real LCP cost, and a
 * screenshot-stability hazard for any test that samples before the swap.
 *
 * Importing the files here hands webpack the same assets `global.css`
 * references, so the emitted URLs are the ones already in `_next/static/media`
 * — no second copy is shipped and no new edge allow-list entry is needed.
 *
 * Only the six Golos weights are listed, which is exactly the set `next/font`
 * preloaded before this change: Inter is used by the toolkit's own components
 * and was never preloaded.
 */
import golosBlack from '../../assets/fonts/Golos/GolosText-Black.woff2';
import golosBold from '../../assets/fonts/Golos/GolosText-Bold.woff2';
import golosExtraBold from '../../assets/fonts/Golos/GolosText-ExtraBold.woff2';
import golosMedium from '../../assets/fonts/Golos/GolosText-Medium.woff2';
import golosRegular from '../../assets/fonts/Golos/GolosText-Regular.woff2';
import golosSemiBold from '../../assets/fonts/Golos/GolosText-SemiBold.woff2';

export const GOLOS_PRELOAD_HREFS: readonly string[] = [
  golosRegular,
  golosMedium,
  golosSemiBold,
  golosBold,
  golosExtraBold,
  golosBlack,
];
