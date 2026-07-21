// Regenerates the gitignored pages/i18n/localization.json (#328) on demand.
//
// The next.config webpack hook and the Jest globalSetup already regenerate it,
// but tooling that neither builds nor runs the Jest CLI needs it produced up
// front: dependency-cruiser resolves the `require(...)` statically, and
// Stryker's in-process Jest runner bypasses globalSetup. The Makefile invokes
// this before those gates.
import LocalizationGenerator from './localizationGenerator.js';

new LocalizationGenerator().generateLocalizationFile();
