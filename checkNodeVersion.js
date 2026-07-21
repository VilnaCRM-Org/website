// Guards the Node runtime against package.json "engines".
//
// Deliberately dependency-free: `make install` runs this BEFORE `pnpm install`,
// so anything required from node_modules (previously `semver`) throws
// MODULE_NOT_FOUND on a cold cache and turns a helpful version error into a
// confusing crash. Only the caret/or range shapes this repo actually pins are
// supported — see the `engines.node` field.

const { engines } = require('./package.json');

const range = engines.node;

const parseVersion = version => version.split('.').map(Number);

// `^22.12` -> >=22.12.0 <23.0.0 ; `^24` -> >=24.0.0 <25.0.0
const satisfiesCaret = ([major, minor, patch], clause) => {
  const match = /^\^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(clause);
  if (!match) {
    throw new Error(
      `checkNodeVersion.js cannot evaluate the engines range "${clause}". ` +
        'Supported shape: caret clauses joined by "||", e.g. "^22.12 || ^24".'
    );
  }

  const [wantMajor, wantMinor, wantPatch] = [match[1], match[2], match[3]].map(part =>
    part === undefined ? 0 : Number(part)
  );

  if (major !== wantMajor) return false;
  if (minor !== wantMinor) return minor > wantMinor;
  return patch >= wantPatch;
};

const satisfies = (version, spec) =>
  spec
    .split('||')
    .map(clause => clause.trim())
    .some(clause => satisfiesCaret(version, clause));

const current = process.versions.node;

if (satisfies(parseVersion(current), range)) {
  console.log(`✅ Node version v${current} satisfies required ${range}.`);
} else {
  console.log(`Required node version ${range} not satisfied with current version v${current}.`);
  process.exit(1);
}
