import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl: string | undefined = process.env.NEXT_PUBLIC_WEBSITE_URL;

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api',
        '/cgi-bin/',
        '/tmp/',
        '/junk/',
        '/private/',
        '/hidden/',
        '/admin/',
        '/login/',
        '/register/',
        '/user-data/',
        '/config/',
        '/*.pdf$',
        '/*.zip$',
        '/*.exe$',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
