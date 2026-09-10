/**
 * Command-line entry point for the ui-toolkit integrity gate.
 *
 * Deliberately the only file that touches `process`: keeping the decision logic
 * in `verifyUiToolkit.mjs` behind an injectable io seam is what lets every
 * pass/fail branch be driven from a spec instead of a subprocess.
 */
import { main } from './verifyUiToolkit.mjs';

process.exit(
  main({
    stdout: text => process.stdout.write(text),
    stderr: text => process.stderr.write(text),
  })
);
