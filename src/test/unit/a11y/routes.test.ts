import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { A11Y_ROUTES } from '../../a11y/routes';

/**
 * Drift guard for the accessibility route registry (issue #317).
 *
 * The whole point of the route-level gate is that it covers every page, not
 * the two URLs Lighthouse audits. A page added under `pages/` without a
 * registry entry would silently escape the scan, so this test derives the
 * route list from the filesystem and requires the two to match exactly.
 */

const PAGES_ROOT: string = join(process.cwd(), 'pages');

/**
 * Next.js special files that never become part of the navigable route surface:
 * the app/document wrappers, and the error pages, which are reached by status
 * code rather than by navigation. The edge handler serves 404 from
 * `scripts/cloudfront_routing.js`, and the edge layer covers it.
 */
const NON_ROUTE_FILES: readonly string[] = ['_app', '_document', '_error', '404', '500'];

/** A path segment like `[slug]` or `[...rest]` — a dynamic route. */
const DYNAMIC_SEGMENT = /\[.+\]/;

function collectPageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute: string = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectPageFiles(absolute);
    }

    return /\.tsx$/.test(entry.name) ? [absolute] : [];
  });
}

function toRoutePath(absolute: string): string {
  const segments: string[] = relative(PAGES_ROOT, absolute)
    .replace(/\.tsx$/, '')
    .split(sep);
  const last: string = segments[segments.length - 1] ?? '';

  const withoutIndex: string[] = last === 'index' ? segments.slice(0, -1) : segments;

  return `/${withoutIndex.join('/')}`;
}

function discoverRoutes(): string[] {
  return collectPageFiles(PAGES_ROOT)
    .filter(file => !NON_ROUTE_FILES.some(name => file.endsWith(`${sep}${name}.tsx`)))
    .map(toRoutePath)
    .sort();
}

/**
 * A dynamic page has no single navigable path, so it cannot be compared
 * literally against the registry. It still has to be scanned — but with a
 * concrete parameter, registered by hand. This split keeps the assertions
 * honest instead of forcing a non-navigable literal like `/blog/[slug]` into
 * `A11Y_ROUTES`, which the Playwright scan could not visit.
 */
interface DiscoveredRoutes {
  readonly static: string[];
  readonly dynamic: string[];
}

function partitionRoutes(paths: readonly string[]): DiscoveredRoutes {
  return {
    static: paths.filter(path => !DYNAMIC_SEGMENT.test(path)),
    dynamic: paths.filter(path => DYNAMIC_SEGMENT.test(path)),
  };
}

/**
 * Turns a dynamic page path into a matcher for the concrete paths it can serve.
 *
 * Segment-wise, not prefix-wise: a prefix test would make a root-level
 * `pages/[slug].tsx` (prefix `/`) look satisfied by literally any registered
 * route, which is the opposite of a guard.
 */
function dynamicRouteMatcher(dynamicPath: string): RegExp {
  const pattern: string = dynamicPath.split('/').reduce((accumulator, segment) => {
    // `[[...slug]]` matches zero or more segments, so it has to swallow the
    // slash in front of it — otherwise `/blog/[[...slug]]` would demand a
    // parameter that Next.js treats as optional.
    if (/^\[\[\.\.\..+\]\]$/.test(segment)) {
      // At the root there is no preceding segment to hang the slash on, so the
      // page serves `/` itself.
      return accumulator === '' ? '/(?:.+)?' : `${accumulator}(?:/.+)?`;
    }
    if (segment === '') {
      return accumulator;
    }
    if (/^\[\.\.\..+\]$/.test(segment)) {
      return `${accumulator}/.+`;
    }
    if (/^\[.+\]$/.test(segment)) {
      return `${accumulator}/[^/]+`;
    }
    return `${accumulator}/${segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
  }, '');

  return new RegExp(`^${pattern === '' ? '/' : pattern}$`);
}

describe('accessibility route registry', () => {
  it('covers every static page under pages/', () => {
    const registered: readonly string[] = A11Y_ROUTES.map(route => route.path);
    const discovered: DiscoveredRoutes = partitionRoutes(discoverRoutes());

    const unregistered: string[] = discovered.static.filter(path => !registered.includes(path));

    expect(unregistered).toEqual([]);
  });

  it('registers nothing that is not a page', () => {
    const discovered: DiscoveredRoutes = partitionRoutes(discoverRoutes());
    const matchers: RegExp[] = discovered.dynamic.map(dynamicRouteMatcher);

    // A registered path is legitimate when it is a static page, or a concrete
    // instance of a dynamic one. Anything else is a typo or a stale entry.
    const unexplained: string[] = A11Y_ROUTES.map(route => route.path).filter(
      path => !discovered.static.includes(path) && !matchers.some(matcher => matcher.test(path))
    );

    expect(unexplained).toEqual([]);
  });

  it('registers a concrete path for every dynamic page', () => {
    const discovered: DiscoveredRoutes = partitionRoutes(discoverRoutes());
    const registered: readonly string[] = A11Y_ROUTES.map(route => route.path);

    // `/blog/[slug]` must be represented by something navigable such as
    // `/blog/example`, so the scan exercises the rendered page. The concrete
    // path must not itself be a static page, or a root-level `[slug]` would
    // count every existing route as its own coverage.
    const unrepresented: string[] = discovered.dynamic.filter(dynamicPath => {
      const matcher: RegExp = dynamicRouteMatcher(dynamicPath);

      return !registered.some(path => matcher.test(path) && !discovered.static.includes(path));
    });

    expect(unrepresented).toEqual([]);
  });

  it('matches dynamic pages segment-wise, not by prefix', () => {
    expect(dynamicRouteMatcher('/blog/[slug]').test('/blog/example')).toBe(true);
    expect(dynamicRouteMatcher('/blog/[slug]').test('/blog/a/b')).toBe(false);
    expect(dynamicRouteMatcher('/blog/[slug]').test('/other/example')).toBe(false);
    expect(dynamicRouteMatcher('/blog/[...rest]').test('/blog/a/b')).toBe(true);

    // The root-level case the prefix check got wrong.
    expect(dynamicRouteMatcher('/[slug]').test('/anything')).toBe(true);
    expect(dynamicRouteMatcher('/[slug]').test('/en/docs/api')).toBe(false);

    // Optional catch-alls match zero segments too, so the route they serve
    // without a parameter must not be treated as unregistered.
    expect(dynamicRouteMatcher('/blog/[[...slug]]').test('/blog')).toBe(true);
    expect(dynamicRouteMatcher('/blog/[[...slug]]').test('/blog/a/b')).toBe(true);
    expect(dynamicRouteMatcher('/blog/[[...slug]]').test('/other')).toBe(false);
    expect(dynamicRouteMatcher('/[[...slug]]').test('/')).toBe(true);
  });

  it('gives every route a name and a readiness selector', () => {
    A11Y_ROUTES.forEach(route => {
      expect(route.name).not.toHaveLength(0);
      expect(route.readySelector).not.toHaveLength(0);
      expect(route.path.startsWith('/')).toBe(true);
    });
  });

  it('registers each route exactly once', () => {
    const paths: string[] = A11Y_ROUTES.map(route => route.path);

    expect(new Set(paths).size).toBe(paths.length);
  });
});
