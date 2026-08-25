/**
 * Gate the client env-var contract between `src/config/env.ts` and the committed
 * env files (issue #372).
 *
 * In a Next.js static export (`output: 'export'`) a `NEXT_PUBLIC_*` value is inlined
 * at build time from the process env that `next build` sees. Next loads `.env` for
 * every build and then overlays `.env.production` for a production build, with the
 * production file taking precedence. So a client key that is declared in `.env` but
 * missing from `.env.production` does not fail any build — the production bundle
 * silently inherits the dev-flavoured value from `.env` (or `undefined`/the zod
 * default when the key is absent everywhere). Observability is exactly the feature
 * that dies this way in production with no error, no failing test, and no lint
 * warning (the original defect this gate was filed against was a Sentry DSN that
 * never reached the prod bundle).
 *
 * The validated `clientEnvSchema` in `src/config/env.ts` is the single source of
 * truth for which `NEXT_PUBLIC_*` keys the browser bundle consumes. This spec
 * asserts every one of those keys is explicitly declared in BOTH `.env` and
 * `.env.production`, so no client key can silently diverge between build flavours.
 * Presence — not value — is the contract: the observability keys ship intentionally
 * empty in the committed files (their real values are injected at deploy time), and
 * an empty value is still an explicit per-flavour declaration.
 *
 * The keys are read from the env.ts source by parsing it with the TypeScript
 * compiler (not by importing/executing it), so the spec stays a pure, environment-
 * agnostic file check that runs under both the client and server Jest envs (like
 * `i18n-key-parity.test.ts`) and never depends on the runtime env being loaded or
 * valid. Parsing the AST — rather than scanning text with a regex — binds the gate
 * to the *named* `clientEnvSchema` declaration (never a look-alike literal added
 * before it) and reads every key form the object can use, so no quoting or layout
 * can hide a key.
 *
 * Layer note — un-prefixed / dynamic `process.env` access (issue #372, layer 1) is
 * already gated for the production source (`src/**`, `pages/**`, excluding
 * `src/config/env.ts`) by the ESLint `no-restricted-syntax` rule that forbids
 * `process.env` reads there (#328). That rule intentionally ignores `src/test/**`
 * and tooling, so it does not cover this spec — which is why the parity check reads
 * the env files directly rather than importing the config. Layer 1 is therefore not
 * re-implemented here.
 */
import fs from 'node:fs';
import path from 'node:path';

import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ENV_CONFIG_PATH = path.join(REPO_ROOT, 'src', 'config', 'env.ts');
const ENV_FILE = path.join(REPO_ROOT, '.env');
const ENV_PRODUCTION_FILE = path.join(REPO_ROOT, '.env.production');

const CLIENT_KEY_PREFIX = 'NEXT_PUBLIC_';
const SCHEMA_IDENTIFIER = 'clientEnvSchema';

/**
 * The `NEXT_PUBLIC_*` keys declared by an object literal, read from the AST so every
 * static key form (identifier `KEY:` and quoted `'KEY':` / `"KEY":`) is captured
 * precisely and de-duplicated. A computed key (`[expr]:`) is statically unknown and
 * cannot be required to exist in a committed env file, so it throws — the gate fails
 * closed rather than silently dropping a key it cannot read.
 */
function clientKeysOf(obj: ts.ObjectLiteralExpression): string[] {
  const keys: string[] = [];
  for (const prop of obj.properties) {
    const name =
      ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop) ? prop.name : null;
    if (name && ts.isComputedPropertyName(name)) {
      throw new Error(
        `client env schema uses a computed property key (${name.getText()}); ` +
          'a statically unknown key cannot be verified against the committed env files'
      );
    }
    const text =
      name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) ? name.text : undefined;
    if (text?.startsWith(CLIENT_KEY_PREFIX)) keys.push(text);
  }
  return [...new Set(keys)].sort();
}

