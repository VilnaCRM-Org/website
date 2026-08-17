/**
 * The runtime interaction states scanned by axe inside the existing e2e
 * journeys (issue #369).
 *
 * The route-level gate (#317) scans each page at initial load, and static
 * `jsx-a11y` lint sees one component's JSX at a time. Neither can see composed,
 * conditional DOM: a validation message that is never associated with its field,
 * a drawer that hides the rest of the page from assistive technology while
 * leaving it focusable, an expanded operation whose controls have no accessible
 * name. Those defects exist only after a user interacts, so they are scanned
 * where the interaction already happens — as an added assertion on a journey the
 * suite already drives, not as a new journey or a new CI job.
 *
 * This registry is the contract; `src/test/unit/a11y/interaction-states.test.ts`
 * fails when a state stops being scanned, so a scan cannot be quietly deleted
 * from a spec and leave the state listed here as if it were still covered.
 */
export interface A11yInteractionState {
  /**
   * The registered route the state is reached on (`src/test/a11y/routes.ts`).
   *
   * The scan reuses the route's exception context, so accepted debt already
   * reviewed for that page — the brand-palette contrast waiver, for one — does
   * not have to be re-declared per state, and a waiver still cannot leak onto a
   * page nobody reviewed it against.
   */
  readonly route: string;
  /** What the user did to reach the state; names it in failures and reports. */
  readonly description: string;
}

export const INTERACTION_STATES = {
  /** The sign-up form after a submit that failed client-side validation. */
  registrationValidationErrors: {
    route: '/',
    description: 'registration form showing inline validation errors',
  },
  /** The sign-up form after the API rejected the submission. */
  registrationSubmitError: {
    route: '/',
    description: 'registration form showing the submit error notification',
  },
  /** Mobile navigation, open, over the page it overlays. */
  mobileDrawerOpen: {
    route: '/',
    description: 'mobile navigation drawer open',
  },
  /** One Swagger operation expanded to its documented responses. */
  swaggerOperationExpanded: {
    route: '/swagger',
    description: 'swagger operation expanded',
  },
  /** The Swagger authorization dialog, open over the documentation. */
  swaggerAuthorizeDialog: {
    route: '/swagger',
    description: 'swagger authorize dialog open',
  },
} as const satisfies Record<string, A11yInteractionState>;

/** The registry key of one scanned interaction state. */
export type A11yInteractionStateName = keyof typeof INTERACTION_STATES;
