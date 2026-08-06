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
 * concrete parameter, registered by hand. This split keeps the equality
 * assertion honest instead of forcing a non-navigable literal like
 * `/blog/[slug]` into `A11Y_ROUTES`, which would then break the Playwright run.
 */
function partitionRoutes(paths: readonly string[]): {
  static: string[];
  dynamic: string[];
} {
  return {
    static: paths.filter(path => !DYNAMIC_SEGMENT.test(path)),
    dynamic: paths.filter(path => DYNAMIC_SEGMENT.test(path)),
  };
}

describe('accessibility route registry', () => {
  it('covers every static page under pages/ and nothing else', () => {
    const registered: string[] = A11Y_ROUTES.map(route => route.path).sort();
    const discovered = partitionRoutes(discoverRoutes());

    expect(registered).toEqual(discovered.static);
  });

  it('registers a concrete path for every dynamic page', () => {
    const registered: readonly string[] = A11Y_ROUTES.map(route => route.path);
    const discovered = partitionRoutes(discoverRoutes());

    // `/blog/[slug]` must be represented by something navigable such as
    // `/blog/example`, so the scan exercises the rendered page.
    const unrepresented: string[] = discovered.dynamic.filter(dynamicPath => {
      const prefix: string = dynamicPath.slice(0, dynamicPath.search(DYNAMIC_SEGMENT));

      return !registered.some(path => path.startsWith(prefix) && path.length > prefix.length);
    });

    expect(unrepresented).toEqual([]);
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
