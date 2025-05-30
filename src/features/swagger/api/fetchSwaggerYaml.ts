export const fetchSwaggerYaml: (url: string) => Promise<string> = async url => {
  const response: Response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }

  return response.text();
};
