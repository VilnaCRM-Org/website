/**
 * Integration coverage for the /swagger highlighter shim (#379).
 *
 * `next.config.js` aliases `lowlight/lib/core` — the module
 * react-syntax-highlighter's light build wraps — to
 * `src/features/swagger/helpers/lowlight-compat.ts`, so the engine behind every
 * highlighted example on /swagger is lowlight 3 over highlight.js 11. This spec
 * registers the seven grammars swagger-ui's `after_load` registers, under the
 * same eight names (`js` and `javascript` share one grammar), straight
 * from `highlight.js/lib/languages/*` (what react-syntax-highlighter's
 * `languages/hljs/*` re-export), and highlights the kind of content the page
 * renders: response bodies, request snippets and the spec itself.
 */
import bash from 'highlight.js/lib/languages/bash';
import http from 'highlight.js/lib/languages/http';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import powershell from 'highlight.js/lib/languages/powershell';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

import lowlightCompat, {
  highlight,
  highlightAuto,
  listLanguages,
  registerLanguage,
} from '../../../../src/features/swagger/helpers/lowlight-compat';
import type { HighlightNodes } from '../../../../src/features/swagger/helpers/lowlight-compat';

type Token = readonly [classes: readonly string[], text: string];

function tokensOf(nodes: HighlightNodes, inherited: readonly string[] = []): Token[] {
  return nodes.flatMap((node): Token[] => {
    if (node.type === 'text') {
      return [[inherited, node.value]];
    }
    if (node.type !== 'element') {
      return [];
    }
    const own = (node.properties.className as string[] | undefined) ?? [];
    return tokensOf(node.children, [...inherited, ...own]);
  });
}

function classesOf(tokens: readonly Token[], text: string): readonly string[] | undefined {
  return tokens.find(([, value]) => value === text)?.[0];
}

const SWAGGER_GRAMMARS = { json, js: javascript, xml, yaml, http, bash, powershell, javascript };

const SAMPLES = {
  json: '{\n  "email": "user@example.com",\n  "confirmed": false,\n  "count": 42\n}',
  yaml: 'openapi: 3.1.0\ninfo:\n  title: User Service # comment',
  xml: '<user id="1"><email>a@b.c</email></user>',
  bash: "curl -X 'GET' \\\n  'https://localhost/api/users' \\\n  -H 'accept: application/json'",
  powershell: '$headers=@{}\n$headers.Add("accept", "application/json")',
  http: 'GET /api/users HTTP/1.1\nHost: localhost',
} as const;

describe('integration: swagger highlighter shim over highlight.js 11', () => {
  beforeAll(() => {
    Object.entries(SWAGGER_GRAMMARS).forEach(([name, grammar]) => {
      registerLanguage(name, grammar);
    });
  });

  it('hands the light build the same registerLanguage it re-exports as its own', () => {
    expect(lowlightCompat.registerLanguage).toBe(registerLanguage);
  });

  it('registers every grammar swagger-ui registers, under the same names', () => {
    expect([...listLanguages()].sort()).toEqual(Object.keys(SWAGGER_GRAMMARS).sort());
  });

  it.each(Object.entries(SAMPLES))('highlights %s without losing a character', (name, code) => {
    const result = highlight(name, code);

    expect(result.language).toBe(name);
    expect(result.relevance).toBeGreaterThan(0);
    expect(
      tokensOf(result.value)
        .map(([, text]) => text)
        .join('')
    ).toBe(code);
  });

  it('keeps each JSON token on a class agate colours (a literal now also carries hljs-keyword)', () => {
    const tokens = tokensOf(highlight('json', SAMPLES.json).value);

    expect(classesOf(tokens, '"email"')).toEqual(['hljs-attr']);
    expect(classesOf(tokens, '"user@example.com"')).toEqual(['hljs-string']);
    expect(classesOf(tokens, '42')).toEqual(['hljs-number']);
    expect(classesOf(tokens, 'false')).toEqual(['hljs-literal', 'hljs-keyword']);
  });

  it('marks the curl request snippet the way the v10 engine did', () => {
    const tokens = tokensOf(highlight('bash', SAMPLES.bash).value);

    expect(classesOf(tokens, 'curl -X ')).toEqual([]);
    expect(classesOf(tokens, "'https://localhost/api/users'")).toEqual(['hljs-string']);
  });

  it('auto-detects a JSON body served under an unregistered content type', () => {
    const result = highlightAuto('{"plain": "json text", "n": 1}');

    expect(result.language).toBe('json');
    expect(result.relevance).toBeGreaterThan(0);
  });

  it('leaves code no grammar recognises to the plain-text fallback', () => {
    expect(highlightAuto('')).toEqual({ value: [], language: null, relevance: 0 });
  });
});
