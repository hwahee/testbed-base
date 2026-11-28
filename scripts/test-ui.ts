/**
 * `bun run test:ui` — the Playwright UI tests (docs/testbed/verification.md §5).
 *
 * Boots this repo's server on a free port the same way the MCP smoke does
 * (`TESTBED_RUN_STORE=memory`, every core port at 0) with the testbed's own
 * preparation (`e2e/testbed.ts`: env and `prepare()`), runs `playwright test`
 * against it with any arguments given here, then stops the server. The common
 * runtime's variant instances (the Python one) do not get that preparation.
 *
 * Test 9 needs the Python example core: with `python3` (3.11+) a second
 * instance runs with `TESTBED_EXAMPLE_CORES=py-echo PY_ECHO_REPLICAS=2` and
 * its address goes in `TESTBED_UI_PY_URL`. Without it the test is skipped,
 * or fails when `TESTBED_REQUIRE_PYTHON=1` (`TESTBED_UI_PYTHON_MISSING` says why).
 *
 *   bun run test:ui                 # all tests
 *   bun run test:ui -g "lease"      # by title
 */
import { startSetupTestbed } from '../e2e/support/testbed-setup';
import { setup } from '../e2e/testbed';
import { missingPython } from '../examples/python-core/python-check';
import {
  startLocalTestbed,
  StartError,
  type LocalTestbed,
} from '../src/server/testbed/smoke/server';

const running: LocalTestbed[] = [];

async function start(
  env?: Record<string, string>,
  options: { setup?: boolean } = {},
): Promise<LocalTestbed> {
  try {
    const testbed =
      options.setup === true
        ? await startSetupTestbed(setup)
        : await startLocalTestbed(env === undefined ? {} : { env });
    running.push(testbed);
    return testbed;
  } catch (error) {
    console.error(error instanceof StartError ? error.message : String(error));
    for (const testbed of running) await testbed.stop();
    process.exit(2);
  }
}

const testbed = await start(undefined, { setup: true });
const missing = missingPython();
const python =
  missing === undefined
    ? await start({ TESTBED_EXAMPLE_CORES: 'py-echo', PY_ECHO_REPLICAS: '2' })
    : undefined;

const child = Bun.spawn(['bunx', 'playwright', 'test', ...Bun.argv.slice(2)], {
  env: {
    ...process.env,
    TESTBED_UI_URL: testbed.url,
    ...(python === undefined ? {} : { TESTBED_UI_PY_URL: python.url }),
    ...(missing === undefined ? {} : { TESTBED_UI_PYTHON_MISSING: missing }),
  },
  stdout: 'inherit',
  stderr: 'inherit',
});
const code = await child.exited;
for (const instance of running) await instance.stop();
process.exit(code);
