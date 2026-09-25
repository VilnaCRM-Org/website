import React, { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { CloseIconProps } from './types';

export function withCloseLabel(
  Original: ComponentType<CloseIconProps>
): ComponentType<CloseIconProps> {
  function LabelledCloseIcon(props: CloseIconProps): React.ReactElement {
    const { t } = useTranslation();

    return (
      <Original
        {...props}
        role="img"
        aria-hidden={undefined}
        aria-label={t('api_documentation.authorize_dialog.close')}
      />
    );
  }

  return LabelledCloseIcon;
}
