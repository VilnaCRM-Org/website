import withBundleAnalyzerImport from '@next/bundle-analyzer';
import withExportImages from 'next-export-optimize-images';
import LocalizationGenerator from './scripts/localizationGenerator.js'; // додай .js, якщо потрібно

const withBundleAnalyzer = withBundleAnalyzerImport();

const nextConfigBase = withExportImages({
  output: 'export',
  reactStrictMode: true,
  swcMinify: true,

  compiler: {
    styledComponents: true,
    reactRemoveProperties: true,
    removeConsole: process.env.NODE_ENV === 'production',
  },

  webpack: (config) => {
    const localizationGenerator = new LocalizationGenerator();
    localizationGenerator.generateLocalizationFile();

    config.optimization.splitChunks = {
      chunks: 'all',
      maxSize: 244 * 1024,
    };

    return config;
  },
});

const nextConfig = process.env.ANALYZE === 'true'
  ? withBundleAnalyzer(nextConfigBase)
  : nextConfigBase;

export default nextConfig;
