import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  INTERACTION_STATES,
  type A11yInteractionState,
  type A11yInteractionStateName,
} from '../../a11y/interaction-states';
import { A11Y_ROUTES } from '../../a11y/routes';

/**
 * Drift guard for the interaction-state scans (issue #369).
 *
 * The registry claims which runtime states axe covers; the e2e specs are what
 * actually scans them. Nothing in the type system connects the two, so a scan
 * deleted from a spec would leave the registry, the acceptance standard and this
 * repo's documentation all asserting coverage that no longer runs — the exact
 * silent-green failure the accessibility gate exists to prevent. This test reads
 * the specs and requires every registered state to still be scanned.
 */

const E2E_ROOT: string = join(process.cwd(), 'src', 'test', 'e2e');

/**
 * Every `scanInteractionState(page, <argument>)` call in the e2e suite, with the
 * argument source text captured. Matching the argument rather than just counting
 * calls is what catches a spec that scans an inline literal and so escapes the
 * registry.
 */
const SCAN_CALL = /scanInteractionState\(\s*page\s*,\s*([\s\S]*?)\)\s*;/g;

const REGISTRY_MEMBER = /^INTERACTION_STATES\.(\w+)$/;

function collectSpecFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute: string = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectSpecFiles(absolute);
    }

    return entry.name.endsWith('.spec.ts') ? [absolute] : [];
  });
}

function scanArguments(): string[] {
  return collectSpecFiles(E2E_ROOT).flatMap(file =>
    [...readFileSync(file, 'utf8').matchAll(SCAN_CALL)].map(match => (match[1] ?? '').trim())
  );
}

const registeredNames: A11yInteractionStateName[] = Object.keys(
  INTERACTION_STATES
) as A11yInteractionStateName[];

const registeredStates: A11yInteractionState[] = Object.values(INTERACTION_STATES);

describe('accessibility interaction-state registry', () => {
  it('reaches every state from a route the gate already knows', () => {
    const knownRoutes: string[] = A11Y_ROUTES.map(route => route.path);

    // The scan borrows the route's exception context, so an unregistered route
    // would silently apply no waivers at all — and could not be scanned at the
    // route level either.
    registeredStates.forEach(state => expect(knownRoutes).toContain(state.route));
  });

  it('describes every state uniquely', () => {
    const descriptions: string[] = registeredStates.map(state => state.description);

    descriptions.forEach(description => expect(description).not.toHaveLength(0));
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('covers the three interaction states #369 requires', () => {
    // Named explicitly rather than counted: #369 commits to these three as the
    // floor, so a rename or a removal has to be a visible, reviewed change.
    expect(registeredNames).toEqual(
      expect.arrayContaining([
        'registrationSubmitError',
        'mobileDrawerOpen',
        'swaggerOperationExpanded',
      ])
    );
  });

  it('registers exactly the five states this repo scans', () => {
    // The assertion above is a floor and would pass while an extra state was
    // added or dropped unnoticed. This one pins the whole registry, so growing
    // or shrinking the scanned surface is a deliberate, reviewed edit — the same
    // contract `routes.test.ts` enforces for pages.
    expect([...registeredNames].sort()).toEqual([
      'mobileDrawerOpen',
      'registrationSubmitError',
      'registrationValidationErrors',
      'swaggerAuthorizeDialog',
      'swaggerOperationExpanded',
    ]);
  });

  it('spans both the landing and the swagger surface', () => {
    expect(new Set(registeredStates.map(state => state.route))).toEqual(new Set(['/', '/swagger']));
  });

  it('scans every registered state from an e2e spec', () => {
    const scanned: Set<string> = new Set(
      scanArguments().flatMap(argument => {
        const member: RegExpExecArray | null = REGISTRY_MEMBER.exec(argument);

        return member?.[1] === undefined ? [] : [member[1]];
      })
    );

    const unscanned: string[] = registeredNames.filter(name => !scanned.has(name));

    expect(unscanned).toEqual([]);
  });

  it('lets no spec scan a state that is not in the registry', () => {
    const offRegistry: string[] = scanArguments().filter(argument => {
      const member: RegExpExecArray | null = REGISTRY_MEMBER.exec(argument);

      return member?.[1] === undefined || !Object.hasOwn(INTERACTION_STATES, member[1]);
    });

    expect(offRegistry).toEqual([]);
  });

  it('finds the calls it claims to police', () => {
    // Guards the guard: if the pattern above stopped matching, both assertions
    // over the specs would pass vacuously on an empty list.
    expect(scanArguments().length).toBeGreaterThanOrEqual(registeredNames.length);
  });
});
