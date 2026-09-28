export interface SpecJson {
  getIn: (path: readonly string[]) => unknown;
}

export interface RefFreeSubtree {
  readonly value: unknown;
}
