/**
 * The testbed's UI setup reaches the server it starts (docs/spec.md §11 M15):
 * the env values and what `prepare()` returns are in the server process's
 * environment, read from `/proc/<pid>/environ` (Linux) — not through the
 * manifest or a test-only route.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { resolveSetup, startSetupTestbed, type UiTestbedSetup } from './testbed-setup';

const stops: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const stop of stops.splice(0)) await stop();
});

async function processEnv(pid: number): Promise<Record<string, string>> {
  const raw = await readFile(`/proc/${pid}/environ`, 'utf8');
  return Object.fromEntries(
    raw
      .split('\0')
      .filter(Boolean)
      .map((pair) => [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)]),
  );
}

describe('UI test setup (e2e/testbed.ts)', () => {
  test('env, then what prepare() returns; the temporary directory goes with cleanup', async () => {
    let seen = '';
    const { env, cleanup } = await resolveSetup({
      env: { A: '1', B: 'env' },
      prepare: ({ rootDir, tmpDir }) => {
        seen = tmpDir;
        expect(existsSync(`${rootDir}/package.json`)).toBe(true);
        return { B: 'prepared', DIR: tmpDir };
      },
    });
    expect(env).toEqual({ A: '1', B: 'prepared', DIR: seen });
    expect(existsSync(seen)).toBe(true);
    await cleanup();
    expect(existsSync(seen)).toBe(false);
  });

  test.skipIf(process.platform !== 'linux')(
    'TESTBED_UI_PROBE=1 in the setup is in the started server’s environment',
    async () => {
      let tmp = '';
      const setup: UiTestbedSetup = {
        env: { TESTBED_UI_PROBE: '1' },
        prepare: ({ tmpDir }) => {
          tmp = tmpDir;
          return { TESTBED_UI_PREPARED: tmpDir };
        },
      };
      const testbed = await startSetupTestbed(setup);
      stops.push(() => testbed.stop());
      const env = await processEnv(testbed.pid);
      expect(env.TESTBED_UI_PROBE).toBe('1');
      expect(env.TESTBED_UI_PREPARED).toBe(tmp);
      await testbed.stop();
      expect(existsSync(tmp)).toBe(false);
    },
    30_000,
  );
});
