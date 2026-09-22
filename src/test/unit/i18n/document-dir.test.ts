/**
 * Gate the static `dir` attribute on `<Html>` in `pages/_document.tsx` (issue #322).
 *
 * Both locales this site ships, `uk` and `en`, are left-to-right, so `dir` is pinned
 * to the literal `"ltr"` rather than derived per route — see ADR 0006's Consequences
 * section. `lang` stays derived from `resolveRouteLocale(__NEXT_DATA__.page)`, exactly
 * as before; this spec adds the `dir` half of the contract and re-asserts `lang` so a
 * future edit cannot drop one while touching the other.
 *
 * Read from source by parsing it with the TypeScript compiler, the same technique
 * `sentry-replay-masking.test.ts` and `client-env-contract.test.ts` use, rather than by
 * importing `pages/_document.tsx`: `next/document`'s `Html`/`Head` components assume
 * Next's own document-render pass and are not meant to be mounted directly in jsdom.
 */
import fs from 'node:fs';
import path from 'node:path';

import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DOCUMENT_PATH = path.join(REPO_ROOT, 'pages', '_document.tsx');

const HTML_ELEMENT_NAME = 'Html';
const DIR_ATTRIBUTE = 'dir';
const LANG_ATTRIBUTE = 'lang';

interface HtmlAttributesContract {
  dir: string | undefined;
  langExpression: string | undefined;
}

/** The opening/self-closing `<Html …>` tag in the file; anything else throws. */
function htmlOpeningElementOf(
  sourceFile: ts.SourceFile
): ts.JsxOpeningElement | ts.JsxSelfClosingElement {
  let found: ts.JsxOpeningElement | ts.JsxSelfClosingElement | undefined;
  const visit = (node: ts.Node): void => {
    const isHtmlOpening =
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      node.tagName.text === HTML_ELEMENT_NAME;
    if (isHtmlOpening) {
      found = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (found === undefined) {
    throw new Error(`no <${HTML_ELEMENT_NAME}> element found`);
  }
  return found;
}

/**
 * A named JSX attribute on `element`, read only when no spread attribute is present
 * anywhere on the same element — a spread could inject or override any attribute, so
 * its presence makes every named attribute statically unknown and the read throws.
 */
function namedAttributeOf(
  element: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  attributeName: string
): ts.JsxAttribute | undefined {
  const hasSpread = element.attributes.properties.some(ts.isJsxSpreadAttribute);
  if (hasSpread) {
    throw new Error(
      `<${HTML_ELEMENT_NAME}> carries a spread attribute, ${attributeName} is not statically known`
    );
  }
  const attribute = element.attributes.properties.find(
    (prop): prop is ts.JsxAttribute =>
      ts.isJsxAttribute(prop) && prop.name.getText() === attributeName
  );
  return attribute;
}

/** The literal string value of a `dir="…"` / `dir={'…'}` attribute; anything else throws. */
function dirLiteralOf(
  element: ts.JsxOpeningElement | ts.JsxSelfClosingElement
): string | undefined {
  const attribute = namedAttributeOf(element, DIR_ATTRIBUTE);
  if (attribute === undefined) return undefined;
  const { initializer } = attribute;
  if (initializer === undefined) {
    throw new Error(`${DIR_ATTRIBUTE} has no statically readable value`);
  }
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (
    ts.isJsxExpression(initializer) &&
    initializer.expression !== undefined &&
    ts.isStringLiteralLike(initializer.expression)
  ) {
    return initializer.expression.text;
  }
  throw new Error(`${DIR_ATTRIBUTE} is not a plain string literal`);
}

/** The source text of a `lang={…}` attribute's expression; undefined when absent. */
function langExpressionTextOf(
  element: ts.JsxOpeningElement | ts.JsxSelfClosingElement
): string | undefined {
  const attribute = namedAttributeOf(element, LANG_ATTRIBUTE);
  if (attribute === undefined) return undefined;
  const { initializer } = attribute;
  if (initializer !== undefined && ts.isJsxExpression(initializer) && initializer.expression) {
    return initializer.expression.getText();
  }
  throw new Error(`${LANG_ATTRIBUTE} has no statically readable expression`);
}

function readHtmlAttributesContract(source: string): HtmlAttributesContract {
  const sourceFile = ts.createSourceFile(
    '_document.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const html = htmlOpeningElementOf(sourceFile);
  return {
    dir: dirLiteralOf(html),
    langExpression: langExpressionTextOf(html),
  };
}

const readFile = (filePath: string): string => fs.readFileSync(filePath, 'utf-8');

describe('static document direction (issue #322)', () => {
  it('pins <Html dir> to the literal "ltr" in pages/_document.tsx', () => {
    expect(readHtmlAttributesContract(readFile(DOCUMENT_PATH)).dir).toBe('ltr');
  });

  it('keeps <Html lang> derived from resolveRouteLocale, not a literal', () => {
    const { langExpression } = readHtmlAttributesContract(readFile(DOCUMENT_PATH));
    expect(langExpression).toContain('resolveRouteLocale');
  });
});

describe('static document direction — helpers', () => {
  const buildSource = (attributes: string): string =>
    [
      "import { Html, Head, Main, NextScript } from 'next/document';",
      'export default function Document() {',
      `  return <Html ${attributes}><Head /><body><Main /><NextScript /></body></Html>;`,
      '}',
    ].join('\n');

  describe('positive', () => {
    it('reads a literal dir="ltr" alongside a lang expression (positive)', () => {
      const source = buildSource('lang={resolveRouteLocale(page)} dir="ltr"');
      expect(readHtmlAttributesContract(source)).toEqual({
        dir: 'ltr',
        langExpression: 'resolveRouteLocale(page)',
      });
    });

    it('reads a dir wrapped in a JSX expression container', () => {
      const source = buildSource(`lang={locale} dir={'ltr'}`);
      expect(readHtmlAttributesContract(source).dir).toBe('ltr');
    });

    it('reads attributes regardless of order', () => {
      const source = buildSource('dir="ltr" lang={locale}');
      expect(readHtmlAttributesContract(source)).toEqual({ dir: 'ltr', langExpression: 'locale' });
    });
  });

  describe('negative — the contract is present but wrong', () => {
    it('reports a non-"ltr" dir value (negative)', () => {
      const source = buildSource('lang={locale} dir="rtl"');
      expect(readHtmlAttributesContract(source).dir).toBe('rtl');
    });

    it('reports dir as undefined when the attribute is missing (boundary)', () => {
      const source = buildSource('lang={locale}');
      expect(readHtmlAttributesContract(source).dir).toBeUndefined();
    });
  });

  describe('fail-closed — the contract cannot be read statically', () => {
    it('throws when there is no <Html> element at all', () => {
      const source = [
        "import { Head, Main, NextScript } from 'next/document';",
        'export default function Document() {',
        '  return <div><Head /><Main /><NextScript /></div>;',
        '}',
      ].join('\n');
      expect(() => readHtmlAttributesContract(source)).toThrow(/no <Html> element found/);
    });

    it('throws on a computed dir expression, which is not statically known', () => {
      const source = buildSource('lang={locale} dir={direction}');
      expect(() => readHtmlAttributesContract(source)).toThrow(/dir is not a plain string literal/);
    });

    it('throws when a spread attribute could be hiding dir or lang', () => {
      const source = buildSource('lang={locale} dir="ltr" {...rest}');
      expect(() => readHtmlAttributesContract(source)).toThrow(/spread attribute/);
    });
  });
});
