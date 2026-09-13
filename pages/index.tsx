import withSeo from '@/components/seo/with-seo';
import { LandingComponent } from '@/features/landing';

export default withSeo(
  {
    titleKey: 'seo.landing.title',
    descriptionKey: 'seo.landing.description',
    path: '/',
    siteSchema: true,
  },
  LandingComponent
);
