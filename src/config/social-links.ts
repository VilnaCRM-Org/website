/**
 * Single source of truth for VilnaCRM social profile URLs (issue #328).
 *
 * Consumed by both the shared footer (`src/components/ui-footer`) and the
 * landing header (`src/features/landing`) so the two link sets stay in sync and
 * cannot drift. Lives in `src/config` (a shared layer) to respect the
 * dependency-cruiser `no-shared-layers-to-features` boundary — features import
 * config, never the reverse.
 */
export const socialProfileLinks = {
  instagram: 'https://www.instagram.com/',
  github: 'https://github.com/VilnaCRM-Org',
  facebook: 'https://www.facebook.com/',
  linkedin: 'https://www.linkedin.com/',
} as const;
