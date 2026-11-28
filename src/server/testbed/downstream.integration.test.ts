/**
 * The downstream simulation (docs/spec.md §11 M15): a testbed repository that
 * only did what the guide says — renamed the package, moved the port block,
 * dropped the sample core from `CORES` for a core of its own — must still pass
 * the common runtime's tests. In a temporary copy of this working tree:
 * `name` → `testbed-demo`, `PORT_BLOCK` → 40990, `CORES` → the observer core;
 * then `bun test` (no Python tests), `bun run testbed:smoke` and, with
 * `TESTBED_DOWNSTREAM_UI=1`, `bun run test:ui`.
 *
 * It takes minutes, so it runs only with `TESTBED_DOWNSTREAM=1`
 * (`bun run test:downstream`; CI runs it). The copy does not set it, so the
 * copy does not run itself.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { REPO_ROOT } from './smoke/load';

const ON = process.env.TESTBED_DOWNSTREAM === '1';
const UI = process.env.TESTBED_DOWNSTREAM_UI === '1';

let copy = '';

/** The env the copy's commands run with: none of this run's switches. */
function copyEnv(): Record<string, string | undefined> {
  const {
    TESTBED_DOWNSTREAM: _on,
    TESTBED_DOWNSTREAM_UI: _ui,
    TESTBED_REQUIRE_PYTHON: _python,
    ...rest
  } = process.env;
  return { ...rest, TESTBED_SKIP_PYTHON: '1' };
}

async function run(command: string[]): Promise<{ code: number; output: string }> {
  const child = Bun.spawn(command, {
    cwd: copy,
    env: copyEnv(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { code, output: `${stdout}\n${stderr}` };
}

/** The last lines, for a failure message. */
function tail(output: string, lines = 60): string {
  return output.trim().split('\n').slice(-lines).join('\n');
}

describe.skipIf(!ON)('a downstream testbed (temporary copy)', () => {
  beforeAll(async () => {
    copy = await mkdtemp(join(tmpdir(), 'testbed-downstream-'));
    const listed = Bun.spawnSync(['git', 'ls-files', '-co', '--exclude-standard', '-z'], {
      cwd: REPO_ROOT,
    });
    const files = listed.stdout.toString().split('\0').filter(Boolean);
    for (const file of files) {
      if (file.startsWith('.claude/')) continue;
      await mkdir(dirname(join(copy, file)), { recursive: true });
      await cp(join(REPO_ROOT, file), join(copy, file)).catch(() => undefined);
    }
    await symlink(join(REPO_ROOT, 'node_modules'), join(copy, 'node_modules'));

    const pkg = JSON.parse(await readFile(join(copy, 'package.json'), 'utf8')) as {
      name: string;
    };
    pkg.name = 'testbed-demo';
    await writeFile(join(copy, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
    const block = join(copy, 'src/server/testbed/cores/port-block.ts');
    await writeFile(
      block,
      (await readFile(block, 'utf8')).replace(/PORT_BLOCK = \d+/, 'PORT_BLOCK = 40990'),
    );
    await writeFile(
      join(copy, 'src/server/testbed/cores/index.ts'),
      [
        "import type { AnyCoreDefinition } from '../core-host';",
        "import { observerCore } from '../testing/observer-core';",
        '',
        'export const CORES: readonly AnyCoreDefinition[] = [observerCore];',
        '',
      ].join('\n'),
    );
  }, 120_000);

  afterAll(async () => {
    if (copy !== '') await rm(copy, { recursive: true, force: true });
  });

  test('bun test (without the Python tests) passes', async () => {
    const { code, output } = await run(['bun', 'test']);
    expect(code, tail(output)).toBe(0);
    console.log(
      `downstream bun test: ${/\d+ pass\n\s*\d+ skip\n\s*\d+ fail|\d+ pass\n\s*\d+ fail/.exec(output)?.[0].replace(/\s+/g, ' ') ?? '?'}`,
    );
    // The common tests really ran there.
    expect(Number(/(\d+) pass/.exec(output)?.[1] ?? 0)).toBeGreaterThan(200);
    expect(output).toMatch(/\b0 fail/);
  }, 600_000);

  test('bun run testbed:smoke passes; the sample scenarios SKIP', async () => {
    const { code, output } = await run(['bun', 'run', 'testbed:smoke']);
    expect(code, tail(output)).toBe(0);
    expect(output).toContain('PASS observer-peek');
    expect(output).toMatch(/SKIP sample-echo/);
  }, 300_000);

  test.skipIf(!UI)(
    'bun run test:ui: the sample-core tests skip with the reason, nothing fails',
    async () => {
      const { code, output } = await run(['bun', 'run', 'test:ui']);
      expect(code, tail(output)).toBe(0);
      expect(output).toContain('the sample core is not registered on this instance');
      expect(output).not.toMatch(/\d+ failed/);
      // Until M19 every UI test assumes the sample core, so all of them skip here.
      expect(output).toMatch(/\d+ skipped/);
      console.log(
        `downstream test:ui: ${/\d+ (passed|skipped)[\s\S]*$/.exec(output)?.[0].replace(/\s+/g, ' ') ?? '?'}`,
      );
    },
    600_000,
  );
});
