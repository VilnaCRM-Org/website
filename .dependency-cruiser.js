/**
 * dependency-cruiser configuration — VilnaCRM website
 *
 * Adapted from the CRM sister repo, rewritten for the website's FEATURE-BASED
 * structure (there is NO src/modules layer) and made PascalCase-safe:
 *   - Boundary rules target src/features/<feature>/, src/components/, and the
 *     foundational shared layers directly.
 *   - CRM's global `no-uppercase-paths` rule is DELIBERATELY OMITTED because the
 *     website's shared/feature COMPONENT directories are PascalCase by convention
 *     (UiButton, AboutUs, AppTheme). Lowercase enforcement is scoped to FEATURE
 *     directory NAMES only, via `src-feature-name-kebab-case` (rule 16).
 *
 * Run with: make lint-deps   (depcruise src tests --config .dependency-cruiser.js)
 */
module.exports = {
  forbidden: [
    // ── GENERIC HYGIENE (ported from CRM) ──────────────────────────────────

    // 1. Circular dependencies — closes the unconfigured ESLint import/no-cycle gap. (FR6)
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No circular dependencies are allowed.',
      from: {},
      to: { circular: true },
    },

    // 2. Orphan (unused) modules — entrypoints/configs/outputs are exempted. (FR12a)
    {
      name: 'no-orphans',
      severity: 'error',
      comment: 'Modules that are not imported by anything (orphans) are flagged.',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|json)$', // dot-files (.eslintrc.js, etc.)
          '[.]d[.]ts$', // type declarations
          '(^|/)tsconfig[.]json$',
          '(^|/)(?:babel|webpack)[.]config[.][^/]+$',
          '(^|/)(?:commitlint|stryker)[.]config[.][^/]+$',
          '(^|/)__mocks__/',
          '(^|/)next[.]config[.]js$',
          '(^|/)jest[.]config[.]ts$',
          '(^|/)jest[.]mutation[.]config[.]ts$',
          '(^|/)babel-jest[.]config[.]js$',
          '(^|/)i18n[.]js$',
          '(^|/)mutation[.]js$',
          '(^|/)checkNodeVersion[.]js$',
          '(^|/)lighthouserc[.][^/]+[.]js$',
          '^pages/', // Next.js page entrypoints
          '^[.]storybook/',
          '^coverage/',
          '^test-results/',
          '^playwright-report/',
          '^storybook-static/',
        ],
      },
      to: {},
    },

    // 3. Deprecated core (Node built-in) modules. (FR12b)
    {
      name: 'no-deprecated-core',
      severity: 'warn',
      comment: 'Do not depend on deprecated Node core modules.',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: [
          '^(v8/tools/codemap)$',
          '^(v8/tools/consarray)$',
          '^(v8/tools/csvparser)$',
          '^(v8/tools/logreader)$',
          '^(v8/tools/profile_view)$',
          '^(v8/tools/profile)$',
          '^(v8/tools/SourceMap)$',
          '^(v8/tools/splaytree)$',
          '^(v8/tools/tickprocessor-driver)$',
          '^(v8/tools/tickprocessor)$',
          '^(node-inspect/lib/_inspect)$',
          '^(node-inspect/lib/internal/inspect_client)$',
          '^(node-inspect/lib/internal/inspect_repl)$',
          '^(async_hooks)$',
          '^(punycode)$',
          '^(domain)$',
          '^(constants)$',
          '^(sys)$',
          '^(_linklist)$',
          '^(_stream_wrap)$',
        ],
      },
    },

    // 4. Deprecated npm packages. (FR12b)
    {
      name: 'not-to-deprecated',
      severity: 'warn',
      comment: 'Do not depend on npm packages flagged deprecated.',
      from: {},
      to: { dependencyTypes: ['deprecated'] },
    },

    // 5. Imports not present in package.json. (FR12c)
    {
      name: 'no-non-package-json',
      severity: 'error',
      comment: 'Do not depend on packages absent from package.json.',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },

    // 6. Unresolvable modules (http(s) URLs excepted). (FR12c)
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'Do not depend on modules that cannot be resolved.',
      from: {},
      to: { couldNotResolve: true, pathNot: ['^https?://'] },
    },

    // 7. A dependency declared under more than one type (type-only excepted). (FR12d)
    {
      name: 'no-duplicate-dep-types',
      severity: 'warn',
      comment: 'A dependency should be declared under exactly one dependency type.',
      from: {},
      to: { moreThanOneDependencyType: true, dependencyTypesNot: ['type-only'] },
    },

    // 8. Non-test code must not import from test folders. (FR12e)
    {
      name: 'not-to-test',
      severity: 'error',
      comment: 'Production code must not import from test folders (src/test, tests).',
      from: { pathNot: '^(?:src/test|tests)' },
      to: { path: '^(?:src/test|tests)' },
    },

    // 9. Nothing may import *.spec / *.test files. (FR12e)
    {
      name: 'not-to-spec',
      severity: 'error',
      comment: 'Spec/test files must not be imported by anything.',
      from: {},
      to: { path: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$' },
    },

    // 10. src runtime code must not import devDependencies. (FR12f)
    {
      name: 'not-to-dev-dep',
      severity: 'error',
      comment: 'Runtime code under src must not depend on devDependencies.',
      from: {
        path: '^src',
        // Exempt all test code (specs, fixtures, helpers) — tests legitimately
        // use devDependencies (@playwright/test, @testing-library, faker, etc.).
        pathNot: ['[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$', '^src/test/'],
      },
      to: {
        dependencyTypes: ['npm-dev'],
        dependencyTypesNot: ['type-only'],
        pathNot: ['node_modules/@types/'],
      },
    },

    // ── ARCHITECTURE BOUNDARY RULES (the feature-based adaptation) ──────────

    // 11. Outside code may import a feature ONLY through its index barrel. (FR7)
    //     Formalizes ESLint no-restricted-imports ['@/features/*/*'] at graph level.
    {
      name: 'features-import-via-public-api',
      severity: 'error',
      comment:
        'Import a feature only through its public index barrel; do not reach into its internals.',
      from: {
        path: '^src/',
        // Tests may import feature internals directly; the public-API rule
        // applies to production code only.
        pathNot: ['^src/features/[^/]+/', '^src/test/'],
      },
      to: {
        path: '^src/features/[^/]+/(?!index[.](?:js|cjs|mjs|jsx|ts|cts|mts|tsx)$).+',
      },
    },

    // 12. A feature must not import a sibling feature at all. (FR8)
    {
      name: 'no-cross-feature-imports',
      severity: 'error',
      comment: 'A feature must not import another feature; use shared layers instead.',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/(?!$1/)' },
    },

    // 13. The shared UI library must stay feature-agnostic. (FR9)
    {
      name: 'no-shared-ui-to-features',
      severity: 'error',
      comment: 'src/components (shared UI) must not depend on any feature.',
      from: { path: '^src/components/' },
      to: { path: '^src/features/' },
    },

    // 14. Foundational shared layers must not depend on features. (FR10)
    {
      name: 'no-shared-layers-to-features',
      severity: 'error',
      comment: 'Foundational/shared layers must not depend on any feature.',
      from: {
        path: '^src/(?:shared|hooks|utils|lib|providers|types|config|routes|stores)/',
      },
      to: { path: '^src/features/' },
    },

    // 15. A feature root may only contain approved subfolders. (FR13a)
    {
      name: 'feature-allowed-folders',
      severity: 'error',
      comment:
        'A feature may only contain: api, assets, components, constants, helpers, hooks, i18n, routes, types, utils.',
      from: {
        path: '^src/features/[^/]+/(?!(?:api|assets|components|constants|helpers|hooks|i18n|routes|types|utils)/)[^/]+/',
      },
      to: {},
    },

    // 16. FEATURE DIRECTORY NAMES MUST BE LOWERCASE KEBAB-CASE. (FR11)
    //     *** STAKEHOLDER-MANDATED. Scoped to feature names ONLY — this is the
    //     deliberate replacement for CRM's omitted global no-uppercase-paths. ***
    {
      name: 'src-feature-name-kebab-case',
      severity: 'error',
      comment: 'Feature directory names must be lowercase kebab-case (e.g. user-onboarding).',
      from: { path: '^src/features/(?![a-z0-9-]+/)[^/]+/' },
      to: {},
    },
  ],

  options: {
    doNotFollow: { path: ['node_modules'] },
    detectProcessBuiltinModuleCalls: true,
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    // Resolve the @/* alias and TypeScript "bundler" moduleResolution.
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.d.ts', '.js', '.jsx'],
      mainFields: ['main', 'types', 'typings'],
    },
    skipAnalysisNotInRules: true,
    // Website load tests import k6 (resolved by the k6 runtime, not Node).
    // NOTE: deliberately NO bun built-ins — the website is node/pnpm.
    builtInModules: { add: ['k6', 'k6/http'] },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/(?:@[^/]+/[^/]+|[^/]+)' },
      archi: { collapsePattern: 'node_modules/(?:@[^/]+/[^/]+|[^/]+)' },
      text: { highlightFocused: true },
    },
  },
};
