export interface ResponseContent {
  readonly size: number;
}

export interface ResponseDefinition {
  get: (key: 'content') => ResponseContent | null | undefined;
}

export type ResponseEntry = readonly [string, ResponseDefinition];
