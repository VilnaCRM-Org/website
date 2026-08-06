import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Keyboard operability helpers for the route-level accessibility gate
 * (issue #317).
 *
 * Every helper asserts unconditionally. None of them accepts an "if the
 * element happens to be there" shape — a missing target is a failure, because
 * a keyboard user meeting a missing control experiences exactly that.
 *
 * axe cannot cover this ground: it has no keyboard-trap rule at all, and the
 * focus-order rules it does ship are `best-practice`, so they sit outside the
 * WCAG 2.1 AA tag set the scan gates on. This module is the half of the
 * contract the automated scan structurally cannot provide.
 */

/** Attribute used to stamp DOM order onto tabbable elements during a sweep. */
const TAB_ORDER_ATTRIBUTE: string = 'data-a11y-tab-order';

/**
 * Upper bound on Tab presses in one sweep. Swagger renders well over a hundred
 * controls; the assertions below are properties of adjacent trace entries, so
 * truncating the sweep preserves them while keeping the test fast.
 */
const MAX_SWEEP_STEPS: number = 120;

/** Marker recorded when focus lands somewhere the sweep did not stamp. */
const UNMARKED: number = -1;

const TABBABLE_SELECTOR: string = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]',
  '[tabindex]',
].join(', ');

/**
 * Asserts the element takes focus, and is visible once it has it.
 *
 * Visibility is checked AFTER focusing on purpose: the standard skip link
 * (WCAG 2.4.1) is deliberately hidden until focused, so asserting visibility
 * first would fail the one control this helper most needs to accept.
 */
export async function expectFocusable(target: Locator): Promise<void> {
  await target.focus();
  await expect(target).toBeFocused();
  await expect(target).toBeVisible();
}

/**
 * How many sweep stops may land somewhere the stamp did not mark before the
 * sweep is treated as having escaped the document. Browsers occasionally route
 * one Tab through the document root, so this is not zero — but it is small,
 * because a stop that is not a stamped control is a stop the gate cannot reason
 * about.
 */
const MAX_UNMARKED_STOPS: number = 2;

/** Poll interval while waiting for the tabbable set to stop changing. */
const STAMP_SETTLE_MS: number = 250;

/** How many times the stamp may be retaken before we accept the count. */
const STAMP_SETTLE_ATTEMPTS: number = 6;

/**
 * Stamps every genuinely tabbable element with its DOM order and returns how
 * many were found.
 *
 * `checkVisibility` handles `display:none` / `visibility:hidden`; the explicit
 * checks cover the cases it does not: disabled controls, hidden inputs,
 * negative `tabindex`, and `inert` / `aria-hidden` subtrees. Getting this wrong
 * is what makes a naive focusable selector match `input[type=hidden]` first.
 */
async function markTabbables(page: Page, selector: string, attribute: string): Promise<number> {
  return page.evaluate(
    ({ tabbableSelector, orderAttribute }) => {
      const isTabbable: (element: Element) => boolean = element => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        if (element.closest('[inert], [aria-hidden="true"]') !== null) {
          return false;
        }
        if (element.matches('[disabled], input[type="hidden"]')) {
          return false;
        }

        const tabIndexAttribute = element.getAttribute('tabindex');
        if (tabIndexAttribute !== null && Number.parseInt(tabIndexAttribute, 10) < 0) {
          return false;
        }
        if (element.matches('[contenteditable="false"]')) {
          return false;
        }

        return element.checkVisibility({ checkVisibilityCSS: true });
      };

      const tabbables = Array.from(document.querySelectorAll(tabbableSelector)).filter(isTabbable);

      tabbables.forEach((element, index) => element.setAttribute(orderAttribute, String(index)));

      return tabbables.length;
    },
    { tabbableSelector: selector, orderAttribute: attribute }
  );
}

/**
 * Stamps repeatedly until the tabbable count stops changing.
 *
 * Every route here mounts its chrome through `next/dynamic({ ssr: false })`, so
 * a single stamp taken the moment the ready selector appears can miss controls
 * that mount milliseconds later. Those would then read as unmarked for the rest
 * of the sweep — and a sweep that leaves the stamped set can no longer see a
 * trap. Settling first is what makes the assertions below mean anything.
 */
