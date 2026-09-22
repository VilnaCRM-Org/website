/**
 * Configuration for `next-export-optimize-images`.
 *
 * The static export (`output: 'export'`) runs every raster asset imported through
 * `next-export-optimize-images/image` through this pipeline. `convertFormat` emits a
 * WebP variant for every PNG/JPG/JPEG source so the exported `<picture>` serves WebP
 * (with the original as fallback), cutting image payload without changing markup.
 *
 * WebP is universally supported by the browsers the site targets (the Playwright
 * matrix — Chromium, Firefox, WebKit — all decode it), so the fallback is only a
 * safety net. SVGs are untouched (vector, already optimal).
 *
 * `generateFormats` only affects the `<Picture>` component's generated `<source>`
 * srcset, which this codebase never imports (every image call site uses
 * `next-export-optimize-images/image`'s `Image`/`getOptimizedImageProps` instead), so
 * pinning `avif` here does not make any image ship as AVIF today — it documents intent
 * so a future migration to `<Picture>` gets AVIF for free instead of it being forgotten.
 *
 * @type {import('next-export-optimize-images').Config}
 */
module.exports = {
  convertFormat: [
    ['png', 'webp'],
    ['jpg', 'webp'],
    ['jpeg', 'webp'],
  ],
  generateFormats: ['webp', 'avif'],
};
