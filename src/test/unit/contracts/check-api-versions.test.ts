import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { checkApiVersions } from '../../../../scripts/contracts/check-api-versions.mjs';

/**
 * Issue #381 / F4 — the regression gate itself.
 *
 * The repo used to pin the OpenAPI spec to user-service v2.6.0 while the GraphQL
 * contract sat on v2.4.1, through two separate version variables, so `/swagger`
 * documented a different API generation than the product integrated (OWASP
 * API9:2023). These specs prove the invariant check both passes on the real
 * repository and FAILS on every way that drift can come back — a check that only
 * ever passes is not a gate.
 *
 * Scenario classes: positive (the committed env files are consistent), negative
 * (each broken invariant), boundary (missing pin, malformed tag, missing file,
 * missing variable, non-GitHub host, no scannable config files).
 *
 * Locale / responsive / a11y — Not applicable: this is a build-time config check.
 */

const PIN = 'v2.6.0';
// Built as a template literal so the placeholder text is not a plain string
// containing `${`, which `no-template-curly-in-string` would flag.
const PIN_REF = `\${USER_SERVICE_VERSION}`;
const RIVAL_PIN_REF = `\${GRAPHQL_SCHEMA_VERSION}`;
const UPSTREAM = 'https://raw.githubusercontent.com/VilnaCRM-Org/user-service';
const GRAPHQL_URL = `${UPSTREAM}/${PIN_REF}/.github/graphql-spec/spec`;
const OPENAPI_URL = `${UPSTREAM}/${PIN_REF}/.github/openapi-spec/spec.yaml`;

