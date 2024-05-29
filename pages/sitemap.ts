import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl: string | undefined = process.env.NEXT_PUBLIC_WEBSITE_URL;

  if (baseUrl === undefined) {
    throw new Error('baseUrl is not defined');
  }

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
  ];
}
