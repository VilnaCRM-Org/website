/**
 * Jest transform for `.woff2` imports.
 *
 * `next/jest` maps images and stylesheets to mocks but leaves fonts alone, so a
 * font imported for its URL (see `src/config/Fonts/preload.ts`) reaches Jest as
 * raw binary and fails to parse.
 *
 * The module returns a URL that CONTAINS THE FILE'S NAME rather than one fixed
 * string, which is what webpack's `asset/resource` output does. A single shared
 * stub would make every face compare equal and would quietly defeat the
 * "six distinct weights" assertion that guards the preload list.
 */
module.exports = {
  process(_sourceText, sourcePath) {
    const fileName = sourcePath.split('/').pop();
    const url = `/_next/static/media/${fileName}`;
    return { code: `module.exports = ${JSON.stringify(url)};` };
  },
  getCacheKey() {
    return 'font-asset-transform-v1';
  },
};
