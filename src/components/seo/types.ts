/**
 * Props for the shared per-page SEO head (`src/components/seo`, issue #339).
 *
 * Declared in their own module the way every other shared component here declares
 * theirs (`src/components/ui-link/types.ts`).
 */
export interface SeoProps {
  /** Page title. Rendered verbatim: the caller owns the branding suffix. */
  readonly title: string;
  readonly description: string;
  /** Site-relative path of this page, e.g. `/swagger`. Used for the canonical URL. */
  readonly path: string;
  /**
   * Keep the page out of search indexes. For documents that exist for a
   * mechanism rather than for a reader — the offline shell, the 404 — where an
   * indexed copy would only ever be a dead result.
   */
  readonly noindex?: boolean;
  /**
   * Emit the site-level `Organization` + `WebSite` JSON-LD graph. Site-level
   * entities describe the site as a whole, so exactly one page declares them —
   * the home page — rather than every page repeating the same two nodes.
   */
  readonly siteSchema?: boolean;
}
