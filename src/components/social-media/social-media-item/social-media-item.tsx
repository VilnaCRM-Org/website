import { Box, Link } from '@mui/material';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BLANK_TARGET, resolveExternalLinkRel } from '@/shared/externalLinkRel';
import { SocialMedia } from '@/types/social-media';

import styles from './styles';

// `item.linkHref` is a free-form string, so this is the external-link sink most
// likely to become dynamic; it opens a new tab and therefore always carries the
// full `noopener noreferrer` hardening (#382 F2).
//
// The icon is decorative: the link already owns the accessible name through
// `aria-label`, so a second, differently-worded name on the image would leave
// assistive tech announcing two names for one control. Mirrors the existing
// treatment in `auth-section/social-item`.
function SocialMediaItem({ item }: { item: SocialMedia }): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Box sx={styles.navLink}>
      <Link
        href={item.linkHref}
        aria-label={t(item.ariaLabel)}
        target={BLANK_TARGET}
        rel={resolveExternalLinkRel(BLANK_TARGET)}
      >
        {item.type === 'drawer' ? (
          <Image src={item.icon} alt="" aria-hidden="true" width={24} height={24} />
        ) : (
          <Image src={item.icon} alt="" aria-hidden="true" width={20} height={20} />
        )}
      </Link>
    </Box>
  );
}

export default SocialMediaItem;
