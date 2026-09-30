const withBundleAnalyzer = require('@next/bundle-analyzer')();
const withExportImages = require('next-export-optimize-images');
const path = require('node:path');

const LocalizationGenerator = require('./scripts/localizationGenerator');

// react-syntax-highlighter's light build (the only highlighter swagger-ui-react
// ships) imports this lowlight 1 entry point; it is served by the shim instead.
const LOWLIGHT_V1_ENTRY = 'lowlight/lib/core';
const LOWLIGHT_COMPAT_SHIM = 'src/features/swagger/helpers/lowlight-compat.ts';

require('dotenv/config');
const dotenvExpand = require('dotenv-expand');
const env = require('dotenv').config();
dotenvExpand.expand(env);

/** @type {import('next').NextConfig} */

const nextConfig = withExportImages({
  output: 'export',
  reactStrictMode: true,
  transpilePackages: ['@faker-js/faker'],

  compiler: {
    reactRemoveProperties: true,
    // Strip `console.log`/`debug` from the production bundle but keep
    // `console.error`/`warn`: removing every console call left the shipped
    // client with no diagnostic channel whatsoever, so a failure on the
    // credential form surfaced nowhere (#378 F3).
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  webpack: config => {
    const localizationGenerator = new LocalizationGenerator();
    localizationGenerator.generateLocalizationFile();

    config.optimization.splitChunks = {
      chunks: 'all',
      maxSize: 244 * 1024,
    };

    // Let a `.woff2` be imported from TypeScript for its URL. `styles/global.css`
    // declares the faces (which is what makes the `@vilnacrm/ui-toolkit` themes
    // resolve them by their real family names), but a CSS `url()` yields no value
    // the app can read, and `pages/_document.tsx` needs the emitted paths to
    // preload the Golos faces the way `next/font` used to.
    //
    // The `filename` pattern is deliberately the one Next already uses for fonts
    // reached through CSS. Emitting to the same path means webpack ships ONE copy
    // per face that both the stylesheet and the preload tag point at, instead of a
    // second hashed copy that would double the font payload and preload a file the
    // stylesheet never uses.
    config.module.rules.push({
      test: /\.woff2$/,
      type: 'asset/resource',
      generator: { filename: 'static/media/[name].[hash:8][ext]' },
    });

    // Swap the end-of-life highlighter engine under /swagger (issue #379). The `$`
    // makes the match exact, so the shim's own `lowlight` import still reaches the
    // real package. See docs/swagger-highlighter-surface.md and ADR 0015.
    config.resolve.alias = {
      ...config.resolve.alias,
      [`${LOWLIGHT_V1_ENTRY}$`]: path.resolve(__dirname, LOWLIGHT_COMPAT_SHIM),
    };

    return config;
  },

  // `next dev` runs Turbopack, which never calls the `webpack` hook above, so the
  // same alias is declared for it too; without it /swagger fails to resolve
  // `lowlight/lib/core`, which lowlight 3 does not export, in development.
  turbopack: {
    resolveAlias: {
      [LOWLIGHT_V1_ENTRY]: `./${LOWLIGHT_COMPAT_SHIM}`,
    },
  },
});

module.exports = process.env.ANALYZE === 'true' ? withBundleAnalyzer(nextConfig) : nextConfig;
