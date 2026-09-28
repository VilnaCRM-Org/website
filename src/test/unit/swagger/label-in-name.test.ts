import { labelInName } from '../../../features/swagger/helpers/label-in-name';

describe('labelInName (#433, WCAG 2.5.3)', () => {
  it.each<[string, string]>([
    ['Authorize', 'Apply given OAuth2 credentials'],
    ['Logout', 'Remove authorization'],
    ['  Authorize  ', 'Apply credentials'],
  ])('drops the aria-label so %p names the button by its visible text', (text, ariaLabel) => {
    expect(labelInName(text, ariaLabel)).toBeUndefined();
  });

  it('keeps nothing when there was no aria-label to begin with', () => {
    expect(labelInName('Close', undefined)).toBeUndefined();
  });

  it.each<[string, unknown]>([
    ['array children', ['Edit', ' ']],
    ['a number', 42],
    ['no children', undefined],
    ['null', null],
    ['an empty string', ''],
    ['whitespace only', ' \n\t '],
  ])('keeps the aria-label for %s, where it is the only name', (_case, children) => {
    expect(labelInName(children, 'Edit the example')).toBe('Edit the example');
  });
});
