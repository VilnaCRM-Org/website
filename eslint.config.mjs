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
      'tests/integration/**/*.{ts,tsx}',
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
      'pnpm-lock.yaml',
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

    extends: [
      'eslint:recommended',
      // Storybook flat config is applied above; keep legacy extend removed to avoid require() on ESM
      'airbnb',
      'airbnb/hooks',
      'plugin:@typescript-eslint/recommended',
      'plugin:react/recommended',
      'prettier',
    ],
    overrides: [
      {
        files: ['**/*.ts', '**/*.tsx'],
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint'],
        settings: {
          react: { version: 'detect' },
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
    // Integration tests resolve via tsconfig paths + .ts/.tsx extensions and use
    // test-only fetch/observer stubs. The FlatCompat-nested overrides above set
    // these rules, but sandboxed eslint runs (qlty/CI) only apply top-level flat
    // config, so re-declare them here as the last matching block for these files.
    files: ['tests/integration/**/*.{js,ts,tsx}'],
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
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'Read environment variables from the validated config in src/config/env.ts, not process.env directly (#328).',
        },
      ],
    },
  },
];
