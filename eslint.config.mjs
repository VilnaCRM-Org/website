import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import storybook from 'eslint-plugin-storybook';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const nextRecommended = { ...nextPlugin.configs.recommended };
delete nextRecommended.name;

// Issue #398 — `eslint-config-airbnb` / `eslint-config-airbnb-typescript` are gone.
// The rule *intent* airbnb provided is preserved two ways, so the effective config is
// unchanged: the recommended sets of the plugins this repo already depends on
// (`import`, `jsx-a11y`, `react`, `react-hooks`) are extended directly below, and the
// rules airbnb configured on top of them are re-expressed verbatim here, grouped by the
// airbnb source file that defined them. Rules Prettier owns are intentionally absent —
// `eslint-config-prettier` disabled them before this change too. Keep these blocks in
// the compat config's `rules` (not a later flat block) so the per-file overrides that
// follow still win, exactly as they did when airbnb sat in `extends`.
const airbnbBaseRules = {
  // best practices
  'array-callback-return': ['error', { allowImplicit: true }],
  'block-scoped-var': 'error',
  'consistent-return': 'error',
  'default-case': ['error', { commentPattern: '^no default$' }],
  'default-case-last': 'error',
  'default-param-last': 'error',
  'dot-notation': ['error', { allowKeywords: true }],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'grouped-accessor-pairs': 'error',
  'guard-for-in': 'error',
  'max-classes-per-file': ['error', 1],
  'no-alert': 'warn',
  'no-caller': 'error',
  'no-constructor-return': 'error',
  'no-else-return': ['error', { allowElseIf: false }],
  'no-empty-function': ['error', { allow: ['arrowFunctions', 'functions', 'methods'] }],
  'no-eval': 'error',
  'no-extend-native': 'error',
  'no-extra-bind': 'error',
  'no-extra-label': 'error',
  'no-implied-eval': 'error',
  'no-iterator': 'error',
  'no-labels': ['error', { allowLoop: false, allowSwitch: false }],
  'no-lone-blocks': 'error',
  'no-loop-func': 'error',
  'no-multi-str': 'error',
  'no-new': 'error',
  'no-new-func': 'error',
  'no-new-wrappers': 'error',
  'no-octal-escape': 'error',
  'no-param-reassign': [
    'error',
    {
      props: true,
      ignorePropertyModificationsFor: [
        'acc',
        'accumulator',
        'e',
        'ctx',
        'context',
        'req',
        'request',
        'res',
        'response',
        '$scope',
        'staticContext',
      ],
    },
  ],
  'no-proto': 'error',
  'no-restricted-properties': [
    'error',
    { object: 'arguments', property: 'callee', message: 'arguments.callee is deprecated' },
    { object: 'global', property: 'isFinite', message: 'Please use Number.isFinite instead' },
    { object: 'self', property: 'isFinite', message: 'Please use Number.isFinite instead' },
    { object: 'window', property: 'isFinite', message: 'Please use Number.isFinite instead' },
    { object: 'global', property: 'isNaN', message: 'Please use Number.isNaN instead' },
    { object: 'self', property: 'isNaN', message: 'Please use Number.isNaN instead' },
    { object: 'window', property: 'isNaN', message: 'Please use Number.isNaN instead' },
    { property: '__defineGetter__', message: 'Please use Object.defineProperty instead.' },
    { property: '__defineSetter__', message: 'Please use Object.defineProperty instead.' },
    { object: 'Math', property: 'pow', message: 'Use the exponentiation operator (**) instead.' },
  ],
  'no-return-assign': ['error', 'always'],
  'no-return-await': 'error',
  'no-script-url': 'error',
  'no-self-compare': 'error',
  'no-sequences': 'error',
  'no-throw-literal': 'error',
  'no-useless-concat': 'error',
  'no-useless-return': 'error',
  'no-void': 'error',
  'prefer-promise-reject-errors': ['error', { allowEmptyReject: true }],
  'prefer-regex-literals': ['error', { disallowRedundantWrapping: true }],
  radix: 'error',
  'vars-on-top': 'error',
  yoda: 'error',

  // possible errors — the tightened options airbnb layered on eslint:recommended
  'no-cond-assign': ['error', 'always'],
  'no-console': 'warn',
  'no-inner-declarations': 'error',
  'no-promise-executor-return': 'error',
  'no-template-curly-in-string': 'error',
  'no-unreachable-loop': ['error', { ignore: [] }],
  'no-unsafe-optional-chaining': ['error', { disallowArithmeticOperators: true }],
  'valid-typeof': ['error', { requireStringLiterals: true }],

  // variables
  'no-label-var': 'error',
  'no-restricted-globals': [
    'error',
    {
      name: 'isFinite',
      message:
        'Use Number.isFinite instead https://github.com/airbnb/javascript#standard-library--isfinite',
    },
    {
      name: 'isNaN',
      message:
        'Use Number.isNaN instead https://github.com/airbnb/javascript#standard-library--isnan',
    },
    // The `confusing-browser-globals` list, inlined so the rule survives without
    // airbnb's transitive dependency on that package.
    'addEventListener',
    'blur',
    'close',
    'closed',
    'confirm',
    'defaultStatus',
    'defaultstatus',
    'event',
    'external',
    'find',
    'focus',
    'frameElement',
    'frames',
    'history',
    'innerHeight',
    'innerWidth',
    'length',
    'location',
    'locationbar',
    'menubar',
    'moveBy',
    'moveTo',
    'name',
    'onblur',
    'onerror',
    'onfocus',
    'onload',
    'onresize',
    'onunload',
    'open',
    'opener',
    'opera',
    'outerHeight',
    'outerWidth',
    'pageXOffset',
    'pageYOffset',
    'parent',
    'print',
    'removeEventListener',
    'resizeBy',
    'resizeTo',
    'screen',
    'screenLeft',
    'screenTop',
    'screenX',
    'screenY',
    'scroll',
    'scrollbars',
    'scrollBy',
    'scrollTo',
    'scrollX',
    'scrollY',
    'self',
    'status',
    'statusbar',
    'stop',
    'toolbar',
    'top',
  ],
  'no-shadow': 'error',
  'no-undef-init': 'error',
  'no-use-before-define': ['error', { functions: true, classes: true, variables: true }],

  // ES6+
  'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: false }],
  'no-new-symbol': 'error',
  'no-restricted-exports': ['error', { restrictedNamedExports: ['default', 'then'] }],
  'no-useless-computed-key': 'error',
  'no-useless-constructor': 'error',
  'no-useless-rename': [
    'error',
    { ignoreDestructuring: false, ignoreImport: false, ignoreExport: false },
  ],
  'no-var': 'error',
  'object-shorthand': ['error', 'always', { ignoreConstructors: false, avoidQuotes: true }],
  'prefer-arrow-callback': ['error', { allowNamedFunctions: false, allowUnboundThis: true }],
  'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: true }],
  'prefer-destructuring': [
    'error',
    {
      VariableDeclarator: { array: false, object: true },
      AssignmentExpression: { array: true, object: false },
    },
    { enforceForRenamedProperties: false },
  ],
  'prefer-numeric-literals': 'error',
  'prefer-rest-params': 'error',
  'prefer-spread': 'error',
  'prefer-template': 'error',
  'symbol-description': 'error',

  // style — only the rules Prettier does not own
  camelcase: ['error', { properties: 'never', ignoreDestructuring: false }],
  'func-names': 'warn',
  'lines-around-directive': ['error', { before: 'always', after: 'always' }],
  'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: false }],
  'new-cap': [
    'error',
    {
      newIsCap: true,
      newIsCapExceptions: [],
      capIsNew: false,
      capIsNewExceptions: ['Immutable.Map', 'Immutable.Set', 'Immutable.List'],
    },
  ],
  'no-bitwise': 'error',
  'no-continue': 'error',
  'no-lonely-if': 'error',
  'no-multi-assign': 'error',
  'no-nested-ternary': 'error',
  'no-new-object': 'error',
  'no-plusplus': 'error',
  'no-unneeded-ternary': ['error', { defaultAssignment: false }],
  'one-var': ['error', 'never'],
  'operator-assignment': ['error', 'always'],
  'prefer-exponentiation-operator': 'error',
  'prefer-object-spread': 'error',
  'spaced-comment': [
    'error',
    'always',
    {
      line: { exceptions: ['-', '+'], markers: ['=', '!', '/'] },
      block: { exceptions: ['-', '+'], markers: ['=', '!', ':', '::'], balanced: true },
    },
  ],
  'unicode-bom': ['error', 'never'],

  // node
  'global-require': 'error',
  'no-buffer-constructor': 'error',
  'no-new-require': 'error',
  'no-path-concat': 'error',

  // strict mode
  strict: ['error', 'never'],

  // base rules airbnb re-tightens for React code
  'class-methods-use-this': [
    'error',
    {
      exceptMethods: [
        'render',
        'getInitialState',
        'getDefaultProps',
        'getChildContext',
        'componentWillMount',
        'UNSAFE_componentWillMount',
        'componentDidMount',
        'componentWillReceiveProps',
        'UNSAFE_componentWillReceiveProps',
        'shouldComponentUpdate',
        'componentWillUpdate',
        'UNSAFE_componentWillUpdate',
        'componentDidUpdate',
        'componentWillUnmount',
        'componentDidCatch',
        'getSnapshotBeforeUpdate',
      ],
    },
  ],
  'no-underscore-dangle': [
    'error',
    {
      allow: ['__REDUX_DEVTOOLS_EXTENSION_COMPOSE__'],
      allowAfterThis: false,
      allowAfterSuper: false,
      enforceInMethodNames: true,
    },
  ],
};

