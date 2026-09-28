import ToolkitUiLink from '@vilnacrm/ui-toolkit/ui-link';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BLANK_TARGET, resolveExternalLinkRel } from '@/shared/externalLinkRel';

import type { NewTabLinkProps, SameTabLinkProps, UiLinkProps } from './types';

const NEW_TAB_LABEL_KEY: string = 'accessibility.opens_in_new_tab';

type TargetProps =
  | Pick<NewTabLinkProps, 'target' | 'newTabLabel'>
  | Pick<SameTabLinkProps, 'target' | 'newTabLabel'>;

function opensInNewTab(target: string | undefined): boolean {
  return target?.toLowerCase() === BLANK_TARGET;
}

function targetProps(target: string | undefined, newTabLabel: string): TargetProps {
  if (opensInNewTab(target)) {
    return { target: BLANK_TARGET, newTabLabel };
  }
  return target === undefined ? {} : { target: target as SameTabLinkProps['target'] };
}

function UiLink({ target, rel, newTabLabel, ...linkProps }: UiLinkProps): React.ReactElement {
  const { t } = useTranslation();
  const hardenedRel: string | undefined = resolveExternalLinkRel(target, rel);
  const resolvedLabel: string = newTabLabel ?? (opensInNewTab(target) ? t(NEW_TAB_LABEL_KEY) : '');
  const linkRel: { rel?: string } = hardenedRel === undefined ? {} : { rel: hardenedRel };

  return <ToolkitUiLink {...linkProps} {...linkRel} {...targetProps(target, resolvedLabel)} />;
}

export default UiLink;
