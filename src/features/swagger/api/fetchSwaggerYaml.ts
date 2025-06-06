const fetchSwaggerYaml: (url: string) => Promise<string> = async url => {
  try {
    const response: Response = await fetch(url, { headers: {} });
    if (!response.ok) {
      throw new Error(`Failed to fetch Swagger YAML: ${response.status} ${response.statusText}`);
    }
    const content: string = await response.text();

    if (!content.trim()) {
      throw new Error('Received empty response from Swagger YAML endpoint');
    }
    return content;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error fetching Swagger YAML: ${error.message}`);
    }
    throw new Error('Unknown error occurred while fetching Swagger YAML');
  }
};

export default fetchSwaggerYaml;
