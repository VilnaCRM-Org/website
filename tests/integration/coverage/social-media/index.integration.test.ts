import { SocialMedia, SocialMediaList } from '@/components/social-media';

describe('SocialMedia barrel (integration)', () => {
  it('re-exports the SocialMedia and SocialMediaList components', () => {
    expect(SocialMedia).toBeInstanceOf(Function);
    expect(SocialMediaList).toBeInstanceOf(Function);
  });
});
