import { useEffect, useState } from 'react';

import fetchSwaggerYaml from '../api/fetchSwaggerYaml';

type UseSwaggerReturn = {
  yamlContent: string | null;
};

export const useSwagger: (url: string) => UseSwaggerReturn = url => {
  const [yamlContent, setYamlContent] = useState<string | null>(null);

  useEffect(() => {
    const fetchData: () => Promise<void> = async () => {
      const yaml: string = await fetchSwaggerYaml(url);
      setYamlContent(yaml);
    };

    fetchData();
  }, [url]);

  return { yamlContent };
};
