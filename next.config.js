const withBundleAnalyzer = require('@next/bundle-analyzer')();
const withExportImages = require('next-export-optimize-images');
const LocalizationGenerator = require('./scripts/localizationGenerator');

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

    return config;
  },
});

module.exports = process.env.ANALYZE === 'true' ? withBundleAnalyzer(nextConfig) : nextConfig;
