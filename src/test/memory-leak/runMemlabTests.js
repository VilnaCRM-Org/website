import fs from 'node:fs';
import path from 'node:path';

import './utils/initializeLocalization.js';
import memlabApi from '@memlab/api';
import heapAnalysis from '@memlab/heap-analysis';

const { run, analyze } = memlabApi;
const { StringAnalysis } = heapAnalysis;

const memoryLeakDir = './src/test/memory-leak';
const testsDir = './tests';

const baseWorkDir = './src/test/memory-leak/results';
const consoleMode = 'VERBOSE';
const defaultProtocolTimeout = 10 * 60 * 1000;

const configuredProtocolTimeout = Number.parseInt(process.env.MEMLAB_PROTOCOL_TIMEOUT ?? '', 10);
memlabApi.config.puppeteerConfig.protocolTimeout =
  Number.isFinite(configuredProtocolTimeout) && configuredProtocolTimeout > 0
    ? configuredProtocolTimeout
    : defaultProtocolTimeout;

(async function runMemlab() {
  const testFilePaths = fs
    .readdirSync(`${memoryLeakDir}/${testsDir}`)
    .sort()
    .map(test => `${testsDir}/${test}`);

  for (const testFilePath of testFilePaths) {
    const testName = path.basename(testFilePath, '.js');
    const workDir = `${baseWorkDir}/${testName}`;
    let runResult;

    const scenarioModule = await import(new URL(testFilePath, import.meta.url).href);
    const scenario = scenarioModule.default ?? scenarioModule;

    process.stdout.write(`Running memory leak test: ${testName}\n`);

    try {
      ({ runResult } = await run({
        scenario,
        consoleMode,
        workDir,
        skipWarmup: process.env.MEMLAB_SKIP_WARMUP === 'true',
        debug: process.env.MEMLAB_DEBUG === 'true',
      }));

      const analyzer = new StringAnalysis();
      await analyze(runResult, analyzer);
    } finally {
      runResult?.cleanup();
    }
  }
})();
