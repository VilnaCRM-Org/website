import { useEffect, useState } from 'react';

type UseSwaggerReturn = {
  swaggerContent: unknown | null;
  error: Error | null;
};

const DEFAULT_SWAGGER_SCHEMA_URL = '/swagger-schema.json';

const isAbortError: (err: unknown) => boolean = (err: unknown): boolean =>
  (err as DOMException | null)?.name === 'AbortError';

const fetchSwaggerSchema: (url: string, signal: AbortSignal) => Promise<unknown> = async (
  url: string,
  signal: AbortSignal
): Promise<unknown> => {
  const res: Response = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch swagger schema – ${res.status} ${res.statusText}`);
  }
  return res.json();
};

const loadSwaggerSchema: (
  url: string,
  onContent: (data: unknown) => void,
  onError: (err: Error) => void
) => () => void = (url, onContent, onError) => {
  const controller: AbortController = new AbortController();
  fetchSwaggerSchema(url, controller.signal)
    .then(onContent)
    .catch((err: unknown) => {
      if (!isAbortError(err)) onError(err as Error);
    });
  return () => controller.abort();
};

const useSwagger: (schemaUrl?: string) => UseSwaggerReturn = (
  schemaUrl: string = DEFAULT_SWAGGER_SCHEMA_URL
) => {
  const [swaggerContent, setSwaggerContent] = useState<unknown | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(
    () => loadSwaggerSchema(schemaUrl, setSwaggerContent, setError),
    [schemaUrl]
  );

  return { swaggerContent, error };
};

export default useSwagger;
