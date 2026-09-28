import withSeo from '@/components/seo/with-seo';
import { LANDING_ALTERNATES } from '@/config/locales';
import { LandingComponent } from '@/features/landing';

export default withSeo(
  {
    titleKey: 'seo.landing.title',
    descriptionKey: 'seo.landing.description',
    path: '/',
    siteSchema: true,
    alternates: LANDING_ALTERNATES,
  },
  LandingComponent
);