const airbnbImportRules = {
  'import/first': 'error',
  'import/newline-after-import': 'error',
  'import/no-absolute-path': 'error',
  'import/no-amd': 'error',
  // '∞' is the literal `maxDepth` sentinel this rule's schema accepts for "unbounded".
  'import/no-cycle': ['error', { maxDepth: '∞' }],
  'import/no-duplicates': 'error',
  'import/no-dynamic-require': 'error',
  'import/no-import-module-exports': ['error', { exceptions: [] }],
  'import/no-mutable-exports': 'error',
  'import/no-named-as-default': 'error',
  'import/no-named-as-default-member': 'error',
  'import/no-named-default': 'error',
  'import/no-relative-packages': 'error',
  'import/no-self-import': 'error',
  'import/no-useless-path-segments': ['error', { commonjs: true }],
  'import/no-webpack-loader-syntax': 'error',
  'import/order': ['error', { groups: [['builtin', 'external', 'internal']] }],
};

const airbnbReactRules = {
  // react
  'react/button-has-type': ['error', { button: true, submit: true, reset: false }],
  'react/default-props-match-prop-types': ['error', { allowRequiredDefaults: false }],
  'react/destructuring-assignment': ['error', 'always'],
  'react/forbid-foreign-prop-types': ['warn', { allowInPropTypes: true }],
  'react/forbid-prop-types': [
    'error',
    { forbid: ['any', 'array', 'object'], checkContextTypes: true, checkChildContextTypes: true },
  ],
  'react/function-component-definition': [
    'error',
    {
      namedComponents: ['function-declaration', 'function-expression'],
      unnamedComponents: 'function-expression',
    },
  ],
  'react/jsx-boolean-value': ['error', 'never', { always: [] }],
  'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
  'react/jsx-fragments': ['error', 'syntax'],
  'react/jsx-no-bind': [
    'error',
    {
      ignoreRefs: true,
      allowArrowFunctions: true,
      allowFunctions: false,
      allowBind: false,
      ignoreDOMComponents: true,
    },
  ],
  'react/jsx-no-constructed-context-values': 'error',
  'react/jsx-no-duplicate-props': ['error', { ignoreCase: true }],
  'react/jsx-no-script-url': ['error', [{ name: 'Link', props: ['to'] }]],
  'react/jsx-no-useless-fragment': 'error',
  'react/jsx-pascal-case': ['error', { allowAllCaps: true, ignore: [] }],
  'react/no-access-state-in-setstate': 'error',
  'react/no-array-index-key': 'error',
  'react/no-arrow-function-lifecycle': 'error',
  'react/no-danger': 'warn',
  'react/no-did-update-set-state': 'error',
  'react/no-invalid-html-attribute': 'error',
  'react/no-namespace': 'error',
  'react/no-redundant-should-component-update': 'error',
  'react/no-this-in-sfc': 'error',
  'react/no-typos': 'error',
  'react/no-unstable-nested-components': 'error',
  'react/no-unused-class-component-methods': 'error',
  'react/no-unused-prop-types': ['error', { customValidators: [], skipShapeProps: true }],
  'react/no-unused-state': 'error',
  'react/no-will-update-set-state': 'error',
  'react/prefer-es6-class': ['error', 'always'],
  'react/prefer-exact-props': 'error',
  'react/prefer-stateless-function': ['error', { ignorePureComponents: true }],
  'react/require-default-props': ['error', { forbidDefaultForRequired: true }],
  'react/self-closing-comp': 'error',
  'react/sort-comp': [
    'error',
    {
      order: [
        'static-variables',
        'static-methods',
        'instance-variables',
        'lifecycle',
        '/^handle.+$/',
        '/^on.+$/',
        'getters',
        'setters',
        '/^(get|set)(?!(InitialState$|DefaultProps$|ChildContext$)).+$/',
        'instance-methods',
        'everything-else',
        'rendering',
      ],
      groups: {
        lifecycle: [
          'displayName',
          'propTypes',
          'contextTypes',
          'childContextTypes',
          'mixins',
          'statics',
          'defaultProps',
          'constructor',
          'getDefaultProps',
          'getInitialState',
          'state',
          'getChildContext',
          'getDerivedStateFromProps',
          'componentWillMount',
          'UNSAFE_componentWillMount',
          'componentDidMount',
          'componentWillReceiveProps',
          'UNSAFE_componentWillReceiveProps',
          'shouldComponentUpdate',
          'componentWillUpdate',
          'UNSAFE_componentWillUpdate',
          'getSnapshotBeforeUpdate',
          'componentDidUpdate',
          'componentDidCatch',
          'componentWillUnmount',
        ],
        rendering: ['/^render.+$/', 'render'],
      },
    },
  ],
  'react/state-in-constructor': ['error', 'always'],
  'react/static-property-placement': ['error', 'property assignment'],
  'react/style-prop-object': 'error',
  'react/void-dom-elements-no-children': 'error',

  // react a11y — the two rules airbnb adds on top of jsx-a11y/recommended
  'jsx-a11y/control-has-associated-label': [
    'error',
    {
      labelAttributes: ['label'],
      controlComponents: [],
      ignoreElements: ['audio', 'canvas', 'embed', 'input', 'textarea', 'tr', 'video'],
      ignoreRoles: [
        'grid',
        'listbox',
        'menu',
        'menubar',
        'radiogroup',
        'row',
        'tablist',
        'toolbar',
        'tree',
        'treegrid',
      ],
      depth: 5,
    },
  ],
  'jsx-a11y/lang': 'error',

  // react hooks — airbnb/hooks promoted this above the plugin's `warn` default
  'react-hooks/exhaustive-deps': 'error',
};

