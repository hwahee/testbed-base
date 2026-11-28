/**
 * The testbed's own preparation of the server the UI tests (`bun run test:ui`)
 * and the screen capture start (docs/testbed/verification.md §5): extra env
 * values, and a step run once before the server starts. The testbed writes
 * its setup in `e2e/testbed.ts`; this file is the common runtime's.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { REPO_ROOT } from '../../src/server/testbed/smoke/load';
import { startLocalTestbed, type LocalTestbed } from '../../src/server/testbed/smoke/server';

export interface UiTestbedSetup {
  /** Added to the server's env. A relative path is from the repository root (the server's cwd). */
  env?: Record<string, string>;
  /**
   * Run once before the server starts (e.g. copy synthetic fixture data into
   * `tmpDir`); the env values it returns are added on top of `env`.
   */
  prepare?(context: {
    rootDir: string;
    tmpDir: string;
  }): Promise<Record<string, string> | void> | Record<string, string> | void;
}

/** The env a setup gives: `env`, then what `prepare` returned. `tmpDir` is removed by `cleanup`. */
export async function resolveSetup(
  setup: UiTestbedSetup,
  rootDir = REPO_ROOT,
): Promise<{ env: Record<string, string>; cleanup: () => Promise<void> }> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'testbed-ui-'));
  const cleanup = () => rm(tmpDir, { recursive: true, force: true });
  try {
    const prepared = (await setup.prepare?.({ rootDir, tmpDir })) ?? {};
    return { env: { ...setup.env, ...prepared }, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/**
 * The `main` UI test server: this repository's cores and layout, with the
 * testbed's setup applied (the common runtime's variant instances do not get it).
 */
export async function startSetupTestbed(
  setup: UiTestbedSetup,
  env: Record<string, string> = {},
): Promise<LocalTestbed> {
  const resolved = await resolveSetup(setup);
  try {
    const testbed = await startLocalTestbed({ env: { ...env, ...resolved.env } });
    return {
      ...testbed,
      stop: async () => {
        await testbed.stop();
        await resolved.cleanup();
      },
    };
  } catch (error) {
    await resolved.cleanup();
    throw error;
  }
}
