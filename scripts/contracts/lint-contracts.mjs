#!/usr/bin/env node
/**
 * Validates the committed user-service contracts.
 *
 *   1. every client GraphQL operation parses and validates against the pinned
 *      schema (graphql-js `validate` — the same validator Apollo uses);
 *   2. the pinned OpenAPI document lints clean against spectral:oas relative to
 *      a committed baseline, so new defects fail while known upstream ones do
 *      not silently disappear;
 *   3. the pin is an immutable ref and every committed artifact still matches
 *      the SHA-256 digest recorded next to it (#376);
 *   4. the committed artifacts still match the tag in USER_SERVICE_VERSION.
 *
 * Step 4 is the only one that needs network. Pass --offline to skip it (used by
 * the local `make lint-contracts`); CI runs the full set.
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

import { buildSpecUrl, fetchSwaggerYaml, normalizeSpec } from '../fetchSwaggerSchema.mjs';
import { buildSchemaUrl, fetchGraphqlSchema } from '../fetchGraphqlSchema.mjs';
import {
  CHECKSUMS_PATH,
  OPENAPI_ARTIFACT,
  SCHEMA_ARTIFACT,
  buildChecksumsFile,
  verifyCommittedDigests,
} from './checksums.mjs';
import { checkGraphqlOperations as checkOperations } from './graphql-operations.mjs';
import { immutableRefError, isImmutableRef } from './refs.mjs';

// checksums.mjs owns these paths: they are also the keys in checksums.json, so a
// second declaration here could drift from the digests that attest to them.
const SCHEMA_PATH = SCHEMA_ARTIFACT;
const OPENAPI_PATH = OPENAPI_ARTIFACT;
const BASELINE_PATH = 'contracts/spectral-baseline.json';

// Client operations only. src/test/apollo-server defines its own inline SDL as a
// deliberate test double, so validating it against the upstream schema would be
// comparing the mock to the thing it exists to stand in for.
const CLIENT_SOURCE_DIR = 'src/features';

const offline = process.argv.includes('--offline');
const failures = [];

const fail = (scope, message) => failures.push({ scope, message });

function checkGraphqlOperations() {
  // The policy lives in ./graphql-operations.mjs so it can be pointed at a
  // seeded fixture directory and proved to go red (#348). This wrapper only
  // adapts its returned failures onto this script's `graphql` scope.
  const { documentCount, failures: problems } = checkOperations({
    schemaPath: SCHEMA_PATH,
    sourceDir: CLIENT_SOURCE_DIR,
  });

  problems.forEach(message => fail('graphql', message));

  if (documentCount === 0) {
    return;
  }

  console.log(`   checked ${documentCount} client GraphQL document(s) against ${SCHEMA_PATH}`);
}

const fingerprint = finding => `${finding.code} @ ${finding.path.join('.')}`;

function runSpectral() {
  let raw;
  try {
    raw = execFileSync(
      'node_modules/.bin/spectral',
      ['lint', OPENAPI_PATH, '--ruleset', '.spectral.yaml', '--format', 'json', '--quiet'],
      { encoding: 'utf8' }
    );
  } catch (error) {
    // spectral exits non-zero whenever it reports problems, which is expected
    // while the baseline is non-empty. Only missing stdout means it crashed.
    if (!error.stdout) {
      throw new Error(`spectral failed to run: ${error.message}`);
    }
    raw = error.stdout;
  }

  return JSON.parse(raw).map(fingerprint).sort();
}

function checkOpenapiSpec() {
  let findings;
  try {
    findings = runSpectral();
  } catch (error) {
    fail('openapi', error.message);
    return;
  }

  const current = new Set(findings);
  const baseline = new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).findings);

  const added = [...current].filter(entry => !baseline.has(entry));
  const removed = [...baseline].filter(entry => !current.has(entry));

  added.forEach(entry => fail('openapi', `new spectral finding: ${entry}`));
  removed.forEach(entry =>
    fail('openapi', `spectral finding is gone: ${entry} — refresh ${BASELINE_PATH}`)
  );

  console.log(
    `   spectral: ${current.size} finding(s), ${baseline.size} baselined, ` +
      `${added.length} new, ${removed.length} resolved`
  );
}

/**
 * The hermetic half of the supply-chain gate (#376).
 *
 * The drift check below is stronger but needs `raw.githubusercontent.com`; this
 * one needs nothing, so a tampered `contracts/` artifact — or a pin repointed at
 * a branch that floats under the committed digests — fails on every lane,
 * including an offline run and a network outage.
 */
