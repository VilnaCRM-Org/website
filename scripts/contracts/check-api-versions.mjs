#!/usr/bin/env node
/**
 * Enforces the single-pin invariant for the user-service API surface
 * (issue #381, F4 — OWASP API9:2023 Improper Inventory / Assets Management).
 *
 * The defect this closes: the OpenAPI document rendered on `/swagger` was pinned
 * to user-service v2.6.0 while the GraphQL contract the product is built against
 * was pinned to v2.4.1, through two separate version variables. Public
 * documentation therefore described a different API generation than the one
 * shipped — a documentation-integrity defect and a textbook shadow/zombie-endpoint
 * discovery path.
 *
 * Every user-service artifact must derive from ONE tag, `USER_SERVICE_VERSION`.
 * This check fails if:
 *
 *   1. an env file is missing, or its pin is absent or is not an exact
 *      `vMAJOR.MINOR.PATCH` tag;
 *   2. the env files disagree on the pin (`.env.example` is what a developer
 *      copies, so a stale example reintroduces the drift on the next clone);
 *   3. a consumer URL hardcodes a tag, or interpolates a *second* version
 *      variable, instead of the single pin — this is exactly how the drift arose;
 *   4. a consumer URL resolves to a different repository or a different ref;
 *   5. any two consumers resolve to different refs;
 *   6. a second user-service version variable exists at all;
 *   7. a repo-root config file (env files, Dockerfiles, compose files) references
 *      a user-service tag that is not the pin.
 *
 * Deliberately HERMETIC — no network, no Docker — so it can sit inside `make lint`
 * and run on every pull request. The complementary `make lint-contracts` verifies
 * the committed artifacts still match that tag upstream; that one needs network,
 * which is why the two are separate targets.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

const PIN_NAME = 'USER_SERVICE_VERSION';
const UPSTREAM_REPO = 'VilnaCRM-Org/user-service';
const VERSION_PATTERN = /^v\d+\.\d+\.\d+$/;

/** Env files that must all agree on the pin. `.env.example` is what a clone copies. */
export const DEFAULT_ENV_FILES = ['.env', '.env.example'];

/** Every variable whose value must resolve to the pinned user-service release. */
const PINNED_URL_VARS = ['GRAPHQL_SCHEMA_URL', 'NEXT_PUBLIC_USER_SERVICE_OPENAI_SPEC_URL'];

/** A second version variable is the shape the original drift took. */
const RIVAL_PIN_PATTERN = /^(?:USER_SERVICE|GRAPHQL)[A-Z0-9_]*VERSION$/;

/** `https://raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>` */
const RAW_URL_PATTERN = /^https:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/([^/]+)\/(?:.+)$/;

/** Any literal user-service tag anywhere in a scanned config file. */
const HARDCODED_TAG_PATTERN = new RegExp(`${UPSTREAM_REPO}/(v\\d+\\.\\d+\\.\\d+)`, 'g');

const ROOT_CONFIG_PATTERN = /^(?:\.env(?:\..+)?|.*Dockerfile|Dockerfile|docker-compose.*\.ya?ml)$/;

const failures = [];
const fail = message => failures.push(message);

function readEnvFile(filePath) {
  const contents = readFileSync(filePath, 'utf8');
  // `dotenv-expand` mutates the object it is handed, so parse twice: one copy
  // keeps the literal `${...}` text the reintroduction guard inspects, the other
  // is expanded. Expansion runs against an isolated environment so a stale
  // exported shell variable cannot mask a broken file.
  const parsed = dotenv.parse(contents);
  const { parsed: expanded } = dotenvExpand.expand({
    parsed: dotenv.parse(contents),
    processEnv: {},
  });

  return { parsed, expanded };
}

function checkPin(pin, file) {
  if (!pin) {
    fail(`${file}: ${PIN_NAME} is not set — it is the single user-service pin.`);
    return false;
  }
  if (!VERSION_PATTERN.test(pin)) {
    fail(`${file}: ${PIN_NAME}="${pin}" is not an exact vMAJOR.MINOR.PATCH tag.`);
    return false;
  }
  return true;
}

/** Guard 6: exactly one variable may pin a user-service generation. */
function checkNoRivalPin(parsed, file) {
  Object.keys(parsed)
    .filter(name => name !== PIN_NAME && RIVAL_PIN_PATTERN.test(name))
    .forEach(name =>
      fail(
        `${file}: ${name} is a second user-service pin — everything must derive from ${PIN_NAME}.`
      )
    );
}

