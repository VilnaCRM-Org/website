import { useEffect, useState } from 'react';

type UseSwaggerReturn = {
  swaggerContent: unknown | null;
  error: Error | null;
};

const DEFAULT_SWAGGER_SCHEMA_URL = '/swagger-schema.json';

const useSwagger: (schemaUrl?: string) => UseSwaggerReturn = (
  schemaUrl: string = DEFAULT_SWAGGER_SCHEMA_URL
) => {
  const [swaggerContent, setSwaggerContent] = useState<unknown | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller: AbortController = new AbortController();
    const loadSwaggerSchema: () => Promise<void> = async (): Promise<void> => {
      try {
        const res: Response = await fetch(schemaUrl, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Failed to fetch swagger schema – ${res.status} ${res.statusText}`);
        }
        const data: unknown = await res.json();
        setSwaggerContent(data);
      } catch (err: unknown) {
        if ((err as DOMException).name === 'AbortError') return;
        setError(err as Error);
      }
    };
    loadSwaggerSchema();
    return () => {
      controller.abort();
    };
  }, [schemaUrl]);

  return { swaggerContent, error };
};

export default useSwagger;
