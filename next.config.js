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


  compiler: {
    styledComponents: true,
    reactRemoveProperties: true,
    removeConsole: process.env.NODE_ENV === 'production',
  },

  webpack: config => {
  const localizationGenerator = new LocalizationGenerator();
  localizationGenerator.generateLocalizationFile();

    config.optimization.splitChunks = {
      chunks: 'all',
      maxSize: 244 * 1024,
    };

  return config;
}

});

module.exports = process.env.ANALYZE === 'true' ? withBundleAnalyzer(nextConfig) : nextConfig;
