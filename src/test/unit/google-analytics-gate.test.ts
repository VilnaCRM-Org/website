/**
 * Gate the Google Analytics conditional-render contract pinned in `pages/_app.tsx`
 * (issue #327).
 *
 * The shipped analytics snippet used to hardcode a template placeholder measurement id
 * (`G-XYZ`), which would have reported real visitor traffic under a fake property even
 * after the placeholder was replaced by an env-gated render. `pages/_app.tsx` now renders
 * `<GoogleAnalytics />` only when `env.NEXT_PUBLIC_GA_MEASUREMENT_ID` is set, and binds
 * the same expression to both the guard and the `gaId` prop, so an empty/unset id never
 * boots the analytics script and a configured id is never silently swapped for a
 * different one. Nothing asserted that pin before this spec.
 *
 * The contract is read from the `_app.tsx` source by parsing it with the TypeScript
 * compiler — never by importing it, since `_app.tsx` boots Apollo, MUI, i18n, Sentry and
 * the service worker at module load — the same technique `sentry-replay-masking.test.ts`
 * uses for the same file. It is a pure file check with no runtime env, so it runs
 * unchanged under both the client and server Jest layers. Walking the AST rather than
 * matching text binds the gate to the actual named import, to the actual ternary guarding
 * the actual `<GoogleAnalytics>` usage, and to the actual `gaId` prop expression, so a
 * comment, a string literal or a look-alike identifier can neither satisfy nor confuse
 * it — and the gate survives a `_app.tsx` whose comments have been stripped, which a
 * regex anchored on a rationale comment would not.
 *
 * Fail-closed by construction. A missing or aliased `GoogleAnalytics` import, an
 * unconditional (unguarded) render, zero or more than one `<GoogleAnalytics>` usage in the
 * file, and a `gaId` attribute with no value all throw rather than being skipped; the
 * negative cases below prove each one against inline source. Content that is present but
 * wrong — a guard bound to a different env member than the prop, a guard on the wrong env
 * var entirely, a non-null fallback, a hardcoded id-shaped literal under an otherwise
 * correct guard — is reported in the returned contract instead of thrown, exactly as
 * `sentry-replay-masking.test.ts` reports rather than throws for a flipped mask option.
 */
import fs from 'node:fs';
import path from 'node:path';

import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const APP_PATH = path.join(REPO_ROOT, 'pages', '_app.tsx');

const GA_MODULE = '@next/third-parties/google';
const GA_EXPORT = 'GoogleAnalytics';
const GA_ID_PROP = 'gaId';
const PINNED_GUARD = 'env.NEXT_PUBLIC_GA_MEASUREMENT_ID';

/** The literal shape of the placeholder that used to ship: `G-XYZ`. */
const GA_ID_LITERAL_SHAPE = /^(G|GT|UA|AW)-[A-Z0-9-]+$/;

interface GoogleAnalyticsGateContract {
  guardCondition: string;
  gaIdExpression: string;
  whenFalseIsNull: boolean;
  hasHardcodedGaIdLiteral: boolean;
}

type GoogleAnalyticsOpeningElement = ts.JsxSelfClosingElement | ts.JsxOpeningElement;

/**
 * The local name bound by `import { GoogleAnalytics } from '@next/third-parties/google'`.
 * A renamed local binding (`import { GoogleAnalytics as GA }`) is rejected rather than
 * followed, so the gate never silently tracks an alias away from the name every other
 * usage in this check is anchored to.
 */
function googleAnalyticsLocalNameOf(sourceFile: ts.SourceFile): string {
  for (const statement of sourceFile.statements) {
    const fromGaModule =
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === GA_MODULE;
    const bindings = fromGaModule ? statement.importClause?.namedBindings : undefined;
    const elements = bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
    const match = elements.find(
      element => (element.propertyName ?? element.name).text === GA_EXPORT
    );
    if (match) {
      if (match.propertyName && match.name.text !== GA_EXPORT) {
        throw new Error(
          `import { ${GA_EXPORT} } from '${GA_MODULE}' must not be aliased ` +
            `(found "${match.name.text}")`
        );
      }
      return match.name.text;
    }
  }
  throw new Error(`import { ${GA_EXPORT} } from '${GA_MODULE}' not found`);
}

