import type { InitOptions } from 'i18next';

// Declaration shim for the sibling `i18nConfig.js`. That file stays JavaScript
// on purpose: it uses a guarded `require('../../pages/i18n/localization.json')`
// so a missing generated bundle throws a descriptive error, a runtime behaviour
// asserted by src/test/unit/localization.test.ts. Rewriting it in TypeScript
// would force a banned `require`/`eslint-disable` pair, so the config keeps its
// `.js` implementation and this shim gives its consumers real types.
declare const i18nConfig: InitOptions;

export default i18nConfig;
