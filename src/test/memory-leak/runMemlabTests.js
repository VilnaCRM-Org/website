require('./utils/initializeLocalization');

const fs = require('node:fs');
const path = require('node:path');

const { run, analyze } = require('@memlab/api');
const { StringAnalysis } = require('@memlab/heap-analysis');

const memoryLeakDir = path.resolve('./src/test/memory-leak');
const testsDir = './tests';
const workDir = path.resolve(memoryLeakDir, 'results');
const consoleMode = 'VERBOSE';

try {
  fs.mkdirSync(workDir, { recursive: true, mode: 0o777 });
} catch (error) {
  process.exit(1);
}

(async function () {
  const testFilePaths = fs
    .readdirSync(`${memoryLeakDir}/${testsDir}`)
    .map(test => `${testsDir}/${test}`);

  for (const testFilePath of testFilePaths) {
    const scenario = require(testFilePath);

    const { runResult } = await run({
      scenario,
      consoleMode,
      workDir,
      skipWarmup: process.env.MEMLAB_SKIP_WARMUP === 'true',
      debug: process.env.MEMLAB_DEBUG === 'true',
    });

    const analyzer = new StringAnalysis();
    await analyze(runResult, analyzer);

    runResult.cleanup();
  }
})();
