const withBundleAnalyzer = require('@next/bundle-analyzer')();
const withExportImages = require('next-export-optimize-images');
const LocalizationGenerator = require('./scripts/localizationGenerator');

/** @type {import('next').NextConfig} */

const nextConfig = withExportImages({
  output: 'export',
  reactStrictMode: true,
  swcMinify: true,

  compiler: {
    styledComponents: true,
    reactRemoveProperties: true,
    removeConsole: process.env.NODE_ENV === 'production',
  },

  webpack: config => {
    const localizationGenerator = new LocalizationGenerator();
    localizationGenerator.generateLocalizationFile();

    // === SVG SUPPORT ===
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    // ===================

    config.optimization.splitChunks = {
      chunks: 'all',
      maxSize: 244 * 1024,
    };

    return config;
  },
});

module.exports = process.env.ANALYZE === 'true' 
  ? withBundleAnalyzer(nextConfig) 
  : nextConfig;