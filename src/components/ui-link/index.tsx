import { UiLink as ToolkitUiLink } from '@vilnacrm/ui-toolkit';
import React from 'react';

import { UiLinkProps } from './types';

const BLANK_TARGET: string = '_blank';
const HARDENING_TOKENS: readonly string[] = ['noopener', 'noreferrer'];

/**
 * #382 F2: a new-tab link must never rely on the caller remembering `rel`.
 *
 * The toolkit hardens `rel` too, but decides with an exact `target === '_blank'`
 * comparison. The HTML `target` keyword is case-insensitive, so `_BLANK` opens a
 * real new tab while receiving no `rel` — the tabnabbing hole this repo already
 * has a regression test for. Fold this back into the toolkit and drop the
 * override once its own check case-folds.
 */
function isBlankTarget(target: string | undefined): boolean {
  return target?.toLowerCase() === BLANK_TARGET;
}

function hardenRel(target: string | undefined, rel: string | undefined): string | undefined {
  if (!isBlankTarget(target)) return rel;

  const supplied: string[] = rel?.split(/\s+/).filter(Boolean) ?? [];
  return [...new Set([...supplied, ...HARDENING_TOKENS])].join(' ');
}

/**
 * `newTabLabel` defaults to a hardcoded English `(opens in new tab)` in the
 * toolkit. This site is bilingual (en/uk) and renders no untranslated copy, so
 * the default is suppressed here; a caller that has a localized string passes
 * its own. Replacing this with a localized default is tracked as follow-up.
 */
function UiLink({ target, rel, newTabLabel = '', ...linkProps }: UiLinkProps): React.ReactElement {
  // Built by spread rather than passed directly: `exactOptionalPropertyTypes`
  // rejects an explicit `undefined` for the toolkit's `target?: string` and
  // `rel?: string`, so an absent value has to be an absent key.
  const hardenedRel: string | undefined = hardenRel(target, rel);
  const linkTarget: { target?: string } = target === undefined ? {} : { target };
  const linkRel: { rel?: string } = hardenedRel === undefined ? {} : { rel: hardenedRel };

  return <ToolkitUiLink {...linkProps} {...linkTarget} {...linkRel} newTabLabel={newTabLabel} />;
}

export default UiLink;
