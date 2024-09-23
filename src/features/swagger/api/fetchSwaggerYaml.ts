type GithubFileResponse = {
  content: string;
  encoding: string;
};

export const fetchSwaggerYaml: (url: string) => Promise<string> = async url => {
  const response: Response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }

  const data: GithubFileResponse = await response.json();

  return Buffer.from(data.content, 'base64').toString('utf-8');
};
