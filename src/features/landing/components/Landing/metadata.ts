import { Metadata } from 'next';

import logoUrl from '../../assets/svg/logo/Logo.svg';

const websiteUrl: string | undefined = process.env.NEXT_PUBLIC_WEBSITE_URL;
const metadataBase: URL | undefined = websiteUrl ? new URL(websiteUrl) : undefined;

export default function constructMetadata({
  title = 'VilnaCRM',
  description = 'VilnaCRM is the first Ukrainian open source CRM.',
  image = logoUrl.src,
}: {
  title?: string;
  description?: string;
  image?: string;
} = {}): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image }],
    },
    metadataBase,
  };
}
