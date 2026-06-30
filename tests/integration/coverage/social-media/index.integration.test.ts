import { SocialMediaList } from '@/components/social-media';

describe('SocialMedia barrel (integration)', () => {
  it('re-exports the SocialMediaList component', () => {
    expect(SocialMediaList).toBeInstanceOf(Function);
  });
});