/** The object literal passed to the named `clientEnvSchema = z.object({ … })`. */
function findSchemaObject(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression | undefined {
  let found: ts.ObjectLiteralExpression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === SCHEMA_IDENTIFIER &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const arg = node.initializer.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) found = arg;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/** The object literal passed to the named `clientEnvSchema.safeParse({ … })`. */
function findSafeParseObject(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression | undefined {
  let found: ts.ObjectLiteralExpression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'safeParse' &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === SCHEMA_IDENTIFIER
    ) {
      const arg = node.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) found = arg;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/**
 * Extract the client key sets from the two independent declarations in `env.ts`:
 * the `clientEnvSchema` shape and the `safeParse` input it is validated against.
 * Both must be present, so a refactor that renames or removes either surfaces as a
 * thrown error instead of a vacuous pass.
 */
function parseEnvConfig(source: string): { schemaKeys: string[]; parseKeys: string[] } {
  const sourceFile = ts.createSourceFile('env.ts', source, ts.ScriptTarget.Latest, true);
  const schema = findSchemaObject(sourceFile);
  const parseInput = findSafeParseObject(sourceFile);
  if (!schema) {
    throw new Error(`${SCHEMA_IDENTIFIER} = z.object({ … }) not found in env.ts`);
  }
  if (!parseInput) {
    throw new Error(`${SCHEMA_IDENTIFIER}.safeParse({ … }) not found in env.ts`);
  }
  return { schemaKeys: clientKeysOf(schema), parseKeys: clientKeysOf(parseInput) };
}

/** Parse the declared keys (`KEY=...`) from a dotenv-style file, ignoring comments. */
function parseEnvFileKeys(content: string): Set<string> {
  const keys = new Set<string>();
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    // Comment and blank lines simply fail the `KEY=` match below.
    const match = line.startsWith('#')
      ? null
      : /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (match?.[1]) keys.add(match[1]);
  }
  return keys;
}

/** Keys required by the schema that are not declared in the given env file. */
function missingKeys(schemaKeys: readonly string[], declared: Set<string>): string[] {
  return schemaKeys.filter(key => !declared.has(key));
}

const readFile = (filePath: string): string => fs.readFileSync(filePath, 'utf-8');

describe('client env-var contract (issue #372)', () => {
  const { schemaKeys, parseKeys } = parseEnvConfig(readFile(ENV_CONFIG_PATH));

  it('discovers the client NEXT_PUBLIC_* keys from clientEnvSchema', () => {
    // Guards against a refactor of env.ts silently yielding zero keys, which would
    // make every parity assertion below pass vacuously (a false green).
    expect(schemaKeys.length).toBeGreaterThan(0);
    expect(schemaKeys.every(key => key.startsWith(CLIENT_KEY_PREFIX))).toBe(true);
  });

  it('extracts a self-consistent key set (schema shape === safeParse input)', () => {
    // env.ts feeds every schema field from `process.env` in its safeParse call, so
    // the `z.object` shape and the safeParse input must list the identical client
    // keys. A divergence means a key was added to one but not the other — the exact
    // drift that ships a client key which is validated but never actually read (or
    // vice versa) — so this turns red instead of letting the mismatch through.
    expect(parseKeys).toEqual(schemaKeys);
  });

  it('declares every client key in .env (dev/default build flavour)', () => {
    const declared = parseEnvFileKeys(readFile(ENV_FILE));
    expect(missingKeys(schemaKeys, declared)).toEqual([]);
  });

  it('declares every client key in .env.production (production build flavour)', () => {
    const declared = parseEnvFileKeys(readFile(ENV_PRODUCTION_FILE));
    expect(missingKeys(schemaKeys, declared)).toEqual([]);
  });
});

describe('client env-var contract helpers', () => {
  const buildSource = (schemaBody: string, parseBody: string): string =>
    [
      `const clientEnvSchema = z.object({${schemaBody}});`,
      `const parsed = clientEnvSchema.safeParse({${parseBody}});`,
    ].join('\n');

  describe('parseEnvConfig', () => {
    it('reads identifier, single-quoted, and double-quoted property keys', () => {
      const body = [
        '  NEXT_PUBLIC_API_URL: z.url(),',
        "  'NEXT_PUBLIC_MAIN_LANGUAGE': z.string(),",
        '  "NEXT_PUBLIC_SENTRY_DSN": z.string(),',
      ].join('\n');
      const { schemaKeys, parseKeys } = parseEnvConfig(buildSource(body, body));
      const expected = [
        'NEXT_PUBLIC_API_URL',
        'NEXT_PUBLIC_MAIN_LANGUAGE',
        'NEXT_PUBLIC_SENTRY_DSN',
      ];
      expect(schemaKeys).toEqual(expected);
      expect(parseKeys).toEqual(expected);
    });

    it('reads inline single-line declarations', () => {
      // buildSource keeps the object literal on one line, exercising inline parsing.
      const source = buildSource(
        ' NEXT_PUBLIC_A: z.url(), NEXT_PUBLIC_B: z.string() ',
        ' NEXT_PUBLIC_A: 1, NEXT_PUBLIC_B: 2 '
      );
      expect(parseEnvConfig(source).schemaKeys).toEqual(['NEXT_PUBLIC_A', 'NEXT_PUBLIC_B']);
    });

    it('accepts lower-case characters after the NEXT_PUBLIC_ prefix', () => {
      const body = '  NEXT_PUBLIC_camelKey: z.string(),';
      expect(parseEnvConfig(buildSource(body, body)).schemaKeys).toEqual(['NEXT_PUBLIC_camelKey']);
    });

    it('binds to the named clientEnvSchema, not an earlier z.object literal (fail-closed)', () => {
      // A decoy schema declared *before* clientEnvSchema — even one carrying a
      // NEXT_PUBLIC_* key — must not be mistaken for the client schema.
      const source = [
        'const serverSchema = z.object({ NEXT_PUBLIC_DECOY: z.string() });',
        'const clientEnvSchema = z.object({ NEXT_PUBLIC_API_URL: z.url() });',
        'const parsed = clientEnvSchema.safeParse({ NEXT_PUBLIC_API_URL: process.env.X });',
      ].join('\n');
      const { schemaKeys, parseKeys } = parseEnvConfig(source);
      expect(schemaKeys).toEqual(['NEXT_PUBLIC_API_URL']);
      expect(parseKeys).toEqual(['NEXT_PUBLIC_API_URL']);
    });

    it('does not treat a NEXT_PUBLIC_* value reference as a declared key', () => {
      // `KEY: process.env.NEXT_PUBLIC_X` — only the property key is a declaration;
      // the value expression must not be captured.
      const source = buildSource(
        '  NEXT_PUBLIC_API_URL: z.url(),',
        '  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,'
      );
      expect(parseEnvConfig(source).parseKeys).toEqual(['NEXT_PUBLIC_API_URL']);
    });

    it('ignores server-only / non-NEXT_PUBLIC_ keys', () => {
      const body = '  NEXT_PUBLIC_API_URL: z.url(),\n  SERVER_SECRET: z.string(),';
      expect(parseEnvConfig(buildSource(body, body)).schemaKeys).toEqual(['NEXT_PUBLIC_API_URL']);
    });

    it('throws on a computed property key rather than dropping it (fail-closed)', () => {
      const body = '  [dynamicKey]: z.string(),';
      expect(() => parseEnvConfig(buildSource(body, body))).toThrow(/computed property key/);
    });

    it('throws when the clientEnvSchema declaration is absent (boundary)', () => {
      expect(() => parseEnvConfig('const x = 1;')).toThrow(/clientEnvSchema/);
    });
  });

  describe('parseEnvFileKeys', () => {
    it('parses keys and ignores comments, blank lines, and export prefixes', () => {
      const content = [
        '# a comment',
        '',
        'NEXT_PUBLIC_API_URL=https://api.example.com',
        'export NEXT_PUBLIC_MAIN_LANGUAGE=en',
      ].join('\n');
      expect([...parseEnvFileKeys(content)].sort()).toEqual([
        'NEXT_PUBLIC_API_URL',
        'NEXT_PUBLIC_MAIN_LANGUAGE',
      ]);
    });

    it('treats a key with an empty value as declared (boundary)', () => {
      // The observability keys ship intentionally empty; an empty value is still an
      // explicit per-flavour declaration and must satisfy the contract.
      expect(parseEnvFileKeys('NEXT_PUBLIC_SENTRY_DSN=').has('NEXT_PUBLIC_SENTRY_DSN')).toBe(true);
    });

    it('does not treat interpolated references as separate keys', () => {
      // Build the `${VAR}` interpolation by concatenation so the literal is not a
      // template-string expression in this source file.
      const interpolation = `$${'{USER_SERVICE_VERSION}'}`;
      const keys = parseEnvFileKeys(`GRAPHQL_SCHEMA_URL=https://host/${interpolation}/spec`);
      expect([...keys]).toEqual(['GRAPHQL_SCHEMA_URL']);
    });
  });

  describe('missingKeys', () => {
    it('reports nothing when every schema key is declared (positive)', () => {
      const schema = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SENTRY_DSN'];
      const declared = new Set(schema);
      expect(missingKeys(schema, declared)).toEqual([]);
    });

    it('reports a key that is declared in dev but missing from prod (negative)', () => {
      const schema = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SENTRY_DSN'];
      const declared = new Set(['NEXT_PUBLIC_API_URL']);
      expect(missingKeys(schema, declared)).toEqual(['NEXT_PUBLIC_SENTRY_DSN']);
    });

    it('reports every missing key when the env file is empty (boundary)', () => {
      const schema = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SENTRY_DSN'];
      expect(missingKeys(schema, new Set())).toEqual(schema);
    });
  });
});
