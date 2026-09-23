import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

const DynamicLandingSections: ComponentType = dynamic(() => import('../landing-sections'), {
  ssr: false,
});

function Landing(): React.ReactElement {
  return <DynamicLandingSections />;
}

export default Landing;