function checkPinIntegrity() {
  const version = process.env.USER_SERVICE_VERSION;

  if (!version) {
    fail('integrity', 'USER_SERVICE_VERSION is not set — define it in .env');
  } else if (!isImmutableRef(version)) {
    fail('integrity', immutableRefError(version));
  }

  let problems;
  try {
    problems = verifyCommittedDigests();
  } catch (error) {
    fail('integrity', error.message);
    return;
  }

  problems.forEach(problem => fail('integrity', problem));

  if (problems.length === 0) {
    console.log(`   verified ${CHECKSUMS_PATH} against the committed artifacts`);
  }
}

async function checkArtifactsMatchPin() {
  const [openapiYaml, sdl] = await Promise.all([
    fetchSwaggerYaml(buildSpecUrl()),
    fetchGraphqlSchema(buildSchemaUrl()),
  ]);

  const { load } = await import('js-yaml');

  // Compare parsed documents, not bytes: Prettier owns the committed file's
  // formatting (it is inside the `make format` glob), so a byte comparison
  // would report drift on every reformat while missing nothing real.
  const upstreamOpenapi = JSON.stringify(normalizeSpec(load(openapiYaml)));
  const committedOpenapi = JSON.stringify(JSON.parse(readFileSync(OPENAPI_PATH, 'utf8')));

  if (upstreamOpenapi !== committedOpenapi) {
    fail('drift', `${OPENAPI_PATH} differs from the pinned tag — run \`make update-contracts\``);
  }
  if (sdl !== readFileSync(SCHEMA_PATH, 'utf8')) {
    fail('drift', `${SCHEMA_PATH} differs from the pinned tag — run \`make update-contracts\``);
  }

  console.log(`   artifacts match ${process.env.USER_SERVICE_VERSION}`);
}

if (process.argv.includes('--update-checksums')) {
  writeFileSync(CHECKSUMS_PATH, `${JSON.stringify(buildChecksumsFile(), null, 2)}\n`);
  console.log(`✅ Wrote artifact digests to ${CHECKSUMS_PATH}`);
  process.exit(0);
}

if (process.argv.includes('--update-baseline')) {
  const findings = runSpectral();
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        comment:
          'Known spectral:oas findings in the pinned upstream OpenAPI spec. ' +
          'These are upstream defects this repo does not control. lint-contracts ' +
          'fails on any finding not listed here, and on any listed finding that ' +
          'disappears (so a fixed defect shrinks the baseline instead of rotting).',
        findings,
      },
      null,
      2
    )}\n`
  );
  console.log(`✅ Wrote ${findings.length} finding(s) to ${BASELINE_PATH}`);
  process.exit(0);
}

console.log('🔎 Validating user-service contracts');

checkGraphqlOperations();
checkOpenapiSpec();
checkPinIntegrity();

if (offline) {
  console.log('   drift check skipped (--offline)');
} else {
  await checkArtifactsMatchPin();
}

if (failures.length > 0) {
  console.error(`\n❌ ${failures.length} contract problem(s):\n`);
  failures.forEach(({ scope, message }) => console.error(`   [${scope}] ${message}`));
  process.exit(1);
}

console.log('\n✅ Contracts are valid and in sync with the pin');
