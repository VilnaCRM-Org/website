import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

/**
 * Build-time guard on the committed environment files (#378 F1).
 *
 * `src/config/env.ts` rejects a *remote* cleartext endpoint at parse time, but
 * it cannot tell a production export from a Storybook or dev build — both run
 * with `NODE_ENV=production` and different env files. This spec closes that gap
 * from the other side: it asserts the invariants of the committed configuration
 * itself, so a change that points the shipped bundle at `http://` or at
 * loopback fails CI instead of shipping a registration form that either leaks
 * the password on the wire or is silently blocked as mixed content.
 *
 * The variables below are the ones the browser bundle actually sends user data
 * to; `NEXT_PUBLIC_DEVELOPMENT_API_URL` is deliberately excluded because it
 * names a development endpoint by contract.
 */
const REPO_ROOT: string = path.resolve(__dirname, '..', '..', '..');

const CREDENTIAL_URL_VARS: readonly string[] = [
  'NEXT_PUBLIC_GRAPHQL_API_URL',
  'NEXT_PUBLIC_API_URL',
];

// A pattern rather than a list: the whole 127.0.0.0/8 range is loopback, and
// `new URL().hostname` returns IPv6 hosts bracketed.
const LOOPBACK_IPV4 = '127(?:\\.\\d{1,3}){3}';
const LOOPBACK_HOSTNAME = new RegExp(
  `^(localhost|${LOOPBACK_IPV4}|\\[::1\\]|\\[::ffff:${LOOPBACK_IPV4}\\])$`,
  'i'
);

function readEnvFile(fileName: string): Record<string, string> {
  const contents: string = fs.readFileSync(path.join(REPO_ROOT, fileName), 'utf-8');
  const parsed: Record<string, string> = dotenv.parse(contents);
  // `.env` composes its URLs from `${WEBSITE_DOMAIN}`/`${GRAPHQL_PORT}`, exactly
  // as the Makefile and next.config.js do, so expand before inspecting them.
  // An empty `processEnv` keeps the expansion self-contained: the committed
  // file must resolve on its own, not from whatever the shell happens to export.
  dotenvExpand.expand({ parsed, processEnv: {} });
  return parsed;
}

function requireVar(values: Record<string, string>, name: string, fileName: string): string {
  const value: string | undefined = values[name];
  if (value === undefined) {
    throw new Error(`${name} is not defined in ${fileName}`);
  }
  return value;
}

describe('production environment transport contract', () => {
  const productionEnv: Record<string, string> = readEnvFile('.env.production');

  describe.each(CREDENTIAL_URL_VARS)('%s', name => {
    const value: string = requireVar(productionEnv, name, '.env.production');

    it('is served over https', () => {
      expect(new URL(value).protocol).toBe('https:');
    });

    it('does not point the shipped bundle at a loopback host', () => {
      // A loopback endpoint in the static export is not merely wrong, it is
      // broken: an https page cannot POST to http://localhost.
      expect(new URL(value).hostname).not.toMatch(LOOPBACK_HOSTNAME);
    });
  });
});

describe('development environment transport contract', () => {
  const developmentEnv: Record<string, string> = readEnvFile('.env');

  describe.each(CREDENTIAL_URL_VARS)('%s', name => {
    const value: string = requireVar(developmentEnv, name, '.env');

    it('is either https or a loopback endpoint', () => {
      // The dev stack legitimately runs over http, but only against the local
      // machine, where there is no network hop to intercept. A remote http
      // endpoint here would be a credential leak the moment someone copied the
      // file, and `src/config/env.ts` rejects it at parse time.
      const url: URL = new URL(value);
      const isLoopback: boolean = LOOPBACK_HOSTNAME.test(url.hostname);

      expect(url.protocol === 'https:' || isLoopback).toBe(true);
    });
  });
});
