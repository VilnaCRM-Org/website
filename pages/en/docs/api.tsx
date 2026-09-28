import withSeo from '@/components/seo/with-seo';
import { ApiDocs } from '@/features/documentation';

export default withSeo(
  {
    titleKey: 'seo.api_docs.title',
    descriptionKey: 'seo.api_docs.description',
    path: '/en/docs/api',
    noindex: true,
  },
  ApiDocs
);