async function markSettledTabbables(page: Page): Promise<number> {
  let previous: number = -1;
  let current: number = await markTabbables(page, TABBABLE_SELECTOR, TAB_ORDER_ATTRIBUTE);

  for (
    let attempt: number = 0;
    attempt < STAMP_SETTLE_ATTEMPTS && current !== previous;
    attempt += 1
  ) {
    await page.waitForTimeout(STAMP_SETTLE_MS);
    previous = current;
    current = await markTabbables(page, TABBABLE_SELECTOR, TAB_ORDER_ATTRIBUTE);
  }

  return current;
}

/** Reads the sweep marker of whatever currently holds focus, shadow DOM aware. */
async function readFocusMarker(page: Page, attribute: string): Promise<number> {
  return page.evaluate(orderAttribute => {
    let active: Element | null = document.activeElement;

    while (active?.shadowRoot?.activeElement != null) {
      active = active.shadowRoot.activeElement;
    }

    const marker = active?.getAttribute(orderAttribute);

    return marker === null || marker === undefined ? -1 : Number.parseInt(marker, 10);
  }, attribute);
}

/**
 * Walks the route with Tab alone and asserts the three properties a keyboard
 * user depends on:
 *
 * 1. the route has focusable content at all, and focus stays within the
 *    controls the sweep stamped,
 * 2. focus keeps moving — two consecutive stops on the same control is a
 *    keyboard trap (WCAG 2.1.2), and
 * 3. focus follows DOM order exactly (WCAG 2.4.3), which is also what catches a
 *    positive `tabindex` jumping the queue.
 *
 * The recorded trace is the failure message, so a failure names the order it
 * actually observed instead of only that something was wrong.
 */
export async function expectKeyboardOperable(page: Page): Promise<void> {
  const tabbableCount: number = await markSettledTabbables(page);

  expect(tabbableCount, 'route exposes no keyboard-focusable controls').toBeGreaterThan(0);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  // Sweep exactly as many steps as there are controls. Stepping past the last
  // one is not portable: Chromium hands focus to the browser chrome while
  // Firefox leaves it on the final control, which reads as a false trap.
  const steps: number = Math.min(tabbableCount, MAX_SWEEP_STEPS);
  const trace: number[] = [];

  for (let step: number = 0; step < steps; step += 1) {
    await page.keyboard.press('Tab');
    trace.push(await readFocusMarker(page, TAB_ORDER_ATTRIBUTE));
  }

  const readableTrace: string = `tab order trace: ${trace.join(' -> ')}`;

  // Without this the gate is vacuous: a sweep whose focus leaves the stamped
  // set on step two records `0 -> -1 -> -1 -> ...`, has no adjacent known pair
  // to inspect, and would otherwise pass — including when the route is
  // completely keyboard-trapped.
  const unmarkedStops: number = trace.filter(marker => marker === UNMARKED).length;
  expect(
    unmarkedStops,
    `Tab left the known controls and did not come back. ${readableTrace}`
  ).toBeLessThanOrEqual(MAX_UNMARKED_STOPS);

  // Compare stops that are adjacent in the REAL sweep. Compacting the trace
  // first would be wrong: a trace of `3 -> -1 -> 3` is focus visiting something
  // the stamp did not match and coming back, which is neither a trap nor a
  // back-jump — but compaction reads it as `[3, 3]` and fails. Any pair
  // involving an unstamped stop is simply not evidence either way.
  const adjacentKnownPairs: readonly (readonly [number, number])[] = trace
    .slice(1)
    .map((marker, index): readonly [number, number] => [trace[index] ?? UNMARKED, marker])
    .filter(([previous, current]) => previous !== UNMARKED && current !== UNMARKED);

  const trapped: boolean = adjacentKnownPairs.some(([previous, current]) => previous === current);
  const trapMessage: string = `focus stopped advancing — keyboard trap? ${readableTrace}`;
  expect(trapped, trapMessage).toBe(false);

  // Zero, not "at most one". The sweep takes exactly as many steps as there are
  // controls starting from a blurred document, so a conformant page never wraps
  // and never jumps backwards. A single positive `tabindex` moves exactly one
  // element to the head of the order and so produces exactly ONE back-jump for
  // any N — an allowance of one would let precisely the defect this check
  // exists to catch through.
  const backJumps: number = adjacentKnownPairs.filter(
    ([previous, current]) => current < previous
  ).length;
  expect(backJumps, `focus order does not follow DOM order. ${readableTrace}`).toBe(0);
}
