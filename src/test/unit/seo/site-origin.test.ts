/**
 * Hold the canonical origin's three declarations in step (issue #339).
 *
 * The origin the site publishes about itself has to exist in more than one place, because
 * the consumers cannot reach each other: `src/config/site.ts` is bundled TypeScript, the
 * `Sitemap:` line in `public/robots.txt` is a static file no build interpolates, and
 * `docs/deployment-runbook.md` is prose. Nothing in a build fails when one of them moves.
 *
 * The failure mode is silent and expensive in both directions: a canonical URL on the wrong
 * origin asks search engines to index a host the site is not served from, and a `Sitemap:`
 * on a host other than the one serving the robots.txt is discarded as cross-host — the
 * crawler simply never reads the sitemap. So this spec is the join.
 */
import fs from 'node:fs';
import path from 'node:path';

import { SITE_ORIGIN, absoluteUrl } from '@/config/site';

const REPO_ROOT: string = path.resolve(__dirname, '../../../..');

function read(relative: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');
}

function sitemapDirective(robots: string): string {
  const directive: string | undefined = robots
    .split('\n')
    .map(line => line.trim())
    .filter(line => !line.startsWith('#'))
    .find(line => line.toLowerCase().startsWith('sitemap:'));
  if (directive === undefined) {
    throw new Error('public/robots.txt declares no Sitemap directive');
  }
  return directive.slice('sitemap:'.length).trim();
}

describe('the canonical origin', () => {
  it('is an https origin with no path, query or trailing slash', () => {
    const parsed: URL = new URL(SITE_ORIGIN);
    // A canonical URL is built by resolving a path against this value, so anything beyond
    // an origin here silently truncates or duplicates part of every URL the site emits.
    expect(parsed.protocol).toBe('https:');
    expect(SITE_ORIGIN).toBe(parsed.origin);
  });

  it('matches the origin robots.txt points crawlers at', () => {
    expect(new URL(sitemapDirective(read('public/robots.txt'))).origin).toBe(SITE_ORIGIN);
  });

  it('matches the origin every URL in the sitemap is published on', () => {
    const locations: string[] = [
      ...read('public/sitemap.xml').matchAll(/<loc>([^<]*)<\/loc>/g),
    ].map(match => match[1] as string);
    expect(locations.length).toBeGreaterThan(0);
    for (const location of locations) {
      expect(new URL(location).origin).toBe(SITE_ORIGIN);
    }
  });

  it('matches the origin the deployment runbook documents', () => {
    expect(read('docs/deployment-runbook.md')).toContain(SITE_ORIGIN);
  });
});

describe('absoluteUrl', () => {
  it('resolves a site-relative path against the canonical origin', () => {
    expect(absoluteUrl('/swagger')).toBe(`${SITE_ORIGIN}/swagger`);
  });

  it('keeps the root path as a bare origin with a trailing slash', () => {
    expect(absoluteUrl('/')).toBe(`${SITE_ORIGIN}/`);
  });

  it.each([['swagger'], [''], ['./swagger'], ['https://other.test/x']])(
    'refuses %p, which is not a site-relative path',
    (input: string) => {
      expect(() => absoluteUrl(input)).toThrow(/site-relative path/);
    }
  );

  it.each([['//other.test/x'], ['/\\other.test/x'], ['/\\\\other.test/x']])(
    'refuses %p, which resolves to a host other than this site',
    (input: string) => {
      // `new URL(input, base)` discards the base whenever the input carries its own
      // authority. `/\\other.test` is the non-obvious one: it starts with a single slash,
      // so it passes any leading-`//` test, but a special scheme treats `\\` as `/` and
      // the WHATWG parser reads it as an authority. Publishing that as a canonical URL
      // would nominate someone else's host as the address to index this page under.
      expect(() => absoluteUrl(input)).toThrow(/off-origin/);
    }
  );
});
