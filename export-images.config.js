/**
 * Configuration for `next-export-optimize-images`. `convertFormat` emits a WebP
 * variant for every PNG/JPG/JPEG the static export processes, so the exported
 * `<picture>` serves WebP with the original as fallback; SVGs are untouched.
 *
 * @type {import('next-export-optimize-images').Config}
 */
module.exports = {
  convertFormat: [
    ['png', 'webp'],
    ['jpg', 'webp'],
    ['jpeg', 'webp'],
  ],
};
