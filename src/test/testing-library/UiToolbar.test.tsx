import { render } from '@testing-library/react';

import { UiToolbar } from '@/components';

import { testText } from './constants';

describe('UiToolbar', () => {
  it('renders the Toolbar with the children', () => {
    const { getByText } = render(<UiToolbar>{testText}</UiToolbar>);
    const toolbarElement: HTMLElement = getByText(testText);
    expect(toolbarElement).toBeInTheDocument();
  });
});
