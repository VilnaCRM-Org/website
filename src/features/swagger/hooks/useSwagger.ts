import { useEffect, useState } from 'react';

import { fetchSwaggerYaml } from '../api/fetchSwaggerYaml';

type UseSwaggerReturn = {
  yamlContent: string | null;
  loading: boolean;
  error: string | null;
};

export const useSwagger: (url: string) => UseSwaggerReturn = url => {
  const [yamlContent, setYamlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData: () => Promise<void> = async () => {
      try {
        setLoading(true);
        const yaml: string = await fetchSwaggerYaml(url);
        setYamlContent(yaml);
      } catch (exception) {
        if (exception instanceof Error) {
          setError(exception.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url]);

  return { yamlContent, loading, error };
};