/** Guard 3: the value must be built from the pin, not from a literal tag or a rival variable. */
function checkDerivesFromPin(name, rawValue, file) {
  if (rawValue === undefined) {
    fail(`${file}: ${name} is not defined.`);
    return false;
  }
  if (!rawValue.includes(`\${${PIN_NAME}}`)) {
    fail(
      `${file}: ${name} does not interpolate \${${PIN_NAME}} — it must derive from the single pin.`
    );
    return false;
  }
  return true;
}

/** Returns the ref the expanded URL resolves to, or undefined when it is unusable. */
function refOf(name, expandedValue, file) {
  const match = RAW_URL_PATTERN.exec(expandedValue ?? '');
  if (!match) {
    fail(`${file}: ${name} is not a raw.githubusercontent.com URL: "${expandedValue}".`);
    return undefined;
  }

  const [, repo, ref] = match;
  if (repo !== UPSTREAM_REPO) {
    fail(`${file}: ${name} points at "${repo}", not ${UPSTREAM_REPO}.`);
    return undefined;
  }

  return ref;
}

function checkConsumers(pin, parsed, expanded, file) {
  const refs = new Map();

  PINNED_URL_VARS.forEach(name => {
    if (!checkDerivesFromPin(name, parsed[name], file)) return;

    const ref = refOf(name, expanded[name], file);
    if (ref === undefined) return;

    if (ref !== pin) {
      fail(`${file}: ${name} resolves to "${ref}" but ${PIN_NAME} is "${pin}".`);
    }
    refs.set(name, ref);
  });

  if (new Set(refs.values()).size > 1) {
    const detail = [...refs].map(([name, ref]) => `${name}=${ref}`).join(', ');
    fail(`${file}: user-service consumers disagree on the release: ${detail}.`);
  }

  return refs;
}

function checkEnvFile(file, filePath) {
  const { parsed, expanded } = readEnvFile(filePath);
  const pin = parsed[PIN_NAME];

  checkNoRivalPin(parsed, file);

  if (!checkPin(pin, file)) return { pin: undefined, consumers: 0 };

  return { pin, consumers: checkConsumers(pin, parsed, expanded, file).size };
}

function rootConfigFiles(rootDir) {
  return readdirSync(rootDir)
    .filter(entry => ROOT_CONFIG_PATTERN.test(entry))
    .filter(entry => statSync(path.join(rootDir, entry)).isFile())
    .sort();
}

function checkNoHardcodedTags(pin, rootDir) {
  rootConfigFiles(rootDir).forEach(file => {
    const contents = readFileSync(path.join(rootDir, file), 'utf8');

    [...contents.matchAll(HARDCODED_TAG_PATTERN)].forEach(([, tag]) => {
      if (tag !== pin) {
        fail(`${file} hardcodes user-service ${tag}, which is not the pin (${pin}).`);
      }
    });
  });
}

export function checkApiVersions({ rootDir = '.', envFiles = DEFAULT_ENV_FILES } = {}) {
  failures.length = 0;

  const pins = new Map();

  envFiles.forEach(file => {
    const filePath = path.join(rootDir, file);

    if (!existsSync(filePath)) {
      fail(`${file} is missing — every env file must carry the ${PIN_NAME} pin.`);
      return;
    }

    const { pin, consumers } = checkEnvFile(file, filePath);
    if (pin !== undefined) {
      pins.set(file, pin);
      console.log(`   ${file}: ${consumers} consumer(s) pinned to ${pin}`);
    }
  });

  // Guard 2 — the files must agree, so copying `.env.example` cannot reintroduce
  // the divergence.
  if (new Set(pins.values()).size > 1) {
    const detail = [...pins].map(([file, pin]) => `${file}=${pin}`).join(', ');
    fail(`env files disagree on ${PIN_NAME}: ${detail}.`);
  }

  const [canonicalPin] = pins.values();
  if (canonicalPin !== undefined) {
    checkNoHardcodedTags(canonicalPin, rootDir);
    console.log(`   scanned ${rootConfigFiles(rootDir).length} root config file(s) for stray tags`);
  }

  return [...failures];
}

if (process.argv[1]?.endsWith(path.join('contracts', 'check-api-versions.mjs'))) {
  console.log('🔎 Checking the user-service version invariant');

  const problems = checkApiVersions();

  if (problems.length > 0) {
    console.error(`\n❌ ${problems.length} API version problem(s):\n`);
    problems.forEach(problem => console.error(`   ${problem}`));
    process.exit(1);
  }

  console.log('\n✅ OpenAPI and GraphQL reference the same user-service release');
}
