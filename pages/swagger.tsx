import withSeo from '@/components/seo/with-seo';
import { SwaggerPage } from '@/features/swagger';

export default withSeo(
  {
    titleKey: 'seo.swagger.title',
    descriptionKey: 'seo.swagger.description',
    path: '/swagger',
  },
  SwaggerPage
);