/** Every JSX opening tag named `localName`, self-closing or not, in source order. */
function collectGoogleAnalyticsUsages(
  root: ts.Node,
  localName: string
): GoogleAnalyticsOpeningElement[] {
  const usages: GoogleAnalyticsOpeningElement[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const { tagName } = node;
      if (ts.isIdentifier(tagName) && tagName.text === localName) usages.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return usages;
}

/** The expression node a usage stands for in the wider tree: itself, or its JsxElement. */
function jsxNodeOf(opening: GoogleAnalyticsOpeningElement): ts.Expression {
  return ts.isJsxSelfClosingElement(opening) ? opening : (opening.parent as ts.JsxElement);
}

/**
 * The ternary that gates `usage`, unwrapping any parentheses around it first — the real
 * file wraps the JSX true-branch in parens, but a bare true-branch must read identically.
 * A usage with no such ternary above it — an unconditional render — throws.
 */
function conditionalGuarding(usage: ts.Expression): ts.ConditionalExpression {
  let node: ts.Node = usage;
  while (ts.isParenthesizedExpression(node.parent)) {
    node = node.parent;
  }
  const { parent } = node;
  if (parent && ts.isConditionalExpression(parent) && parent.whenTrue === node) {
    return parent;
  }
  throw new Error(`${usage.getText()} is not gated by a conditional (ternary) expression`);
}

/** The `gaId` attribute of an opening element; throws when the prop is not set at all. */
function gaIdAttributeOf(opening: GoogleAnalyticsOpeningElement): ts.JsxAttribute {
  const attribute = opening.attributes.properties.find(
    (prop): prop is ts.JsxAttribute =>
      ts.isJsxAttribute(prop) && ts.isIdentifier(prop.name) && prop.name.text === GA_ID_PROP
  );
  if (!attribute) {
    throw new Error(`${opening.getText()} has no ${GA_ID_PROP} attribute`);
  }
  return attribute;
}

/**
 * The `gaId` value as source text — the unwrapped expression for `gaId={…}`, or the raw
 * literal text (quotes included) for a hardcoded `gaId="…"` — so it can be compared
 * against the guard condition's text for exact identity.
 */
function gaIdExpressionTextOf(attribute: ts.JsxAttribute): string {
  const { initializer } = attribute;
  if (initializer === undefined) {
    throw new Error(`${GA_ID_PROP} attribute has no value`);
  }
  if (ts.isJsxExpression(initializer)) {
    if (initializer.expression === undefined) {
      throw new Error(`${GA_ID_PROP}={} has no expression`);
    }
    return initializer.expression.getText().trim();
  }
  return initializer.getText().trim();
}

/** Whether any string literal anywhere in the file has the shape of a real GA id. */
function hasGaIdShapedStringLiteral(root: ts.Node): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) && GA_ID_LITERAL_SHAPE.test(node.text)) found = true;
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

/**
 * Extract the Google Analytics conditional-render contract from `_app.tsx` source: the
 * ternary condition guarding the single `<GoogleAnalytics>` usage, the expression bound to
 * its `gaId` prop, whether the false-branch is exactly `null`, and whether any string
 * literal in the file has the shape of a real (non-placeholder) GA id.
 */
