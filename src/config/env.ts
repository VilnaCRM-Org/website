import { z } from 'zod';

/**
 * Typed, validated configuration layer (issue #212 / #328).
 *
 * This module is the single place in `src/` and `pages/` that reads
 * `process.env`. Every other module imports the validated `env` object, and an
 * ESLint `no-restricted-syntax` guard blocks direct `process.env` access
 * elsewhere. Validation runs once at module load, so an invalid or missing
 * variable fails `next build` fast with a descriptive error instead of shipping
 * a silent production no-op (placeholder GA id, dev GraphQL endpoint, etc.).
 *
 * IMPORTANT — static export inlining: the site builds with `output: 'export'`,
 * where Next.js inlines `NEXT_PUBLIC_*` values at build time only for *literal*
 * `process.env.NEXT_PUBLIC_X` member expressions. Each variable below is
 * therefore referenced literally; never read them dynamically
 * (`process.env[name]`), or the browser bundle will inline `undefined`.
 */
const clientEnvSchema = z.object({
  // Endpoints consumed by the browser bundle.
  NEXT_PUBLIC_GRAPHQL_API_URL: z.url(),
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_DEVELOPMENT_API_URL: z.union([z.url(), z.literal('')]).default(''),

  // Locale gates the static export (html lang + i18next). Required and
  // non-empty so `<html lang>` never collapses to '' (WCAG 3.1.1).
  NEXT_PUBLIC_MAIN_LANGUAGE: z.string().trim().min(1),
  NEXT_PUBLIC_FALLBACK_LANGUAGE: z.string().trim().min(1),

  // Contact + policy links surfaced across the footer, header and auth form.
  NEXT_PUBLIC_VILNACRM_GMAIL: z.email(),
  NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL: z.url(),
  NEXT_PUBLIC_VILNACRM_USE_POLICY_URL: z.url(),

  // Observability / analytics. Optional: an empty value disables the feature
  // (Sentry no-ops, Google Analytics is not rendered) rather than failing.
  NEXT_PUBLIC_SENTRY_DSN: z.string().trim().default(''),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().trim().default(''),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_GRAPHQL_API_URL: process.env.NEXT_PUBLIC_GRAPHQL_API_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_DEVELOPMENT_API_URL: process.env.NEXT_PUBLIC_DEVELOPMENT_API_URL,
  NEXT_PUBLIC_MAIN_LANGUAGE: process.env.NEXT_PUBLIC_MAIN_LANGUAGE,
  NEXT_PUBLIC_FALLBACK_LANGUAGE: process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE,
  NEXT_PUBLIC_VILNACRM_GMAIL: process.env.NEXT_PUBLIC_VILNACRM_GMAIL,
  NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL: process.env.NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL,
  NEXT_PUBLIC_VILNACRM_USE_POLICY_URL: process.env.NEXT_PUBLIC_VILNACRM_USE_POLICY_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `Invalid environment configuration. Fix the offending variables in .env / .env.production:\n${details}`
  );
}

export const env: ClientEnv = parsed.data;

/**
 * Build mode. `NODE_ENV` is a Next/webpack build-time constant (inlined into the
 * static export), not a runtime configuration value, so it stays out of the
 * validated schema above. Centralizing the read in this rule-exempt module keeps
 * feature code free of direct `process.env` access (#328). Exposed as a function
 * rather than a const so callers observe the ambient value at call time.
 */
export function isProductionBuild(): boolean {
  return process.env.NODE_ENV === 'production';
}
