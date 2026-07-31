/**
 * Gate the crawler directives in `robots.txt` (issue #383).
 *
 * Until #383 this file declared `Sitemap:` on a foreign preview-hosting project
 * subdomain — a host on a shared, self-service namespace that anyone reading this public
 * repository could have registered, on a site actually deployed to S3 + CloudFront. A
 * claimed project would then have served content that the site's own sitemap pointer
 * vouched for: SEO poisoning and phishing under a brand-associated host.
 *
 * Nothing else in the repository would notice that coming back. `robots.txt` is not part
 * of the static export today (only `public/` is copied, so no crawler reads it yet — see
 * issue #339, which publishes the SEO surface), it is outside every formatter and linter
 * glob, and a wrong hostname is invisible in review. Hence this spec.
 *
 * It resolves the file from `public/` first so it keeps gating after #339 moves it, and
 * it imports nothing from `src/`, so it adds no files to the client coverage denominator.
 */
import fs from 'node:fs';
import path from 'node:path';

// The apex origin the site is deployed to. `PROD_BUCKET_NAME` is `vilnacrm.com` and
// docs/deployment-runbook.md documents the same host; a Sitemap declared on any other
// host is discarded by crawlers as cross-host, so the two must not drift.
const CANONICAL_ORIGIN: string = 'https://vilnacrm.com';

const REPO_ROOT: string = path.resolve(__dirname, '../../..');

function resolveRobotsPath(): string {
  const candidates: string[] = [
    path.join(REPO_ROOT, 'public/robots.txt'),
    path.join(REPO_ROOT, 'robots.txt'),
  ];
  const found: string | undefined = candidates.find(candidate => fs.existsSync(candidate));
  if (found === undefined) {
    throw new Error(`robots.txt not found in any of: ${candidates.join(', ')}`);
  }
  return found;
}

const robotsPath: string = resolveRobotsPath();
const contents: string = fs.readFileSync(robotsPath, 'utf8');

// Comments explain the history and legitimately mention removed values; only real
// directives are under test.
const directives: string[] = contents
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0 && !line.startsWith('#'));

function valuesOf(field: string): string[] {
  const prefix: string = `${field.toLowerCase()}:`;
  return directives
    .filter(line => line.toLowerCase().startsWith(prefix))
    .map(line => line.slice(prefix.length).trim());
}

describe('robots.txt', () => {
  it('declares exactly one Sitemap directive', () => {
    expect(valuesOf('Sitemap')).toHaveLength(1);
  });

  it('points the sitemap at the canonical production origin', () => {
    const [sitemap] = valuesOf('Sitemap');
    expect(new URL(sitemap as string).origin).toBe(CANONICAL_ORIGIN);
  });

  it('points the sitemap at a sitemap document, not a bare host', () => {
    const [sitemap] = valuesOf('Sitemap');
    expect(new URL(sitemap as string).pathname).toBe('/sitemap.xml');
  });

  it('names no third-party hosting namespace anywhere, comments included', () => {
    // Deliberately whole-file: a claimable host is just as dangerous sitting in a
    // commented-out line somebody later uncomments.
    expect(contents).not.toMatch(/vercel\.app|netlify\.app|github\.io|pages\.dev/i);
  });

  it('keeps the crawl grant that makes the public site indexable', () => {
    expect(valuesOf('User-agent')).toContain('*');
    expect(valuesOf('Allow')).toContain('/');
  });

  it('declares no placeholder Disallow directories', () => {
    // The removed set (/cgi-bin/, /tmp/, /junk/, /private/, /hidden/) existed in no build
    // of this site. robots.txt is world-readable, so such entries advertise "interesting"
    // paths to anyone enumerating the site while protecting nothing.
    expect(valuesOf('Disallow').filter(value => value.length > 0)).toEqual([]);
  });

  it('keeps the canonical origin in step with the deployment runbook', () => {
    const runbook: string = fs.readFileSync(
      path.join(REPO_ROOT, 'docs/deployment-runbook.md'),
      'utf8'
    );
    expect(runbook).toContain(CANONICAL_ORIGIN);
  });
});