// Stated literally rather than left as `'detect'`. Both resolve to the same
// version, but `'detect'` makes eslint-plugin-react probe the filesystem
// through `context.getFilename()`, which ESLint 10 removed — so a sandboxed
// runner on ESLint 10 (Qlty's, currently) dies with "Error while loading rule
// 'react/display-name'" on the first TypeScript file it lints. A literal also
// avoids resolving anything from this file's own directory, which tools that
// copy the config into a cache dir (Qlty again, see `tsconfigRootDir` below)
// would resolve differently.
//
// Keep in step with the `react` version in package.json.
const REACT_VERSION = '19.2';

export default [
  nextRecommended,
  ...storybook.configs['flat/recommended'],

  {
    // project-wide overrides for noisy style rules
    rules: {
      'import/prefer-default-export': 'off',
      'react/jsx-props-no-spreading': 'off',
      'no-await-in-loop': 'off',
      'no-restricted-syntax': 'off',
      'import/extensions': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },

  {
    // disable legacy storybook flat config in non-storybook files
    files: ['**/*'],
    rules: {
      'storybook/no-story-context-in-render': 'off',
    },
  },

  // Type-aware TS/TSX in app source only
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json',
        // Resolve tsconfig from the working directory (repo root) rather than the
        // config file's dir. Tools like qlty copy eslint.config.mjs into a cache
        // dir before running, which makes __dirname point outside the repo and
        // breaks tsconfig resolution. Lint is always invoked from the repo root.
        tsconfigRootDir: process.cwd(),
        sourceType: 'module',
        ecmaVersion: 2022,
      },
    },
  },

  // Non-type-checked configs/tests/stories/etc.
  {
    files: [
      '**/*.config.@(js|cjs|mjs)',
      '*rc.@(js|cjs|mjs)',
      'checkNodeVersion.js',
      'mutation.js',
      'next.config.js',
      'jest.global-setup.js',
      'lighthouserc.*.js',
      'commitlint.config.js',
      'stryker.config.mjs',
      'eslint.config.mjs',
      'docker/**/*.{js,ts,mts}',
      '**/*.stories.@(js|jsx|ts|tsx)',
      'src/test/**/*',
      // Every layer under tests/ — integration (#328) and contract (#350).
      'tests/**/*.{ts,tsx}',
    ],
    languageOptions: {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: null,
        sourceType: 'module',
        ecmaVersion: 2022,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'import/no-extraneous-dependencies': 'off',
      'no-console': 'off',
      'storybook/no-renderer-packages': 'off',
      'react/jsx-props-no-spreading': 'warn',
      'import/prefer-default-export': 'off',
      'no-await-in-loop': 'warn',
      'no-restricted-syntax': 'warn',
    },
  },

  ...compat.config({
    root: true,
    env: {
      node: true,
      es6: true,
      jest: true,
      browser: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    plugins: ['@typescript-eslint'],
    ignorePatterns: [
      'node_modules/**',
      'docker/**',
      'docker-compose.yml',
      'bun.lock',
      'build/**',
      'coverage/**',
      'storybook-static/**',
      'storybook-static-ci/**',
      'scripts/**',
      'playwright-report/**',
      'test-results/**',
      'out/**',
      '*.config.*',
      '*rc.*',
      'checkNodeVersion.js',
      'next.config.js',
      'jest.global-setup.js',
      'mutation.js',
      'lighthouserc.*.js',
      'commitlint.config.js',
      'eslint.config.mjs',
      'stryker.config.mjs',
      'next-env.d.ts',
    ],

    // Storybook flat config is applied above; keep its legacy extend removed to avoid
    // require() on ESM. The import / jsx-a11y / react-hooks recommended sets are
    // extended here rather than only in the TypeScript override below, so plain `.js`
    // files keep the coverage airbnb used to give them (issue #398).
    extends: [
      'eslint:recommended',
      'plugin:import/errors',
      'plugin:import/warnings',
      'plugin:jsx-a11y/recommended',
      'plugin:react-hooks/recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react/recommended',
      'prettier',
    ],
    // Settings airbnb supplied alongside its rules (issue #398). Without them
    // eslint-plugin-react has no React version to work from and eslint-plugin-import
    // resolves differently for plain `.js` files; the per-file overrides below
    // replace `import/resolver` for TypeScript, exactly as they did before.
    // airbnb shipped `version: 'detect'` here; `REACT_VERSION` is substituted for
    // it deliberately — see the constant's comment for why `'detect'` is unsafe.
    settings: {
      react: { pragma: 'React', version: REACT_VERSION },
      propWrapperFunctions: ['forbidExtraProps', 'exact', 'Object.freeze'],
      'import/resolver': { node: { extensions: ['.js', '.jsx', '.json'] } },
      'import/extensions': ['.js', '.mjs', '.jsx'],
      'import/core-modules': [],
      'import/ignore': ['node_modules', '\\.(coffee|scss|css|less|hbs|svg|json)$'],
    },
    rules: {
      ...airbnbBaseRules,
      ...airbnbImportRules,
      ...airbnbReactRules,
    },
    overrides: [
      {
        files: ['**/*.ts', '**/*.tsx'],
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint'],
        settings: {
          react: { version: REACT_VERSION },
          // `react/jsx-no-target-blank` only inspects components it knows are
          // links, which by default means a raw `<a>`. Every new-tab link here
          // goes through MUI's `<Link>`, so without this the rule had nothing to
          // check (#382 F2). `UiLink` is deliberately NOT listed: it merges
          // `noopener noreferrer` in itself, so a bare `target="_blank"` on it is
          // already safe and flagging it would only demand redundant markup.
          linkComponents: [{ name: 'Link', linkAttribute: 'href' }],
          'import/resolver': {
            node: {
              extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
            },
            typescript: {},
          },
        },
        env: {
          browser: true,
          node: true,
          es6: true,
        },
        extends: [
          'eslint:recommended',
          'plugin:import/errors',
          'plugin:import/warnings',
          'plugin:import/typescript',
          'plugin:@typescript-eslint/recommended',
          'plugin:react/recommended',
          'plugin:react-hooks/recommended',
          'plugin:jsx-a11y/recommended',
          'plugin:jest-dom/recommended',
          'plugin:eslint-comments/recommended',

          'plugin:@typescript-eslint/eslint-recommended',
        ],
        rules: {
          'eslint-comments/no-use': ['error', { allow: [] }],
          // Regression gate for the referrer-leak / reverse-tabnabbing fix:
          // a `target="_blank"` without `rel="noopener noreferrer"` fails
          // `make lint-next` (#382 F2).
          'react/jsx-no-target-blank': [
            'error',
            {
              allowReferrer: false,
              enforceDynamicLinks: 'always',
              warnOnSpreadAttributes: true,
              links: true,
              forms: true,
            },
          ],
          'react/jsx-no-bind': 'warn',
          'no-await-in-loop': 'off',
          'no-restricted-syntax': 'off',
          'no-alert': 'error',
          'no-console': 'error',
          'import/prefer-default-export': 'off',
          'max-len': ['error', { code: 150 }],
          'no-restricted-imports': [
            'error',
            {
              patterns: ['@/features/*/*'],
            },
          ],
          'no-extra-semi': 'off',
          'class-methods-use-this': 'off',
          'no-shadow': 'off',
          '@typescript-eslint/no-shadow': 'error',
          quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
          'no-multiple-empty-lines': [2, { max: 2, maxEOF: 0 }],

          'import/order': [
            'error',
            {
              groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object'],
              'newlines-between': 'always',
              alphabetize: { order: 'asc', caseInsensitive: true },
            },
          ],
          'import/default': 'off',
          'import/no-named-as-default-member': 'off',
          'import/no-named-as-default': 'off',
          'import/no-extraneous-dependencies': 'off',
          'import/no-unresolved': 'off',

          'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],

          'jsx-a11y/anchor-is-valid': 'off',
        },
      },
      {
        files: [
          '**/*.spec.js',
          '**/*.spec.jsx',
          'src/test/load/**/*.js',
          'src/test/memory-leak/**/*.js',
        ],
        parser: 'espree',
        extends: [
          'eslint:recommended',
          'plugin:react/recommended',
          'plugin:react-hooks/recommended',
        ],
        rules: {
          'no-console': 'error',
          'import/extensions': ['off', 'never', { js: 'never', jsx: 'never' }],
          'prefer-template': 'off',
          'no-restricted-syntax': 'off',
          'import/no-unresolved': 'off',
          'class-methods-use-this': 'off',
          'no-restricted-globals': 'off',
          'no-undef': 'off',
          'no-use-before-define': 'off',
          'import/no-extraneous-dependencies': 'off',
          'import/no-dynamic-require': 'off',
          'global-require': 'off',
          'no-await-in-loop': 'off',
          '@typescript-eslint/no-var-requires': 'off',
        },
      },
    ],
  }),

  {
    // final overrides to silence style-only complaints across project
    rules: {
      'import/extensions': 'off',
      'import/prefer-default-export': 'off',
      'react/jsx-props-no-spreading': 'off',
      'react/react-in-jsx-scope': 'off',
      'no-await-in-loop': 'off',
      'no-restricted-syntax': 'off',
      // Module resolution and dev-dependency provenance are handled by
      // TypeScript and dependency-cruiser, not eslint-plugin-import. Disable
      // globally (last-wins) so they hold even under tools that don't fully
      // apply the FlatCompat-converted overrides above (e.g. qlty's eslint).
      'import/no-unresolved': 'off',
      'import/no-extraneous-dependencies': 'off',
      // TSX is the standard JSX extension here (mirrors the override above).
      'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],
    },
  },

  {
    // Specs under tests/ resolve via tsconfig paths + .ts/.tsx extensions and use
    // test-only fetch/observer stubs. The FlatCompat-nested overrides above set
    // these rules, but sandboxed eslint runs (qlty/CI) only apply top-level flat
    // config, so re-declare them here as the last matching block for these files.
    files: ['tests/**/*.{js,ts,tsx}'],
    rules: {
      'import/no-unresolved': 'off',
      'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],
      'class-methods-use-this': 'off',
    },
  },

  {
    // Typed config guard (#328): every environment-variable read under src/ and
    // pages/ must go through the validated `src/config/env.ts` module. The
    // config module itself, tests and stories are exempt via `ignores` (a
    // files-scoped override, never disable comments). Declared as the last
    // top-level block so it wins under sandboxed eslint runs (qlty/CI) that only
    // apply top-level flat config, and so it overrides the project-wide
    // `no-restricted-syntax: 'off'` for these files.
    files: ['src/**/*.{ts,tsx,js,jsx}', 'pages/**/*.{ts,tsx,js,jsx}'],
    ignores: ['src/config/env.ts', 'src/test/**', '**/*.stories.@(js|jsx|ts|tsx)'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // Dotted access: process.env.X (and `const { X } = process.env`).
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'Read environment variables from the validated config in src/config/env.ts, not process.env directly (#328).',
        },
        {
          // Computed access: process['env'].
          selector: "MemberExpression[object.name='process'][property.value='env']",
          message:
            'Read environment variables from the validated config in src/config/env.ts, not process.env directly (#328).',
        },
      ],
    },
  },

  {
    // Same React version as the FlatCompat override above, restated at the top
    // level and last so it wins everywhere. Any `settings.react` a plugin preset
    // or a converted block contributes could still carry `version: 'detect'`, and
    // a runner that applies the converted top-level blocks but not the nested
    // overrides would keep that value — on ESLint 10 `'detect'` resolves through
    // `context.getFilename()`, which no longer exists, and the run dies loading
    // the first React rule.
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    settings: { react: { version: REACT_VERSION } },
  },
];
