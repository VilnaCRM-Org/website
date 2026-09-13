import React, { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './styles';
import { ServersContainerProps, ServersLabelPlugin } from './types';

const SERVERS_SELECT_ID = 'servers';

export function withServersLabel(
  Original: ComponentType<ServersContainerProps>
): ComponentType<ServersContainerProps> {
  function LabelledServersContainer(props: ServersContainerProps): React.ReactElement | null {
    const { specSelectors } = props;
    const { t } = useTranslation();
    const hasServers: boolean = (specSelectors.servers()?.size ?? 0) > 0;

    if (!hasServers) {
      return null;
    }

    return (
      <>
        <label htmlFor={SERVERS_SELECT_ID} style={styles.visuallyHidden}>
          {t('api_documentation.servers_label')}
        </label>
        <Original {...props} />
      </>
    );
  }

  return LabelledServersContainer;
}

export const serversLabelPlugin: ServersLabelPlugin = {
  wrapComponents: {
    ServersContainer: withServersLabel,
  },
};

export const swaggerPlugins: ServersLabelPlugin[] = [serversLabelPlugin];
