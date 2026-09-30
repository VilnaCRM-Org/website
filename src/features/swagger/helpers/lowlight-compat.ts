import { createLowlight } from 'lowlight';
import type { LanguageFn } from 'lowlight';

type Lowlight = ReturnType<typeof createLowlight>;
type HighlightTree = ReturnType<Lowlight['highlight']>;

export type HighlightNodes = HighlightTree['children'];

export interface HighlightResult {
  readonly value: HighlightNodes;
  readonly language: string | null;
  readonly relevance: number;
}

const engine: Lowlight = createLowlight();

function toResult(tree: HighlightTree): HighlightResult {
  const { language, relevance } = { ...tree.data };

  return { value: tree.children, language: language ?? null, relevance: Number(relevance) };
}

export function registerLanguage(name: string, grammar: LanguageFn): void {
  engine.register(name, grammar);
}

export function listLanguages(): string[] {
  return engine.listLanguages();
}

export function highlight(language: string, code: string): HighlightResult {
  return toResult(engine.highlight(language, code));
}

export function highlightAuto(code: string): HighlightResult {
  return toResult(engine.highlightAuto(code));
}

const lowlightCompat = { highlight, highlightAuto, listLanguages, registerLanguage };

export default lowlightCompat;
