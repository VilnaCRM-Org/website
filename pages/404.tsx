import withSeo from '@/components/seo/with-seo';
import { NotFound } from '@/features/not-found';

export default withSeo(
  {
    titleKey: 'not_found.title',
    descriptionKey: 'not_found.description',
    path: '/404',
    noindex: true,
  },
  NotFound
);
