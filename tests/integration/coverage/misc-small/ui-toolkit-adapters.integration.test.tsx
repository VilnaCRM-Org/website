/**
 * Integration: the `@vilnacrm/ui-toolkit` adapters.
 *
 * `UiButton` and `UiLink` are the two primitives this repo does not take from the
 * toolkit verbatim — each re-adds a contract the toolkit forwards at runtime but
 * does not model. These cases drive both sides of every branch in that seam
 * against the REAL toolkit components.
 */
import { render } from '@testing-library/react';
import { t } from 'i18next';

import { UiButton, UiLink } from '@/components';
import { bodyLetterSpacing } from '@/components/app-theme';
import inputStyles from '@/components/ui-input/styles';

const HARDENED_REL: string = 'noopener noreferrer';
const HREF: string = 'https://example.com';
const LABEL: string = 'Example';
// Hoisted: inline, its UTF-8 length puts the JSX line past the 100-byte
// editorconfig limit, and Prettier cannot break a string attribute.
const NEW_TAB_LABEL: string = '(відкриється у новій вкладці)';
// The default the adapter supplies when the caller passes none.
const LOCALIZED_NEW_TAB_LABEL: string = t('accessibility.opens_in_new_tab');
const NEW_TAB_NAME: string = `${LABEL} ${LOCALIZED_NEW_TAB_LABEL}`;

describe('UiButton adapter', () => {
  it('forwards rel and target onto the anchor MUI renders for an href', () => {
    const { getByRole } = render(
      <UiButton href={HREF} target="_blank" rel="noreferrer">
        {LABEL}
      </UiButton>
    );

    const link: HTMLElement = getByRole('link', { name: LABEL });

    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('emits neither attribute when the caller passes neither', () => {
    const { getByRole } = render(<UiButton type="button">{LABEL}</UiButton>);

    const button: HTMLElement = getByRole('button', { name: LABEL });

    expect(button).not.toHaveAttribute('target');
    expect(button).not.toHaveAttribute('rel');
  });

  // MUI switches Button to an anchor on the PRESENCE of `href`, not on its value,
  // so forwarding an empty string turns the button into a destination-less link.
  // The component this adapter replaced dropped a falsy href for that reason.
  it('stays a button when href is empty rather than rendering an anchor', () => {
    const { getByRole, queryByRole } = render(
      <UiButton type="button" href="">
        {LABEL}
      </UiButton>
    );

    expect(getByRole('button', { name: LABEL })).toBeInTheDocument();
    expect(queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('UiLink adapter', () => {
  it('hardens a lower-case blank target', () => {
    const { getByRole } = render(
      <UiLink href={HREF} target="_blank">
        {LABEL}
      </UiLink>
    );

    expect(getByRole('link', { name: NEW_TAB_NAME })).toHaveAttribute('rel', HARDENED_REL);
  });

  // The toolkit's own default for this label is a hardcoded English string, and
  // this site renders no untranslated copy — but suppressing it, as the first cut
  // of this adapter did, drops the cue for every caller that forgets to pass one.
  it('announces a new tab in the active language when the caller passes no label', () => {
    const { getByRole } = render(
      <UiLink href={HREF} target="_blank">
        {LABEL}
      </UiLink>
    );

    expect(LOCALIZED_NEW_TAB_LABEL).not.toBe('accessibility.opens_in_new_tab');
    expect(getByRole('link', { name: NEW_TAB_NAME })).toBeInTheDocument();
  });

  it('hardens a case-variant blank target the same way', () => {
    const { getByRole } = render(
      <UiLink href={HREF} target="_BLANK">
        {LABEL}
      </UiLink>
    );

    // The accessible name carries the new-tab cue here, exactly as it does for a
    // lowercase `_blank`: the adapter decides `opensNewTab` by case-folding, so a
    // link that really does open a new tab announces it whatever case the caller
    // wrote. Asserting the cue-bearing name rather than the bare label is what
    // keeps that promise covered for the case variant too.
    expect(getByRole('link', { name: NEW_TAB_NAME })).toHaveAttribute('rel', HARDENED_REL);
  });

  it('keeps caller tokens and de-duplicates the hardening ones', () => {
    const { getByRole } = render(
      <UiLink href={HREF} target="_blank" rel="nofollow noopener">
        {LABEL}
      </UiLink>
    );

    expect(getByRole('link', { name: NEW_TAB_NAME })).toHaveAttribute(
      'rel',
      'nofollow noopener noreferrer'
    );
  });

  // An explicit empty label is the caller opting out, and must stay opt-out: the
  // default is only supplied where the caller supplied nothing at all.
  it('honours an explicitly empty label instead of substituting the default', () => {
    const { getByRole } = render(
      <UiLink href={HREF} target="_blank" newTabLabel="">
        {LABEL}
      </UiLink>
    );

    expect(getByRole('link', { name: LABEL })).toBeInTheDocument();
  });

  // v0.5.0 narrows `target` to the same-tab keywords once `_blank` is excluded, so
  // the adapter forwards a keyword it did not case-fold through the second union
  // member: it must reach the anchor untouched, with neither rel nor the cue.
  it('forwards a same-tab keyword target without a rel or a new-tab cue', () => {
    const { getByRole } = render(
      <UiLink href={HREF} target="_self">
        {LABEL}
      </UiLink>
    );

    const link: HTMLElement = getByRole('link', { name: LABEL });

    expect(link).toHaveAttribute('target', '_self');
    expect(link).not.toHaveAttribute('rel');
  });

  it('leaves a same-tab link alone and adds no new-tab hint to its name', () => {
    const { getByRole } = render(<UiLink href={HREF}>{LABEL}</UiLink>);

    const link: HTMLElement = getByRole('link', { name: LABEL });

    expect(link).not.toHaveAttribute('rel');
    expect(link).toHaveTextContent(LABEL);
  });

  it('renders a caller-supplied localized new-tab label', () => {
    const { getByRole } = render(
      <UiLink href={HREF} target="_blank" newTabLabel={NEW_TAB_LABEL}>
        {LABEL}
      </UiLink>
    );

    expect(getByRole('link', { name: `${LABEL} ${NEW_TAB_LABEL}` })).toBeInTheDocument();
  });
});

// The input adapter layers the app theme's body tracking UNDER whatever the consumer
// passes, in every shape `sx` can take, so a consumer override still wins and a
// consumer that passes nothing still gets the tracking main's placeholders had.
describe('UiInput adapter tracking', () => {
  const tracking: { letterSpacing: string | number } = { letterSpacing: bodyLetterSpacing };

  it('supplies the body tracking alone when the consumer passes no sx', () => {
    expect(inputStyles.withRootTracking(undefined)).toEqual([tracking]);
  });

  it('layers a single consumer sx object after the tracking', () => {
    const consumer: { marginTop: string } = { marginTop: '1rem' };

    expect(inputStyles.withRootTracking(consumer)).toEqual([tracking, consumer]);
  });

  it('keeps every entry of a consumer sx array, in order, after the tracking', () => {
    const first: { marginTop: string } = { marginTop: '1rem' };
    const second: { letterSpacing: string } = { letterSpacing: '0' };

    expect(inputStyles.withRootTracking([first, second])).toEqual([tracking, first, second]);
  });
});
