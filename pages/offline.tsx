import withSeo from '@/components/seo/with-seo';
import { OfflineShell } from '@/features/offline';

export default withSeo(
  {
    titleKey: 'offline.heading',
    descriptionKey: 'offline.description',
    path: '/offline',
    noindex: true,
  },
  OfflineShell
);
