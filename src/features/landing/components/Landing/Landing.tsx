import { Box, Container } from '@mui/material';
import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';

import iphoneTouchUrl from '../../assets/img/about-vilna/touch.png';
import logoUrl from '../../assets/svg/logo/Logo.svg';

import constructMetadata from './metadata';

const DynamicBackgroundImages: React.ComponentType = dynamic(
  () => import('../BackgroundImages/BackgroundImages')
);
const DynamicAboutUs: React.ComponentType = dynamic(() => import('../AboutUs'));
const DynamicUiFooter: React.ComponentType = dynamic(
  () => import('../../../../components/UiFooter')
);
const DynamicForWhoSection: React.ComponentType = dynamic(() => import('../ForWhoSection'));
const DynamicHeader: React.ComponentType = dynamic(() => import('../Header'));
const DynamicPossibilities: React.ComponentType = dynamic(() => import('../Possibilities'));
const DynamicWhyUs: React.ComponentType = dynamic(() => import('../WhyUs'));
const DynamicAuthSection: React.ComponentType = dynamic(() => import('../AuthSection'));

const metadata: Metadata = constructMetadata();

function Landing(): React.ReactElement {
  return (
    <>
      <Head>
        <title>{(metadata.title || '').toString()}</title>
        <meta property="og:title" content={(metadata.openGraph?.title || '').toString()} />
        <meta name="description" content={metadata.description || ''} />
        <meta property="og:description" content={metadata.openGraph?.description || ''} />
        <meta property="image" content={logoUrl.src} />
        <meta property="og:image" content={logoUrl.src} />
        <link rel="icon" href={logoUrl.src} />
        <link rel="apple-touch-icon" href={iphoneTouchUrl.src} />
      </Head>
      <DynamicHeader />
      <Box sx={{ position: 'relative' }}>
        <DynamicBackgroundImages />
        <DynamicAboutUs />
        <Container maxWidth="xl">
          <DynamicWhyUs />
        </Container>
        <DynamicForWhoSection />
        <Container maxWidth="xl">
          <DynamicPossibilities />
        </Container>
      </Box>
      <DynamicAuthSection />
      <DynamicUiFooter />
    </>
  );
}

export default Landing;
