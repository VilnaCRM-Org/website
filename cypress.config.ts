import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    supportFile: './src/test/e2e/support/e2e.{ts, tsx}',
    specPattern: './src/test/e2e/spec/*.spec.{ts, tsx}',
  },
  downloadsFolder: './src/test/e2e/downloads',
  fileServerFolder: './src/test/e2e/fileServer',
  fixturesFolder: './src/test/e2e/fixtures',
  screenshotsFolder: './src/test/e2e/screenshots',
  videosFolder: './src/test/e2e/videos',
  supportFolder: './src/test/e2e/support',
});
