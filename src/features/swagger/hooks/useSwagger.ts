import YAML from 'js-yaml';
import { useEffect, useState } from 'react';

type UseSwaggerReturn = {
  yamlContent: object | null;
  error: Error | null;
};

const useSwagger: () => UseSwaggerReturn = () => {
  const [yamlContent, setYamlContent] = useState<object | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadSwaggerSchema: () => Promise<void> = async () => {
      try {
        const res: Response = await fetch('/swagger-schema.yaml');
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status}`);
        }

        const yamlText: string = await res.text();
        const parsed: unknown = YAML.load(yamlText);
        setYamlContent(parsed as object);
      } catch (err) {
        setError(err as Error);
      }
    };

    loadSwaggerSchema();
  }, []);

  return { yamlContent, error };
};

export default useSwagger;
