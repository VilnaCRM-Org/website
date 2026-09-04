import { UiLink as ToolkitUiLink } from '@vilnacrm/ui-toolkit';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BLANK_TARGET, resolveExternalLinkRel } from '@/shared/externalLinkRel';

import { UiLinkProps } from './types';

/**
 * `newTabLabel` defaults to a hardcoded English `(opens in new tab)` in the
 * toolkit, and this site is bilingual (en/uk) and renders no untranslated copy.
 * Rather than suppress the cue — which silently drops the "opens in new tab"
 * announcement for every `_blank` link whose caller forgot to pass one — the
 * default is localized here, on the same principle as `rel` below: a new-tab
 * link must never depend on the caller remembering.
 */
const NEW_TAB_LABEL_KEY: string = 'accessibility.opens_in_new_tab';

function UiLink({ target, rel, newTabLabel, ...linkProps }: UiLinkProps): React.ReactElement {
  const { t } = useTranslation();

  // #382 F2: hardening `rel` is shared with every other external-link sink in
  // the repo (`src/shared/externalLinkRel.ts`), which case-folds `target` before
  // deciding. The toolkit compares `target === '_blank'` exactly, and the HTML
  // keyword is case-insensitive, so `_BLANK` opens a real new tab while
  // receiving no `rel` — the tabnabbing hole this repo already has a regression
  // test for. Fold this back into the toolkit and drop the override once its own
  // check case-folds.
  const hardenedRel: string | undefined = resolveExternalLinkRel(target, rel);
  const opensNewTab: boolean = target?.toLowerCase() === BLANK_TARGET;
  const resolvedLabel: string = newTabLabel ?? (opensNewTab ? t(NEW_TAB_LABEL_KEY) : '');

  // Built by spread rather than passed directly: `exactOptionalPropertyTypes`
  // rejects an explicit `undefined` for the toolkit's `target?: string` and
  // `rel?: string`, so an absent value has to be an absent key.
  const linkTarget: { target?: string } = target === undefined ? {} : { target };
  const linkRel: { rel?: string } = hardenedRel === undefined ? {} : { rel: hardenedRel };

  return <ToolkitUiLink {...linkProps} {...linkTarget} {...linkRel} newTabLabel={resolvedLabel} />;
}

export default UiLink;
