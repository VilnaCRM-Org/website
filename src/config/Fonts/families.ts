/**
 * The font-family stack the app applies to its own styled nodes.
 *
 * The faces themselves — `Golos Text` and `Inter` — are declared in
 * `styles/global.css` under those exact names, which is what lets the
 * `@vilnacrm/ui-toolkit` theme references resolve to them. Inter needs no
 * constant here: only the toolkit's own components ask for it.
 */
export const GOLOS_TEXT_FAMILY: string = "'Golos Text', sans-serif";
