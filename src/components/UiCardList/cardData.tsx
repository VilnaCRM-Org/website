import WhyUsCodeIcon  from '../../features/landing/assets/svg/why-us/code.svg';
import WhyUsIntegrationsIcon from '../../features/landing/assets/svg/why-us/integrations.svg';
import WhyUsMigrationIcon from '../../features/landing/assets/svg/why-us/migration.svg';
import WhyUsServicesIcon from '../../features/landing/assets/svg/why-us/services.svg';
import WhyUsSettingsIcon from '../../features/landing/assets/svg/why-us/settings.svg';
import WhyUsTemplatesIcon from '../../features/landing/assets/svg/why-us/templates.svg';
import { Card } from '../../features/landing/types/Card/card-item';

const getWhyUsCards: () => Card[] = () => [
  {
    type: 'largeCard',
    id: 'card-item-1',
    imageSrc: WhyUsCodeIcon,
    image: WhyUsCodeIcon, 
    title: 'why_us.headers.header_open_source',
    text: 'why_us.texts.text_open_source',
    alt: 'why_us.alt_image.alt_open_source',
  },
  {
    type: 'largeCard',
    id: 'card-item-2',
    image: WhyUsSettingsIcon,
    imageSrc: WhyUsSettingsIcon,
    title: 'why_us.headers.header_ease_of_setup',
    text: 'why_us.texts.text_configure_system',
    alt: 'why_us.alt_image.alt_ease_of_setup',
  },
  {
    type: 'largeCard',
    id: 'card-item-3',
    image: WhyUsTemplatesIcon,
    imageSrc: WhyUsTemplatesIcon,
    title: 'why_us.headers.header_ready_templates',
    text: 'why_us.texts.text_you_have_store',
    alt: 'why_us.alt_image.alt_ready_templates',
  },
  {
    type: 'largeCard',
    id: 'card-item-4',
    image: WhyUsServicesIcon,
    imageSrc: WhyUsServicesIcon,
    title: 'why_us.headers.header_ideal_for_services',
    text: 'why_us.texts.text_we_know_specific_needs',
    alt: 'why_us.alt_image.alt_ideal_for_services',
  },
  {
    type: 'largeCard',
    id: 'card-item-5',
    image: WhyUsIntegrationsIcon,
    imageSrc: WhyUsIntegrationsIcon,
    title: 'why_us.headers.header_all_required_integrations',
    text: 'why_us.texts.text_connect_your_cms',
    alt: 'why_us.alt_image.alt_all_required_integrations',
  },
  {
    type: 'largeCard',
    id: 'card-item-6',
    image: WhyUsMigrationIcon,
    imageSrc: WhyUsMigrationIcon,
    title: 'why_us.headers.header_bonus',
    text: 'why_us.texts.text_switch_to_vilna',
    alt: 'why_us.alt_image.alt_bonus',
  },
];

export default getWhyUsCards;