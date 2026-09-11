/**
 * Gate the Sentry session-replay privacy contract pinned in `pages/_app.tsx`
 * (issue #337).
 *
 * The sign-up form is the only interactive surface on this site, so an unmasked
 * Sentry session replay would record a password field keystroke by keystroke.
 * `pages/_app.tsx` therefore pins the masking explicitly (#378 F3): `Sentry.init` is
 * called with `sendDefaultPii: false`, and the replay integration it registers is
 * `Sentry.replayIntegration({ maskAllInputs: true, maskAllText: true, blockAllMedia:
 * true })`, so an upstream default change cannot silently start capturing
 * credentials. Until this spec nothing asserted that pin: every other Sentry test
 * mocks `@sentry/react` for `captureException` / `setMeasurement`, so a flag flipped
 * to `false`, an option dropped, or a value turned into a runtime expression would
 * have shipped green.
 *
 * The contract is read from the `_app.tsx` source by parsing it with the TypeScript
 * compiler — never by importing it, since `_app.tsx` boots Apollo, MUI, i18n and the
 * service worker at module load — the same technique `client-env-contract.test.ts`
 * uses for `src/config/env.ts`. It is a pure file check with no runtime env, so it
 * runs unchanged under both the client and server Jest layers. Walking the AST rather
 * than matching text binds the gate to the namespace import of `@sentry/react`, to
 * the actual `Sentry.init(…)` argument and to the actual `Sentry.replayIntegration(…)`
 * argument, so a comment, a string literal or a look-alike identifier can neither
 * satisfy nor confuse it — and the gate survives a `_app.tsx` whose comments have been
 * stripped, which a regex anchored on the rationale comment would not.
 *
 * Fail-closed by construction. A missing `@sentry/react` namespace import, a missing
 * or duplicated `Sentry.init`, an argument that is not an object literal, a spread or
 * computed key (either can override or hide the literal beside it), a value that is
 * not the `true` / `false` keyword, a missing option, and a second `replayIntegration`
 * call that does not carry the full mask set all turn the gate red; the negative
 * cases below prove each one against inline source.
 */
import fs from 'node:fs';
import path from 'node:path';

import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const APP_PATH = path.join(REPO_ROOT, 'pages', '_app.tsx');

const SENTRY_MODULE = '@sentry/react';
const INIT_MEMBER = 'init';
const REPLAY_MEMBER = 'replayIntegration';
const PII_OPTION = 'sendDefaultPii';
const REPLAY_MASK_OPTIONS = ['maskAllInputs', 'maskAllText', 'blockAllMedia'] as const;

/** Every mask option pinned on, exactly as `_app.tsx` must spell them. */
const FULL_MASKING = { maskAllInputs: true, maskAllText: true, blockAllMedia: true } as const;

type BooleanOptions = Partial<Record<string, boolean>>;

interface SentryReplayContract {
  sendDefaultPii: boolean | undefined;
  replayIntegrations: BooleanOptions[];
}

/** The local name bound by `import * as <name> from '@sentry/react'`, or a thrown error. */
function sentryNamespaceOf(sourceFile: ts.SourceFile): string {
  for (const statement of sourceFile.statements) {
    const fromSentry =
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === SENTRY_MODULE;
    const bindings = fromSentry ? statement.importClause?.namedBindings : undefined;
    if (bindings && ts.isNamespaceImport(bindings)) return bindings.name.text;
  }
  throw new Error(`import * as <namespace> from '${SENTRY_MODULE}' not found`);
}

/** Whether `node` is the call `<namespace>.<member>(…)`. */
function isNamespaceCall(
  node: ts.Node,
  namespace: string,
  member: string
): node is ts.CallExpression {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const { expression: target, name } = node.expression;
  return ts.isIdentifier(target) && target.text === namespace && name.text === member;
}

/** Every `<namespace>.<member>(…)` call under `root`, in source order. */
function collectCalls(root: ts.Node, namespace: string, member: string): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (isNamespaceCall(node, namespace, member)) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return calls;
}

/** The object-literal first argument of a call; any other shape is not a pinned value. */
function optionsArgumentOf(call: ts.CallExpression): ts.ObjectLiteralExpression {
  const [argument] = call.arguments;
  if (argument && ts.isObjectLiteralExpression(argument)) return argument;
  throw new Error(`${call.expression.getText()}(…) is not called with an object literal`);
}

/** The static key of an object-literal property; a spread or computed key has none. */
function staticPropertyName(prop: ts.ObjectLiteralElementLike): string | undefined {
  const name = ts.isSpreadAssignment(prop) ? undefined : prop.name;
  return name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) ? name.text : undefined;
}

