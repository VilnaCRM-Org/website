import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

const DynamicLandingSections: ComponentType = dynamic(() => import('../landing-sections'), {
  ssr: false,
});
const DynamicAuthSection: ComponentType = dynamic(() => import('../auth-section'), { ssr: false });

function Landing(): React.ReactElement {
  return (
    <>
      <DynamicLandingSections />
      <DynamicAuthSection />
    </>
  );
}

export default Landing;
