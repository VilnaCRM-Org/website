/**
 * The font-family stack the app applies to its own styled nodes.
 *
 * The faces themselves — `Golos Text` and `Inter` — are declared in
 * `styles/global.css` under those exact names, which is what lets the
 * `@vilnacrm/ui-toolkit` theme references resolve to them. Inter needs no
 * constant here: only the toolkit's own components ask for it.
 *
 * `Golos Text Fallback` is the metric-adjusted Arial declared beside those
 * faces. It has to sit in every stack that names the real family, not just in
 * `.app-typeface`: a stack that falls straight through to bare `sans-serif`
 * reflows when the real face swaps in, which is the layout shift the override
 * exists to remove.
 */
export const GOLOS_TEXT_FAMILY: string = "'Golos Text', 'Golos Text Fallback', sans-serif";
