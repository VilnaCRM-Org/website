import type { ComponentType } from 'react';

import type { ResponseDefinition, ResponseEntry } from '../../../types/responses';

export interface ResponsesCollection {
  entrySeq: () => { toArray: () => ResponseEntry[] };
}

export interface TryItOutResponse {
  get: (key: 'status') => unknown;
}

export interface SpecPath {
  push: (key: string) => SpecPath;
}

export interface SpecSelectors {
  isOAS3: () => boolean;
}

export interface ContentTypeChange {
  controlsAcceptHeader: boolean;
  value: string;
}

export interface Oas3Actions {
  setResponseContentType: (change: { value: string; path: string; method: string }) => void;
}

export interface Oas3Selectors {
  activeExamplesMember: (path: string, method: string, type: 'responses', code: string) => unknown;
}

export interface OperationContext {
  getComponent: GetComponent;
  getConfigs: () => unknown;
  specSelectors: SpecSelectors;
  path: string;
  method: string;
}

export interface LiveResponseProps extends OperationContext {
  response: TryItOutResponse;
  displayRequestDuration: boolean;
}

export interface ResponseRowProps extends OperationContext {
  code: string;
  response: ResponseDefinition;
  className: string;
  isDefault: boolean;
  specPath: SpecPath;
  fn: unknown;
  controlsAcceptHeader: boolean;
  onContentTypeChange: (change: ContentTypeChange) => void;
  contentType: unknown;
  activeExamplesKey: unknown;
  oas3Actions: Oas3Actions;
}

export interface ResponsesComponents {
  liveResponse: ComponentType<LiveResponseProps>;
  response: ComponentType<ResponseRowProps>;
}

export type GetComponent = <K extends keyof ResponsesComponents>(name: K) => ResponsesComponents[K];

export interface ResponsesProps extends OperationContext {
  responses: ResponsesCollection;
  tryItOutResponse?: TryItOutResponse | null | undefined;
  producesValue?: unknown;
  displayRequestDuration?: boolean | undefined;
  specPath: SpecPath;
  fn: unknown;
  oas3Selectors: Oas3Selectors;
  oas3Actions: Oas3Actions;
}

export interface OwnedResponsesProps extends ResponsesProps {
  components: ResponsesComponents;
}

export interface SwaggerSystem {
  fn: {
    withErrorBoundary: <P extends object>(component: ComponentType<P>) => ComponentType<P>;
  };
  getComponent: GetComponent;
}

export type ResponsesWrapper = (
  Original: ComponentType<ResponsesProps>,
  system: SwaggerSystem
) => ComponentType<ResponsesProps>;

export interface ResponsesTablePlugin {
  wrapComponents: {
    responses: ResponsesWrapper;
  };
}

export interface LiveResponseSectionProps {
  context: OperationContext;
  LiveResponse: ResponsesComponents['liveResponse'];
  response: TryItOutResponse | null | undefined;
  displayRequestDuration: boolean;
}

export interface ResponsesTableProps {
  context: OwnedResponsesProps;
  entries: readonly ResponseEntry[];
  rows: readonly ResponseEntry[];
}

export type SharedRowProps = Omit<
  ResponseRowProps,
  | 'code'
  | 'response'
  | 'className'
  | 'isDefault'
  | 'specPath'
  | 'controlsAcceptHeader'
  | 'activeExamplesKey'
>;

export interface RowState {
  shared: SharedRowProps;
  defaultCode: string | undefined;
  controlling: ResponseDefinition | null;
  status: string | undefined;
}

export interface ResponseRowItemProps {
  context: OwnedResponsesProps;
  entry: ResponseEntry;
  row: RowState;
}
