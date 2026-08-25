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

    return config;
  },
});

module.exports = process.env.ANALYZE === 'true' ? withBundleAnalyzer(nextConfig) : nextConfig;
