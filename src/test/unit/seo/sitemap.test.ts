/**
 * Gate `public/sitemap.xml` — the crawlable index of the static export (issue #339).
 *
 * The sitemap is a committed artifact that is DERIVED, never maintained: its routes come
 * from `config/routes.json` (itself generated from `pages/`) and its origin from the
 * `Sitemap:` directive in `public/robots.txt`. This spec is the drift gate for that
 * derivation, and it is hermetic — no build, no network — so it runs on every PR inside the
 * client suite.
 *
 * The rules are exercised over inputs the repository does not contain (an unknown route, a
 * route carrying XML metacharacters, a robots.txt with no or two Sitemap directives) rather
 * than only over the committed artifact, which by construction already satisfies them: a
 * check that can only ever see a passing input proves nothing about what it would reject.
 * That is why the rules live in the importable `scripts/ci/sitemap.mjs`.
 *
 * It reads its subjects from disk and imports nothing from `src/`, so it adds no files to
 * the client coverage denominator — the same reason `src/test/unit/robots-txt.test.ts`
 * does.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  EXCLUDED_ROUTES,
  buildSitemap,
  escapeXml,
  readOriginFromRobots,
} from '../../../../scripts/ci/sitemap.mjs';

const REPO_ROOT: string = path.resolve(__dirname, '../../../..');
const SITEMAP_PATH: string = path.join(REPO_ROOT, 'public/sitemap.xml');
const ROBOTS_PATH: string = path.join(REPO_ROOT, 'public/robots.txt');
const MANIFEST_PATH: string = path.join(REPO_ROOT, 'config/routes.json');
const GENERATOR_PATH: string = path.join(REPO_ROOT, 'scripts/ci/generate-sitemap.mjs');

const sitemap: string = fs.readFileSync(SITEMAP_PATH, 'utf8');
const manifest: Record<string, string> = JSON.parse(
  fs.readFileSync(MANIFEST_PATH, 'utf8')
) as Record<string, string>;

function locations(document: string): string[] {
  return [...document.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1] as string);
}

describe('public/sitemap.xml is generated, not maintained', () => {
  test('regenerating from the route manifest reproduces the committed file byte for byte', () => {
    const before: string = fs.readFileSync(SITEMAP_PATH, 'utf8');
    const output: string = execFileSync(process.execPath, [GENERATOR_PATH, '--check'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(output).toContain('already up to date');
    // `--check` must not have written anything; a gate that repairs its own subject
    // proves nothing.
    expect(fs.readFileSync(SITEMAP_PATH, 'utf8')).toBe(before);
  });

  test('lists every exported route that is not a recorded exclusion', () => {
    const origin: string = readOriginFromRobots(fs.readFileSync(ROBOTS_PATH, 'utf8'));
    const expected: string[] = Object.keys(manifest)
      .filter(route => !Object.hasOwn(EXCLUDED_ROUTES, route))
      .map(route => new URL(route, origin).toString())
      .sort();

    expect(locations(sitemap)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });

  test('every exclusion names a route that still exists, with a reason', () => {
    for (const [route, reason] of Object.entries(EXCLUDED_ROUTES)) {
      // An exclusion for a route that no longer exists is dead prose that would silently
      // start suppressing a future page that happens to reuse the path.
      expect(Object.hasOwn(manifest, route)).toBe(true);
      expect(reason.length).toBeGreaterThan(20);
    }
  });

  test('declares every URL on the origin robots.txt points crawlers at', () => {
    const origin: string = readOriginFromRobots(fs.readFileSync(ROBOTS_PATH, 'utf8'));
    for (const location of locations(sitemap)) {
      // A sitemap may only list URLs on its own host; a crawler discards the rest.
      expect(new URL(location).origin).toBe(origin);
    }
  });

  test('emits no lastmod, changefreq or priority', () => {
    // A build-time <lastmod> would rewrite the file on every run, so it could never be
    // drift-checked, and it would date the regeneration rather than the page.
    expect(sitemap).not.toMatch(/<(?:lastmod|changefreq|priority)>/);
  });

  test('is a well-formed sitemap document', () => {
    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(sitemap.endsWith('</urlset>\n')).toBe(true);
  });
});

describe('the rules the generator applies', () => {
  const origin: string = 'https://example.test';

  test('sorts routes and drops duplicates', () => {
    const document: string = buildSitemap(['/b', '/a', '/a'], origin);
    expect(locations(document)).toEqual(['https://example.test/a', 'https://example.test/b']);
  });

  test('drops an excluded route even when the manifest still ships it', () => {
    const excluded: string = Object.keys(EXCLUDED_ROUTES)[0] as string;
    expect(locations(buildSitemap(['/kept', excluded], origin))).toEqual([
      'https://example.test/kept',
    ]);
  });

  test('refuses to emit a sitemap that would index nothing', () => {
    // An empty <urlset> is a valid document that tells crawlers the site has no pages,
    // which is worse than no sitemap at all — so it fails loudly instead.
    expect(() => buildSitemap(Object.keys(EXCLUDED_ROUTES), origin)).toThrow(/index nothing/);
    expect(() => buildSitemap([], origin)).toThrow(/index nothing/);
  });

  test('escapes the characters that would otherwise be read as markup', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
    // `&` first, or the ampersands introduced by the later replacements get double-escaped.
    expect(escapeXml('&lt;')).toBe('&amp;lt;');
  });
});

describe('reading the origin out of robots.txt', () => {
  test('accepts exactly one directive, in any case', () => {
    expect(readOriginFromRobots('sitemap: https://vilnacrm.com/sitemap.xml\n')).toBe(
      'https://vilnacrm.com'
    );
  });

  test('ignores a commented-out directive rather than trusting it', () => {
    // robots.txt documents its own history, so a hostname the site no longer points at
    // lives in its comments. One that could become the origin would be a supply-chain
    // problem, not a formatting one.
    expect(() =>
      readOriginFromRobots('# Sitemap: https://claimable.example/sitemap.xml\n')
    ).toThrow(/found 0/);
  });

  test('refuses a file declaring two origins instead of silently picking one', () => {
    expect(() =>
      readOriginFromRobots(
        'Sitemap: https://vilnacrm.com/sitemap.xml\nSitemap: https://other.test/sitemap.xml\n'
      )
    ).toThrow(/found 2/);
  });
});
