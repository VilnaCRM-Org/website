import fs from 'node:fs';

import './utils/initializeLocalization.js';
import { run, analyze } from '@memlab/api';
import { StringAnalysis } from '@memlab/heap-analysis';

const memoryLeakDir = './src/test/memory-leak';
const testsDir = './tests';

const workDir = './src/test/memory-leak/results';
const consoleMode = 'VERBOSE';

(async function runMemlab() {
  const testFilePaths = fs
    .readdirSync(`${memoryLeakDir}/${testsDir}`)
    .map(test => `${testsDir}/${test}`);

  for (const testFilePath of testFilePaths) {
    const scenarioModule = await import(new URL(testFilePath, import.meta.url).href);
    const scenario = scenarioModule.default ?? scenarioModule;

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