function readGoogleAnalyticsGateContract(source: string): GoogleAnalyticsGateContract {
  const sourceFile = ts.createSourceFile(
    '_app.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const localName = googleAnalyticsLocalNameOf(sourceFile);
  const usages = collectGoogleAnalyticsUsages(sourceFile, localName);
  if (usages.length !== 1) {
    throw new Error(`expected exactly one <${localName}…> usage, found ${usages.length}`);
  }
  const opening = usages[0]!;
  const conditional = conditionalGuarding(jsxNodeOf(opening));
  const attribute = gaIdAttributeOf(opening);
  return {
    guardCondition: conditional.condition.getText().trim(),
    gaIdExpression: gaIdExpressionTextOf(attribute),
    whenFalseIsNull: conditional.whenFalse.kind === ts.SyntaxKind.NullKeyword,
    hasHardcodedGaIdLiteral: hasGaIdShapedStringLiteral(sourceFile),
  };
}

const readFile = (filePath: string): string => fs.readFileSync(filePath, 'utf-8');

describe('Google Analytics conditional-render contract (issue #327)', () => {
  it('renders GoogleAnalytics only when the GA measurement id env var is set, with no hardcoded id', () => {
    expect(readGoogleAnalyticsGateContract(readFile(APP_PATH))).toEqual({
      guardCondition: PINNED_GUARD,
      gaIdExpression: PINNED_GUARD,
      whenFalseIsNull: true,
      hasHardcodedGaIdLiteral: false,
    });
  });
});

describe('Google Analytics conditional-render contract helpers', () => {
  const GA_IMPORT = `import { GoogleAnalytics } from '${GA_MODULE}';`;
  const buildSource = (jsx: string, preamble = ''): string =>
    [GA_IMPORT, preamble, `function Component() { return (<main>${jsx}</main>); }`].join('\n');
  const REAL_SHAPE =
    '{env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (<GoogleAnalytics gaId={env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />) : null}';

  describe('positive', () => {
    it('reads the pinned contract from the real shape (positive)', () => {
      expect(readGoogleAnalyticsGateContract(buildSource(REAL_SHAPE))).toEqual({
        guardCondition: PINNED_GUARD,
        gaIdExpression: PINNED_GUARD,
        whenFalseIsNull: true,
        hasHardcodedGaIdLiteral: false,
      });
    });

    it('reads the same contract when the true-branch JSX is not parenthesized (boundary)', () => {
      const bareShape =
        '{env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? <GoogleAnalytics gaId={env.NEXT_PUBLIC_GA_MEASUREMENT_ID} /> : null}';
      expect(readGoogleAnalyticsGateContract(buildSource(bareShape))).toEqual({
        guardCondition: PINNED_GUARD,
        gaIdExpression: PINNED_GUARD,
        whenFalseIsNull: true,
        hasHardcodedGaIdLiteral: false,
      });
    });
  });

  describe('negative — the contract is present but wrong', () => {
    it('reports a guard bound to a different env member than the gaId prop', () => {
      const mismatched =
        '{env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (<GoogleAnalytics gaId={env.NEXT_PUBLIC_SENTRY_DSN} />) : null}';
      const contract = readGoogleAnalyticsGateContract(buildSource(mismatched));
      expect(contract.guardCondition).toBe(PINNED_GUARD);
      expect(contract.gaIdExpression).toBe('env.NEXT_PUBLIC_SENTRY_DSN');
      expect(contract.guardCondition).not.toBe(contract.gaIdExpression);
    });

    it('reports a guard on the wrong env var entirely, not the GA measurement id', () => {
      const wrongVar =
        '{env.NEXT_PUBLIC_SENTRY_DSN ? (<GoogleAnalytics gaId={env.NEXT_PUBLIC_SENTRY_DSN} />) : null}';
      const contract = readGoogleAnalyticsGateContract(buildSource(wrongVar));
      expect(contract.guardCondition).not.toBe(PINNED_GUARD);
    });

    it('reports a non-null fallback instead of null', () => {
      const nonNullFallback =
        '{env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (<GoogleAnalytics gaId={env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />) : <Fallback />}';
      expect(readGoogleAnalyticsGateContract(buildSource(nonNullFallback)).whenFalseIsNull).toBe(
        false
      );
    });

    it('reports a hardcoded, id-shaped literal even when a correct guard is present', () => {
      const hardcodedUnderGuard =
        '{env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (<GoogleAnalytics gaId="G-XYZ" />) : null}';
      const contract = readGoogleAnalyticsGateContract(buildSource(hardcodedUnderGuard));
      expect(contract.hasHardcodedGaIdLiteral).toBe(true);
      expect(contract.gaIdExpression).not.toBe(contract.guardCondition);
    });
  });

  describe('fail-closed — the contract cannot be read statically', () => {
    it('throws when GoogleAnalytics renders unconditionally (no ternary at all)', () => {
      // This is exactly the mutation the gate exists to catch: deleting the ternary
      // guard while leaving the component call (even a correctly bound one) in place.
      const unconditional = '<GoogleAnalytics gaId="G-XYZ" />';
      expect(() => readGoogleAnalyticsGateContract(buildSource(unconditional))).toThrow(
        /is not gated by a conditional/
      );
    });

    it('throws when no GoogleAnalytics usage exists anywhere in the file', () => {
      expect(() => readGoogleAnalyticsGateContract(buildSource('<Layout />'))).toThrow(
        /expected exactly one <GoogleAnalytics…> usage, found 0/
      );
    });

    it('throws when GoogleAnalytics is used more than once in the file', () => {
      const twice = `${REAL_SHAPE}\n<GoogleAnalytics gaId="G-XYZ" />`;
      expect(() => readGoogleAnalyticsGateContract(buildSource(twice))).toThrow(
        /expected exactly one <GoogleAnalytics…> usage, found 2/
      );
    });

    it('throws when the @next/third-parties/google import is absent', () => {
      expect(() => readGoogleAnalyticsGateContract('const x = 1;')).toThrow(
        /@next\/third-parties\/google/
      );
    });

    it('throws when GoogleAnalytics is imported under an alias', () => {
      const aliased = [
        `import { GoogleAnalytics as GA } from '${GA_MODULE}';`,
        'function Component() {',
        '  return (<main>{env.X ? (<GA gaId={env.X} />) : null}</main>);',
        '}',
      ].join('\n');
      expect(() => readGoogleAnalyticsGateContract(aliased)).toThrow(/must not be aliased/);
    });

    it('throws when the gaId attribute is missing entirely (boundary)', () => {
      const noGaId = '{env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (<GoogleAnalytics />) : null}';
      expect(() => readGoogleAnalyticsGateContract(buildSource(noGaId))).toThrow(
        /has no gaId attribute/
      );
    });
  });
});
