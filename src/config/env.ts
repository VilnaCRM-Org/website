import { z } from 'zod';

const CLEARTEXT_ENDPOINT_MESSAGE =
  'must use https:// — cleartext http:// is accepted only for loopback hosts, ' +
  'because the browser sends user data or trace headers to this endpoint';

const ENCRYPTED_OR_LOOPBACK =
  /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?([/?#]|$))/i;

function isEncryptedOrLoopback(value: string): boolean {
  return ENCRYPTED_OR_LOOPBACK.test(value);
}

const credentialEndpoint: () => z.ZodType<string> = () =>
  z.url().refine(isEncryptedOrLoopback, { message: CLEARTEXT_ENDPOINT_MESSAGE });

const clientEnvSchema = z.object({
  NEXT_PUBLIC_GRAPHQL_API_URL: credentialEndpoint(),
  NEXT_PUBLIC_API_URL: credentialEndpoint(),
  NEXT_PUBLIC_DEVELOPMENT_API_URL: z.union([z.url(), z.literal('')]).default(''),

  NEXT_PUBLIC_MAIN_LANGUAGE: z.string().trim().min(1),
  NEXT_PUBLIC_FALLBACK_LANGUAGE: z.string().trim().min(1),

  NEXT_PUBLIC_VILNACRM_GMAIL: z.email(),
  NEXT_PUBLIC_VILNACRM_PRIVACY_POLICY_URL: z.url(),
  NEXT_PUBLIC_VILNACRM_USE_POLICY_URL: z.url(),

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

export function isProductionBuild(): boolean {
  return process.env.NODE_ENV === 'production';
}
