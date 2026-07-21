/**
 * Generates `pages/i18n/localization.json` before any Jest suite runs.
 *
 * That file is a build artifact — the next.config webpack hook regenerates it on
 * every build, and it is gitignored (#328). Jest does not run webpack, and
 * `jest.setup.ts` imports the i18n stack (which `require`s the file) from
 * `setupFilesAfterEnv`, so it must exist before then. `globalSetup` runs once,
 * before the test framework and setup files, which is early enough.
 */
const LocalizationGenerator = require('./scripts/localizationGenerator');

module.exports = () => {
  new LocalizationGenerator().generateLocalizationFile();
};