function envFile(overrides: Record<string, string | null> = {}): string {
  const base: Record<string, string | null> = {
    USER_SERVICE_VERSION: PIN,
    GRAPHQL_SCHEMA_URL: GRAPHQL_URL,
    NEXT_PUBLIC_USER_SERVICE_OPENAI_SPEC_URL: OPENAPI_URL,
    ...overrides,
  };

  return `${Object.entries(base)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}

describe('user-service version invariant', () => {
  let sandbox: string;
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    sandbox = mkdtempSync(path.join(tmpdir(), 'api-versions-'));
    // The gate reports through the standard streams, not `console`.
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    rmSync(sandbox, { recursive: true, force: true });
  });

  function write(files: Record<string, string>): void {
    Object.entries(files).forEach(([name, body]) => {
      writeFileSync(path.join(sandbox, name), body);
    });
  }

  /** Runs the check over a single sandbox `.env`, unless extra env files are named. */
  function run(files: Record<string, string>, envFiles: string[] = ['.env']): string[] {
    write(files);
    return checkApiVersions({ rootDir: sandbox, envFiles });
  }

  describe('the committed repository', () => {
    it('satisfies the invariant across every env file', () => {
      expect(checkApiVersions()).toEqual([]);
    });
  });

  describe('positive path', () => {
    it('accepts a config where both consumers interpolate the single pin', () => {
      expect(run({ '.env': envFile() })).toEqual([]);
    });

    it('ignores unrelated variables', () => {
      expect(run({ '.env': `${envFile()}SOMETHING_ELSE=https://example.com/whatever\n` })).toEqual(
        []
      );
    });

    it('accepts env files that agree on the pin', () => {
      expect(
        run({ '.env': envFile(), '.env.example': envFile() }, ['.env', '.env.example'])
      ).toEqual([]);
    });
  });

  describe('the pin itself', () => {
    it('fails when the pin is missing', () => {
      expect(run({ '.env': envFile({ USER_SERVICE_VERSION: null }) })).toEqual([
        expect.stringContaining('.env: USER_SERVICE_VERSION is not set'),
      ]);
    });

    it.each([
      ['a bare branch name', 'main'],
      ['a tag without the v prefix', '2.6.0'],
      ['a partial version', 'v2.6'],
      ['a floating major tag', 'v2'],
    ])('fails on %s', (_label, pin) => {
      expect(run({ '.env': envFile({ USER_SERVICE_VERSION: pin }) })).toEqual([
        expect.stringContaining('is not an exact vMAJOR.MINOR.PATCH tag'),
      ]);
    });

    it('fails when an env file is missing entirely', () => {
      expect(run({ '.env': envFile() }, ['.env', '.env.example'])).toEqual([
        expect.stringContaining('.env.example is missing'),
      ]);
    });
  });

  describe('drift between the two consumers — the defect this closes', () => {
    it('fails when the OpenAPI spec hardcodes an older release than the pin', () => {
      const drifted = OPENAPI_URL.replace(PIN_REF, 'v2.4.1');

      expect(
        run({ '.env': envFile({ NEXT_PUBLIC_USER_SERVICE_OPENAI_SPEC_URL: drifted }) })
      ).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            `.env: NEXT_PUBLIC_USER_SERVICE_OPENAI_SPEC_URL does not interpolate ${PIN_REF}`
          ),
          // `.env` is itself a scanned config file, so the stray literal tag is
          // reported a second time by the hardcoded-tag guard.
          expect.stringContaining('.env hardcodes user-service v2.4.1'),
        ])
      );
    });

    it('reproduces the exact reported drift: docs on v2.6.0, GraphQL on v2.4.1', () => {
      const problems = run({
        '.env': envFile({
          GRAPHQL_SCHEMA_URL: GRAPHQL_URL.replace(PIN_REF, 'v2.4.1'),
          NEXT_PUBLIC_USER_SERVICE_OPENAI_SPEC_URL: OPENAPI_URL.replace(PIN_REF, 'v2.6.0'),
        }),
      });

      expect(problems).toEqual(
        expect.arrayContaining([
          expect.stringContaining('.env: GRAPHQL_SCHEMA_URL does not interpolate'),
          expect.stringContaining(
            '.env: NEXT_PUBLIC_USER_SERVICE_OPENAI_SPEC_URL does not interpolate'
          ),
          expect.stringContaining('.env hardcodes user-service v2.4.1'),
        ])
      );
    });

    it('fails when a second version variable reappears — the original shape of the drift', () => {
      const problems = run({
        '.env': envFile({
          GRAPHQL_SCHEMA_VERSION: 'v2.4.1',
          GRAPHQL_SCHEMA_URL: `${UPSTREAM}/${RIVAL_PIN_REF}/.github/graphql-spec/spec`,
        }),
      });

      expect(problems).toEqual(
        expect.arrayContaining([
          expect.stringContaining('.env: GRAPHQL_SCHEMA_VERSION is a second user-service pin'),
          expect.stringContaining('.env: GRAPHQL_SCHEMA_URL does not interpolate'),
        ])
      );
    });

    it('fails when .env.example drifts from .env, so a fresh clone cannot inherit it', () => {
      const problems = run(
        { '.env': envFile(), '.env.example': envFile({ USER_SERVICE_VERSION: 'v2.4.1' }) },
        ['.env', '.env.example']
      );

      expect(problems).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'env files disagree on USER_SERVICE_VERSION: .env=v2.6.0, .env.example=v2.4.1'
          ),
        ])
      );
    });
  });

  describe('consumer URLs', () => {
    it('fails when a consumer variable is missing entirely', () => {
      expect(run({ '.env': envFile({ GRAPHQL_SCHEMA_URL: null }) })).toEqual([
        expect.stringContaining('.env: GRAPHQL_SCHEMA_URL is not defined'),
      ]);
    });

    it('fails when a consumer points at a different repository', () => {
      const foreign = `https://raw.githubusercontent.com/Evil-Org/user-service/${PIN_REF}/spec`;

      expect(run({ '.env': envFile({ GRAPHQL_SCHEMA_URL: foreign }) })).toEqual([
        expect.stringContaining('points at "Evil-Org/user-service"'),
      ]);
    });

    it('fails when a consumer is not a raw.githubusercontent.com URL', () => {
      expect(
        run({
          '.env': envFile({ GRAPHQL_SCHEMA_URL: `https://example.com/${PIN_REF}/spec` }),
        })
      ).toEqual([expect.stringContaining('is not a raw.githubusercontent.com URL')]);
    });
  });

  describe('stray tags in root config files', () => {
    it('fails when a Dockerfile hardcodes a user-service tag that is not the pin', () => {
      const problems = run({
        '.env': envFile(),
        'Apollo.Dockerfile':
          'RUN curl https://raw.githubusercontent.com/VilnaCRM-Org/user-service/v2.4.1/spec\n',
      });

      expect(problems).toEqual([
        expect.stringContaining('Apollo.Dockerfile hardcodes user-service v2.4.1'),
      ]);
    });

    it('accepts a config file that references the pin itself', () => {
      expect(
        run({
          '.env': envFile(),
          'docker-compose.test.yml': `image: ghcr.io/VilnaCRM-Org/user-service/${PIN}\n`,
        })
      ).toEqual([]);
    });

    it('ignores files outside the scanned config set', () => {
      expect(
        run({
          '.env': envFile(),
          'notes.md': 'see VilnaCRM-Org/user-service/v1.0.0 for the historical shape\n',
        })
      ).toEqual([]);
    });

    it('scans nested Dockerfiles, not only the repository root', () => {
      mkdirSync(path.join(sandbox, 'docker', 'apollo-server'), { recursive: true });
      writeFileSync(
        path.join(sandbox, 'docker', 'apollo-server', 'Nested.Dockerfile'),
        'RUN curl https://raw.githubusercontent.com/VilnaCRM-Org/user-service/v2.4.1/spec\n'
      );

      expect(run({ '.env': envFile() })).toEqual([
        expect.stringContaining('hardcodes user-service v2.4.1'),
      ]);
    });

    it('does not scan vendored or generated trees', () => {
      mkdirSync(path.join(sandbox, 'node_modules', 'some-package'), { recursive: true });
      writeFileSync(
        path.join(sandbox, 'node_modules', 'some-package', 'Dockerfile'),
        'FROM VilnaCRM-Org/user-service/v1.0.0\n'
      );

      expect(run({ '.env': envFile() })).toEqual([]);
    });
  });
});
