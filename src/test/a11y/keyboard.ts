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

/** Asserts the element is visible and takes focus when focused. */
export async function expectFocusable(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  await target.focus();
  await expect(target).toBeFocused();
}

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
 * 1. the route has focusable content at all,
 * 2. focus keeps moving — two consecutive stops on the same control is a
 *    keyboard trap (WCAG 2.1.2), and
 * 3. focus follows DOM order, allowing a single wrap back to the top
 *    (WCAG 2.4.3) — which also catches a positive `tabindex` jumping the queue.
 *
 * The recorded trace is the failure message, so a failure names the order it
 * actually observed instead of only that something was wrong.
 */
export async function expectKeyboardOperable(page: Page): Promise<void> {
  const tabbableCount: number = await markTabbables(page, TABBABLE_SELECTOR, TAB_ORDER_ATTRIBUTE);

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
  const marked: number[] = trace.filter(marker => marker !== UNMARKED);

  expect(marked.length, `Tab never reached a known control. ${readableTrace}`).toBeGreaterThan(0);

  const trapped: boolean = marked.some(
    (marker, index) => index > 0 && marker === marked[index - 1]
  );
  const trapMessage: string = `focus stopped advancing — keyboard trap? ${readableTrace}`;
  expect(trapped, trapMessage).toBe(false);

  const backJumps: number = marked.filter(
    (marker, index) => index > 0 && marker < (marked[index - 1] ?? marker)
  ).length;
  expect(backJumps, `focus order does not follow DOM order. ${readableTrace}`).toBeLessThanOrEqual(
    1
  );
}
