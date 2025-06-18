import { useEffect, useState } from 'react';

type UseSwaggerReturn = {
  swaggerContent: object | null;
  error: Error | null;
};

const useSwagger: () => UseSwaggerReturn = () => {
  const [swaggerContent, setSwaggerContent] = useState<object | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadSwaggerSchema: () => Promise<void> = async () => {
      try {
        const res: Response = await fetch('/swagger-schema.json');
        if (!res.ok) {
          throw new Error(`Failed to fetch swagger schema – ${res.status} ${res.statusText}`);
        }

        const jsonContent: object = await res.json();
        setSwaggerContent(jsonContent);
      } catch (err) {
        setError(err as Error);
      }
    };

    loadSwaggerSchema();
  }, []);

  return { swaggerContent, error };
};

export default useSwagger;
