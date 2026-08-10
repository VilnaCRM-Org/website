import fs from 'node:fs';
import path from 'node:path';

import './utils/initializeLocalization.js';
import memlabApi from '@memlab/api';
import heapAnalysis from '@memlab/heap-analysis';

import {
  evaluateLeakRun,
  formatVerdict,
  summarizeTrace,
  TRACE_CHAR_LIMIT,
} from './utils/leakGate.js';

const { run, analyze } = memlabApi;
const { StringAnalysis } = heapAnalysis;

const memoryLeakDir = './src/test/memory-leak';
const testsDir = './tests';

const baseWorkDir = './src/test/memory-leak/results';
const consoleMode = 'VERBOSE';

/**
 * Accepted-debt allowances for clusters that already existed when the gate was armed
 * (issue #354). Every entry is time-boxed; see `utils/leakGate.js` for the rules.
 */
const baseline = JSON.parse(
  fs.readFileSync(new URL('./leak-baseline.json', import.meta.url), 'utf8')
);

/** eslint forbids `console` in this layer, so findings go straight to the stream. */
function write(line) {
  process.stderr.write(`${line}\n`);
}

(async function runMemlab() {
  const testFilePaths = fs
    .readdirSync(`${memoryLeakDir}/${testsDir}`)
    // Only executable `.js` scenarios — skip co-located type declarations such as
    // `logoNavigation.d.ts` (added so the unit test can import the scenario under
    // `allowJs: false`); a `.d.ts` has no runtime body and would throw when imported.
    .filter(test => test.endsWith('.js'))
    .map(test => `${testsDir}/${test}`);

  /** @type {Record<string, number>} */
  const clustersByScenario = {};
  /** @type {Record<string, unknown[]>} */
  const tracesByScenario = {};

  for (const testFilePath of testFilePaths) {
    const testName = path.basename(testFilePath, '.js');
    const workDir = `${baseWorkDir}/${testName}`;

    const scenarioModule = await import(new URL(testFilePath, import.meta.url).href);
    const scenario = scenarioModule.default ?? scenarioModule;

    // `leaks` holds one entry per clustered leak trace. Discarding it (as this runner did
    // before #354) is what made the job report-only.
    const { leaks, runResult } = await run({
      scenario,
      consoleMode,
      workDir,
      skipWarmup: process.env.MEMLAB_SKIP_WARMUP === 'true',
      debug: process.env.MEMLAB_DEBUG === 'true',
    });

    clustersByScenario[testName] = leaks.length;
    tracesByScenario[testName] = leaks;

    const analyzer = new StringAnalysis();
    await analyze(runResult, analyzer);

    runResult.cleanup();
  }

  const today = new Date().toISOString().slice(0, 10);
  const verdict = evaluateLeakRun(clustersByScenario, baseline, today);

  // Print the retainer traces only for the scenarios that actually fail, so a red run is
  // directly actionable without burying it under the already-accepted clusters. memlab's
  // own VERBOSE output above carries the readable trace and retained sizes; these lines
  // identify which clusters the gate rejected.
  for (const failure of verdict.failures) {
    const traces = tracesByScenario[failure.scenario] ?? [];
    if (traces.length > 0) {
      const workDir = `${baseWorkDir}/${failure.scenario}`;
      write(`[memlab] retainer traces for ${failure.scenario} (${workDir}):`);
      for (const trace of traces) {
        write(summarizeTrace(trace, TRACE_CHAR_LIMIT));
      }
    }
  }

  for (const line of formatVerdict(verdict)) {
    write(line);
  }

  if (!verdict.ok) {
    process.exitCode = 1;
  }
})();
