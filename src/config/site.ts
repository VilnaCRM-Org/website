export const SITE_ORIGIN: string = 'https://vilnacrm.com';

export function absoluteUrl(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`absoluteUrl expects a site-relative path starting with "/", got: ${path}`);
  }
  const resolved: URL = new URL(path, SITE_ORIGIN);
  if (resolved.origin !== SITE_ORIGIN) {
    throw new Error(
      `absoluteUrl refused a path resolving off-origin (${resolved.origin}): ${path}`
    );
  }
  return resolved.toString();
}
