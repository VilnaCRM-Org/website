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
  TRACE_COUNT_LIMIT,
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
  /** @type {Map<string, { cleanup: () => void }>} */
  const resultsByScenario = new Map();

  // Scenarios whose work dir must survive the run. Populated only once a verdict exists, so
  // an early exit leaves it empty and the `finally` below cleans up every scenario that
  // completed rather than stranding their heap snapshots on disk.
  //
  // One directory deliberately survives an error: a scenario that throws inside `run()` never
  // reaches `resultsByScenario`, so the `finally` cannot remove its partially written work
  // dir. That is the behaviour we want — a crash mid-scenario is exactly when the partial
  // snapshots are worth inspecting — and `ci-test-memory-leak` clears the results directory at
  // the start of the next run, so it cannot accumulate across runs.
  /** @type {Set<string>} */
  const keepWorkDirFor = new Set();

  try {
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
      resultsByScenario.set(testName, runResult);

      const analyzer = new StringAnalysis();
      await analyze(runResult, analyzer);
    }

    const today = new Date().toISOString().slice(0, 10);
    const verdict = evaluateLeakRun(clustersByScenario, baseline, today);
    for (const failure of verdict.failures) {
      keepWorkDirFor.add(failure.scenario);
    }

    // Print the retainer traces only for the scenarios that actually fail, so a red run is
    // directly actionable without burying it under the already-accepted clusters. memlab's
    // own VERBOSE output above carries the readable trace and retained sizes; these lines
    // identify which clusters the gate rejected.
    for (const failure of verdict.failures) {
      const traces = tracesByScenario[failure.scenario] ?? [];
      if (traces.length > 0) {
        const workDir = `${baseWorkDir}/${failure.scenario}`;
        // Cap the count as well as each trace's length. A regression on a scenario with a
        // large allowance (swaggerInteractions sits at 29) would otherwise print tens of KB,
        // most of it re-describing clusters the baseline already accepts.
        const shown = traces.slice(0, TRACE_COUNT_LIMIT);
        const suffix =
          traces.length > shown.length ? ` (first ${shown.length} of ${traces.length})` : '';
        write(`[memlab] retainer traces for ${failure.scenario}${suffix} (${workDir}):`);
        for (const trace of shown) {
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
  } finally {
    // `runResult.cleanup()` deletes the scenario's work dir (BaseResultReader calls
    // fs.removeSync on it), so it cannot run inside the loop: the traces above have to be
    // able to point a reader at a directory that still exists. Deferring it here keeps the
    // failing scenarios' snapshots for inspection while still removing every other one,
    // including on the error path.
    for (const [scenario, runResult] of resultsByScenario) {
      if (!keepWorkDirFor.has(scenario)) {
        runResult.cleanup();
      }
    }
  }
})();
