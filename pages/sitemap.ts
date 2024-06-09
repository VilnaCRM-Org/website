import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.NEXT_PUBLIC_WEBSITE_URL === undefined) {
    throw new Error('baseUrl is not defined');
  }

  const baseUrl: string | undefined = process.env.NEXT_PUBLIC_WEBSITE_URL;

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
  ];
}
