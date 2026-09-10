/**
 * `.woff2` imports resolve to the emitted asset URL. Next's webpack config
 * turns them into `asset/resource` modules whose default export is that URL;
 * TypeScript needs telling separately.
 */
declare module '*.woff2' {
  const src: string;
  export default src;
}
