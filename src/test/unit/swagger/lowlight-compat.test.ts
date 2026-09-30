import highlightJsPackage from 'highlight.js/package.json';
import type { LanguageFn } from 'lowlight';

import lowlightCompat, {
  highlight,
  highlightAuto,
  listLanguages,
  registerLanguage,
} from '../../../features/swagger/helpers/lowlight-compat';
import type { HighlightNodes } from '../../../features/swagger/helpers/lowlight-compat';

type Token = readonly [classes: string, text: string];

const numbers: LanguageFn = () => ({
  name: 'numbers',
  contains: [{ scope: 'number', begin: /\d+/, relevance: 5 }],
});

const scoped: LanguageFn = () => ({
  name: 'scoped',
  contains: [{ scope: 'title.class', begin: /[A-Z]\w*/, relevance: 1 }],
});

function tokensOf(nodes: HighlightNodes, inherited: readonly string[] = []): Token[] {
  return nodes.flatMap((node): Token[] => {
    if (node.type === 'text') {
      return [[inherited.join(' '), node.value]];
    }
    if (node.type !== 'element') {
      return [];
    }
    const own = (node.properties.className as string[] | undefined) ?? [];
    return tokensOf(node.children, [...inherited, ...own]);
  });
}

function textOf(nodes: HighlightNodes): string {
  return tokensOf(nodes)
    .map(([, text]) => text)
    .join('');
}

describe('lowlightCompat — the lowlight 1 API react-syntax-highlighter/light calls (#379)', () => {
  beforeAll(() => {
    registerLanguage('numbers', numbers);
    registerLanguage('scoped', scoped);
  });

  it('runs on the supported highlight.js 11 line, not the end-of-life 10.x', () => {
    expect(highlightJsPackage.version).toMatch(/^11\./);
  });

  it('lists every registered grammar by the name it was registered under', () => {
    expect(listLanguages()).toEqual(expect.arrayContaining(['numbers', 'scoped']));
    expect(listLanguages()).not.toContain('json');
  });

  it('returns hast children, the language and a positive relevance for a known grammar', () => {
    const result = highlight('numbers', 'port 8080 open');

    expect(result.language).toBe('numbers');
    expect(result.relevance).toBeGreaterThan(0);
    expect(tokensOf(result.value)).toEqual([
      ['', 'port '],
      ['hljs-number', '8080'],
      ['', ' open'],
    ]);
  });

  it('keeps highlight.js 11 sub-scopes as suffixed classes after the prefixed scope', () => {
    expect(tokensOf(highlight('scoped', 'new User').value)).toEqual([
      ['', 'new '],
      ['hljs-title class_', 'User'],
    ]);
  });

  it('refuses a grammar that was never registered, as lowlight 1 did', () => {
    expect(() => highlight('cobol', 'MOVE 1 TO X')).toThrow(/Unknown language/);
  });

  it('auto-detects the registered grammar that scores highest', () => {
    const result = highlightAuto('123 456');

    expect(result.language).toBe('numbers');
    expect(result.relevance).toBeGreaterThan(0);
    expect(textOf(result.value)).toBe('123 456');
  });

  it('reports a null language and no nodes when no grammar recognises the code', () => {
    expect(highlightAuto('')).toEqual({ value: [], language: null, relevance: 0 });
  });

  it('exposes the same functions on the default export react-syntax-highlighter imports', () => {
    expect(lowlightCompat).toEqual({ highlight, highlightAuto, listLanguages, registerLanguage });
  });

  it('works when registerLanguage is detached from the module, as the light build does', () => {
    const { registerLanguage: detached } = lowlightCompat;

    detached('detached', numbers);

    expect(listLanguages()).toContain('detached');
    expect(highlight('detached', '7').value).toHaveLength(1);
  });
});
