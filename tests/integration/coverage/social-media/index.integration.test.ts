import {
  SocialMedia,
  SocialMediaList,
} from '../../../../src/features/landing/components/SocialMedia';

describe('SocialMedia barrel (integration)', () => {
  it('re-exports the SocialMediaItem and SocialMediaList components', () => {
    expect(SocialMedia).toBeInstanceOf(Function);
    expect(SocialMediaList).toBeInstanceOf(Function);
  });
});
