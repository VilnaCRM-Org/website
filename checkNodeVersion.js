const semver = require('semver');
const { engines } = require('./package.json');

const version = engines.node;
if (!semver.satisfies(process.version, version)) {
  console.log(
    `Required node version ${version} not satisfied with current version ${process.version}.`
  );
  process.exit(1);
} else {
  console.log(`✅ Node version ${process.version} satisfies required ${version}.`);
}
