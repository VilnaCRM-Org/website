import type { RefFreeSubtree, SpecJson } from '../types/spec-load';

const SECURITY_SCHEMES_PATH: readonly string[] = ['components', 'securitySchemes'];

export function isDuplicateSpec(next: unknown, current: unknown): boolean {
  return typeof next === 'string' && next === current;
}

function isSecuritySchemesPath(path: unknown): boolean {
  return (
    Array.isArray(path) &&
    path.length === SECURITY_SCHEMES_PATH.length &&
    SECURITY_SCHEMES_PATH.every((key: string, index: number) => path[index] === key)
  );
}

function needsResolution(subtree: unknown): boolean {
  const serialized: string = JSON.stringify(subtree ?? null);

  return serialized.includes('"$ref"') || serialized.includes('"openIdConnect"');
}

export function refFreeSecuritySchemes(path: unknown, specJson: SpecJson): RefFreeSubtree | null {
  if (!isSecuritySchemesPath(path)) return null;

  const value: unknown = specJson.getIn(SECURITY_SCHEMES_PATH);

  return needsResolution(value) ? null : { value };
}
