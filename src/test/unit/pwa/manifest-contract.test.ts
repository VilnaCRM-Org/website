/**
 * Contract gate for the web app manifest (issue #338).
 *
 * The manifest is the one file that makes promises to the operating system rather than to a
 * browser tab, and nothing else in the estate reads it: a broken `start_url`, a missing
 * icon, or a shortcut pointing at a route that was never built produces an installed app
 * that fails only on someone's home screen. The defect that opened this issue was exactly
 * that — a shortcut to `/dashboard`, a route this site does not have and the CloudFront edge
 * function hard-404s.
 *
 * So every navigable URL here is checked against the routes the site actually exports: the
 * `pages/` tree plus the rewrite table in `scripts/cloudfront_routing.js`, both read from
 * disk rather than restated, so adding a manifest entry for a route that does not exist
 * fails here instead of on a device.
 *
 * `src/test/unit/**` runs under both TEST_ENV=client (jsdom) and TEST_ENV=server (node), so
 * this stays pure `node:fs` + `JSON.parse` with no DOM.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT: string = path.resolve(__dirname, '..', '..', '..', '..');
const PUBLIC_DIR: string = path.join(REPO_ROOT, 'public');
const PAGES_DIR: string = path.join(REPO_ROOT, 'pages');
const DOCUMENT_PATH: string = path.join(PAGES_DIR, '_document.tsx');
const ROUTING_PATH: string = path.join(REPO_ROOT, 'scripts', 'cloudfront_routing.js');

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface ManifestShortcut {
  name: string;
  short_name: string;
  url: string;
  icons: ManifestIcon[];
}

interface WebManifest {
  id: string;
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  lang: string;
  dir: string;
  icons: ManifestIcon[];
  shortcuts: ManifestShortcut[];
}

// Route files that Next.js never exports as a navigable page.
const NON_ROUTE_BASENAMES: ReadonlySet<string> = new Set(['_app', '_document', '_error']);
const PAGE_EXTENSIONS: ReadonlySet<string> = new Set(['.tsx', '.ts', '.jsx', '.js']);

function collectPageRoutes(dir: string, prefix: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) {
      return collectPageRoutes(path.join(dir, entry.name), `${prefix}${entry.name}/`);
    }
    const extension: string = path.extname(entry.name);
    const basename: string = path.basename(entry.name, extension);
    if (!PAGE_EXTENSIONS.has(extension) || NON_ROUTE_BASENAMES.has(basename)) {
      return [];
    }
    return [basename === 'index' ? prefix.replace(/\/$/, '') || '/' : `${prefix}${basename}`];
  });
}

// The edge function's rewrite table is the second half of the routable surface: it maps
// pretty paths onto the flat export (`/swagger` -> `/swagger.html`). Read from the source
// rather than restated, so loosening it there cannot silently widen what the manifest may
// point at.
function collectEdgeRoutes(): string[] {
  const source: string = fs.readFileSync(ROUTING_PATH, 'utf-8');
  const table: RegExpExecArray | null = /ROUTE_MAP\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/.exec(
    source
  );
  const body: string | undefined = table?.[1];
  if (body === undefined) {
    throw new Error(`Could not find ROUTE_MAP in ${ROUTING_PATH}`);
  }
  return [...body.matchAll(/'([^']+)'\s*:/g)].flatMap(match => (match[1] ? [match[1]] : []));
}

function manifestHrefFromDocument(): string {
  const source: string = fs.readFileSync(DOCUMENT_PATH, 'utf-8');
  const link: RegExpExecArray | null = /<link\b[^>]*rel="manifest"[^>]*>/.exec(source);
  const href: string | undefined = link ? /href="([^"]+)"/.exec(link[0])?.[1] : undefined;
  if (href === undefined) {
    throw new Error(`Could not find a <link rel="manifest"> href in ${DOCUMENT_PATH}`);
  }
  return href;
}

const manifestHref: string = manifestHrefFromDocument();
const manifestPath: string = path.join(PUBLIC_DIR, manifestHref);
const manifest: WebManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as WebManifest;

const exportedRoutes: ReadonlySet<string> = new Set([
  ...collectPageRoutes(PAGES_DIR, '/'),
  ...collectEdgeRoutes(),
]);

const navigableUrls: [string, string][] = [
  ['start_url', manifest.start_url],
  ['scope', manifest.scope],
  ...manifest.shortcuts.map((shortcut): [string, string] => [
    `shortcuts["${shortcut.name}"].url`,
    shortcut.url,
  ]),
];

describe('<link rel="manifest"> in pages/_document.tsx', () => {
  it('points at a file that exists in public/', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
  });

  it('points at a file that parses as JSON', () => {
    expect(() => JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))).not.toThrow();
  });
});

describe('web app manifest identity', () => {
  it('pins the install identity so an install is never orphaned by a scope change', () => {
    expect(manifest.id).toBe('/');
  });

  it('launches and scopes at the site root', () => {
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
  });

  it('declares the locale the static export is built in', () => {
    expect(manifest.lang).toBe('uk');
    expect(manifest.dir).toBe('ltr');
  });

  it('keeps the standalone promise backed by an offline shell', () => {
    // `display: "standalone"` removes the address bar, so a failed launch has no escape
    // hatch. It is only honest while the worker and its fallback document both ship.
    expect(manifest.display).toBe('standalone');
    expect(fs.existsSync(path.join(PUBLIC_DIR, 'sw.js'))).toBe(true);
    expect(fs.existsSync(path.join(PAGES_DIR, 'offline.tsx'))).toBe(true);
  });
});

describe('web app manifest icons', () => {
  it('ships the two sizes every install prompt needs', () => {
    expect(manifest.icons.map(icon => icon.sizes)).toEqual(['192x192', '512x512']);
    expect(manifest.icons.map(icon => icon.type)).toEqual(['image/png', 'image/png']);
  });

  it.each([
    '/layout/favicon/web-app-manifest-192x192.png',
    '/layout/favicon/web-app-manifest-512x512.png',
  ])('resolves %s to a real file', src => {
    expect(manifest.icons.some(icon => icon.src === src)).toBe(true);
    expect(fs.existsSync(path.join(PUBLIC_DIR, src))).toBe(true);
  });

  it('declares no maskable icon', () => {
    // The icon art bleeds to the canvas edge, so a `maskable` purpose would let the OS crop
    // into the logo. Declaring only `any` makes the platform letterbox it instead.
    const purposes: (string | undefined)[] = [
      ...manifest.icons.map(icon => icon.purpose),
      ...manifest.shortcuts.flatMap(shortcut => shortcut.icons.map(icon => icon.purpose)),
    ];
    expect(purposes).not.toContain('maskable');
  });

  it.each([
    ['manifest', (): ManifestIcon[] => manifest.icons],
    ['shortcut', (): ManifestIcon[] => manifest.shortcuts.flatMap(shortcut => shortcut.icons)],
  ])('resolves every %s icon src to a file in public/', (_label, icons) => {
    const missing: string[] = icons()
      .map(icon => icon.src)
      .filter(src => !fs.existsSync(path.join(PUBLIC_DIR, src)));
    expect(missing).toEqual([]);
  });
});

describe('web app manifest routes', () => {
  it('derives the exported route surface from the repo, not from a hardcoded list', () => {
    expect(exportedRoutes.has('/')).toBe(true);
    expect(exportedRoutes.has('/swagger')).toBe(true);
    // The regression this gate exists for: a route the site has never exported.
    expect(exportedRoutes.has('/dashboard')).toBe(false);
  });

  it.each(navigableUrls)('%s (%s) is a route the site actually exports', (_field, url) => {
    expect([...exportedRoutes]).toContain(url);
  });
});