/** The `true` / `false` keyword a property is assigned; anything else is not a literal. */
function booleanLiteralOf(prop: ts.ObjectLiteralElementLike): boolean {
  const value = ts.isPropertyAssignment(prop) ? prop.initializer : undefined;
  if (value?.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (value?.kind === ts.SyntaxKind.FalseKeyword) return false;
  throw new Error(`${prop.getText()} is not a boolean literal`);
}

/**
 * Read the named options of an object literal as boolean literals. A spread could
 * override the literal beside it and a computed key could be any of the named
 * options, so both throw instead of being skipped; an option that is simply absent is
 * reported as `undefined` so the assertion names it.
 */
function booleanOptionsOf(
  obj: ts.ObjectLiteralExpression,
  keys: readonly string[]
): BooleanOptions {
  const options: BooleanOptions = {};
  for (const prop of obj.properties) {
    const name = staticPropertyName(prop);
    if (name === undefined) {
      throw new Error(`${prop.getText()} is not a statically known property`);
    }
    if (keys.includes(name)) options[name] = booleanLiteralOf(prop);
  }
  return options;
}

/**
 * Extract the replay privacy contract from `_app.tsx` source: the `sendDefaultPii`
 * literal on the single `Sentry.init(…)` call and the mask options of every
 * `Sentry.replayIntegration(…)` call in the file. Every call is read, not only the
 * one inside `integrations`, so a replay hoisted into a `const` is still checked and
 * a second, unmasked one cannot hide beside the masked one.
 */
function readSentryReplayContract(source: string): SentryReplayContract {
  const sourceFile = ts.createSourceFile(
    '_app.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const namespace = sentryNamespaceOf(sourceFile);
  const inits = collectCalls(sourceFile, namespace, INIT_MEMBER);
  const init = inits.length === 1 ? inits[0] : undefined;
  if (!init) {
    throw new Error(
      `expected exactly one ${namespace}.${INIT_MEMBER}({ … }) call, found ${inits.length}`
    );
  }
  const initOptions = booleanOptionsOf(optionsArgumentOf(init), [PII_OPTION]);
  const replayIntegrations = collectCalls(sourceFile, namespace, REPLAY_MEMBER).map(call =>
    booleanOptionsOf(optionsArgumentOf(call), REPLAY_MASK_OPTIONS)
  );
  return { sendDefaultPii: initOptions[PII_OPTION], replayIntegrations };
}

const readFile = (filePath: string): string => fs.readFileSync(filePath, 'utf-8');

describe('Sentry session-replay masking contract (issue #337)', () => {
  it('pins sendDefaultPii off and every replay mask on in pages/_app.tsx', () => {
    // Exactly one replay integration, fully masked: Sentry supports a single replay
    // instance, so a second call is a defect in its own right, and one that drops the
    // mask set is precisely the regression this gate exists to catch.
    expect(readSentryReplayContract(readFile(APP_PATH))).toEqual({
      sendDefaultPii: false,
      replayIntegrations: [FULL_MASKING],
    });
  });
});

describe('Sentry session-replay masking contract helpers', () => {
  const SENTRY_IMPORT = `import * as Sentry from '${SENTRY_MODULE}';`;
  const replayCall = (options: string): string => `Sentry.replayIntegration(${options})`;
  const fullMask = replayCall('{ maskAllInputs: true, maskAllText: true, blockAllMedia: true }');
  const buildSource = (initBody: string, preamble = ''): string =>
    [SENTRY_IMPORT, preamble, `Sentry.init({${initBody}});`].join('\n');
  const initWith = (pii: string, replay: string): string =>
    buildSource(`dsn: env.DSN, sendDefaultPii: ${pii}, integrations: [${replay}]`);

  describe('positive', () => {
    it('reads the pinned contract from a fully masked init (positive)', () => {
      expect(readSentryReplayContract(initWith('false', fullMask))).toEqual({
        sendDefaultPii: false,
        replayIntegrations: [FULL_MASKING],
      });
    });

    it('reads quoted option keys and a replay hoisted out of the init call', () => {
      const replay = replayCall(
        `{ 'maskAllInputs': true, "maskAllText": true, blockAllMedia: true }`
      );
      const source = buildSource(
        `'sendDefaultPii': false, integrations: [replay]`,
        `const replay = ${replay};`
      );
      expect(readSentryReplayContract(source)).toEqual({
        sendDefaultPii: false,
        replayIntegrations: [FULL_MASKING],
      });
    });

    it('follows a renamed namespace import instead of the identifier "Sentry"', () => {
      const source = [
        `import * as Monitoring from '${SENTRY_MODULE}';`,
        'Monitoring.init({ sendDefaultPii: false, integrations: [',
        '  Monitoring.replayIntegration({ maskAllInputs: true, maskAllText: true, blockAllMedia: true }),',
        '] });',
      ].join('\n');
      expect(readSentryReplayContract(source).sendDefaultPii).toBe(false);
    });
  });

  describe('negative — the contract is present but wrong', () => {
    it('reports a mask option set to false (negative)', () => {
      const replay = replayCall('{ maskAllInputs: true, maskAllText: false, blockAllMedia: true }');
      expect(readSentryReplayContract(initWith('false', replay)).replayIntegrations).toEqual([
        { maskAllInputs: true, maskAllText: false, blockAllMedia: true },
      ]);
    });

    it('reports sendDefaultPii set to true (negative)', () => {
      expect(readSentryReplayContract(initWith('true', fullMask)).sendDefaultPii).toBe(true);
    });

    it('reports a mask option that is missing as undefined rather than skipping it', () => {
      const replay = replayCall('{ maskAllInputs: true, blockAllMedia: true }');
      expect(readSentryReplayContract(initWith('false', replay)).replayIntegrations).toEqual([
        { maskAllInputs: true, blockAllMedia: true },
      ]);
    });

    it('reports a missing sendDefaultPii as undefined rather than skipping it', () => {
      const source = buildSource(`dsn: env.DSN, integrations: [${fullMask}]`);
      expect(readSentryReplayContract(source).sendDefaultPii).toBeUndefined();
    });

    it('reports a second replayIntegration call that carries no options', () => {
      const source = buildSource(
        `sendDefaultPii: false, integrations: [${fullMask}, ${replayCall('{}')}]`
      );
      expect(readSentryReplayContract(source).replayIntegrations).toEqual([FULL_MASKING, {}]);
    });

    it('reports no replay integration at all as an empty list (boundary)', () => {
      const source = buildSource('sendDefaultPii: false, integrations: []');
      expect(readSentryReplayContract(source).replayIntegrations).toEqual([]);
    });
  });

  describe('fail-closed — the contract cannot be read statically', () => {
    it('throws when the @sentry/react namespace import is absent', () => {
      expect(() => readSentryReplayContract('const x = 1;')).toThrow(/@sentry\/react/);
    });

    it('throws when the namespace comes from a look-alike module', () => {
      const source = `import * as Sentry from 'sentry-lookalike';\nSentry.init({ sendDefaultPii: false });`;
      expect(() => readSentryReplayContract(source)).toThrow(/@sentry\/react/);
    });

    it('throws when Sentry.init is never called', () => {
      expect(() => readSentryReplayContract(SENTRY_IMPORT)).toThrow(/exactly one Sentry\.init/);
    });

    it('throws when Sentry.init is called twice, since the later options win', () => {
      const source = `${initWith('false', fullMask)}\nSentry.init({ sendDefaultPii: true });`;
      expect(() => readSentryReplayContract(source)).toThrow(/exactly one Sentry\.init/);
    });

    it('does not count Sentry.init spelled inside a comment or a string', () => {
      // A regex over the source text would be satisfied by either of these; the AST
      // walk sees no call expression at all.
      const source = [
        SENTRY_IMPORT,
        '// Sentry.init({ sendDefaultPii: false });',
        "const note = 'Sentry.init({ sendDefaultPii: false })';",
      ].join('\n');
      expect(() => readSentryReplayContract(source)).toThrow(/exactly one Sentry\.init/);
    });

    it('throws on a computed option key rather than dropping it', () => {
      const replay = replayCall('{ [key]: true, maskAllText: true, blockAllMedia: true }');
      expect(() => readSentryReplayContract(initWith('false', replay))).toThrow(
        /not a statically known property/
      );
    });

    it('throws on a spread in the init options, which could override the literal', () => {
      const source = buildSource(
        `...baseOptions, sendDefaultPii: false, integrations: [${fullMask}]`
      );
      expect(() => readSentryReplayContract(source)).toThrow(/not a statically known property/);
    });

    it('throws on a spread in the replay options, which could override the literal', () => {
      const replay = replayCall(
        '{ maskAllInputs: true, maskAllText: true, blockAllMedia: true, ...rest }'
      );
      expect(() => readSentryReplayContract(initWith('false', replay))).toThrow(
        /not a statically known property/
      );
    });

    it('throws on a mask option whose value is an identifier, not a keyword', () => {
      const replay = replayCall('{ maskAllInputs: MASK, maskAllText: true, blockAllMedia: true }');
      expect(() => readSentryReplayContract(initWith('false', replay))).toThrow(
        /maskAllInputs: MASK is not a boolean literal/
      );
    });

    it('throws on a shorthand mask option, which reads a variable at runtime', () => {
      const replay = replayCall('{ maskAllInputs, maskAllText: true, blockAllMedia: true }');
      expect(() => readSentryReplayContract(initWith('false', replay))).toThrow(
        /maskAllInputs is not a boolean literal/
      );
    });

    it('throws on a sendDefaultPii computed from an expression', () => {
      expect(() => readSentryReplayContract(initWith('!allowPii', fullMask))).toThrow(
        /sendDefaultPii: !allowPii is not a boolean literal/
      );
    });

    it('throws when replayIntegration receives a variable instead of an object literal', () => {
      expect(() =>
        readSentryReplayContract(initWith('false', replayCall('replayOptions')))
      ).toThrow(/Sentry\.replayIntegration\(…\) is not called with an object literal/);
    });

    it('throws when replayIntegration is called with no options at all', () => {
      expect(() => readSentryReplayContract(initWith('false', replayCall('')))).toThrow(
        /Sentry\.replayIntegration\(…\) is not called with an object literal/
      );
    });

    it('throws when Sentry.init receives a variable instead of an object literal', () => {
      const source = `${SENTRY_IMPORT}\nSentry.init(options);`;
      expect(() => readSentryReplayContract(source)).toThrow(
        /Sentry\.init\(…\) is not called with an object literal/
      );
    });
  });
});
