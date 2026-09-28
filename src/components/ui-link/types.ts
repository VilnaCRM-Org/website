import type { UiLinkProps as ToolkitUiLinkProps } from '@vilnacrm/ui-toolkit/ui-link';

export type NewTabLinkProps = Extract<ToolkitUiLinkProps, { target: '_blank' }>;
export type SameTabLinkProps = Exclude<ToolkitUiLinkProps, { target: '_blank' }>;

export type UiLinkProps = Omit<ToolkitUiLinkProps, 'target' | 'newTabLabel'> & {
  target?: string | undefined;
  newTabLabel?: string | undefined;
};
