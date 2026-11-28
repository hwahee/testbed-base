/**
 * The smoke itself (docs/spec.md §11 M6): the runner against the app on an
 * ephemeral port, and the CLI's exit codes and JSON report.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sampleCore } from '../testing/sample-core';
import { startTestServer } from '../testing';
import { defineSmoke } from './index';
import { loadScenarios, REPO_ROOT } from './load';
import { runSmoke, type LoadedScenario, type SmokeReport } from './runner';

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function startTestbed() {
  const testbed = await startTestServer({ cores: [sampleCore] });
  cleanups.push(testbed.stop);
  return testbed;
}

async function smoke(url: string, scenarios: readonly LoadedScenario[], only?: string) {
  const lines: string[] = [];
  const report = await runSmoke({
    target: { url },
    scenarios,
    ...(only === undefined ? {} : { only }),
    log: (line) => lines.push(line),
  });
  return { report, lines };
}

const status = (report: SmokeReport) =>
  Object.fromEntries(report.scenarios.map((result) => [result.name, result.status]));

/** `sample-echo` with a wrong expectation (the spec's "temporary edit"). */
const brokenEcho = defineSmoke({
  name: 'sample-echo',
  title: 'expects the wrong bytes on purpose',
  spec: 'docs/spec.md §11 M6',
  requires: { cores: ['sample'] },
  async run(t) {
    await t.call('start_run', { label: 'smoke:broken' });
    await t.call('acquire_control');
    const echo = await t.tcp(t.endpoint('sample', 'echo'));
    echo.send('hello');
    t.equal(await echo.receive(5), 'HELLO', 'echoed bytes');
    await t.call('end_run', {});
  },
});

describe('runSmoke', () => {
  test('the shipped scenarios: common check and 4 scenarios PASS, py-echo SKIP (not turned on), coverage PASS', async () => {
    const { base } = await startTestbed();
    // The common runtime's own scenarios; a testbed's (cores/<id>/smoke) come on top.
    const scenarios = (await loadScenarios()).filter(
      (scenario) =>
        scenario.file?.startsWith('src/server/testbed/testing/sample-core/') === true ||
        scenario.file?.startsWith('examples/') === true,
    );
    expect(scenarios.map((scenario) => scenario.file)).toEqual([
      'src/server/testbed/testing/sample-core/smoke/sample-broadcast.smoke.ts',
      'src/server/testbed/testing/sample-core/smoke/sample-echo.smoke.ts',
      'src/server/testbed/testing/sample-core/smoke/sample-faults.smoke.ts',
      'src/server/testbed/testing/sample-core/smoke/sample-run-replace.smoke.ts',
      'examples/python-core/smoke/py-echo.smoke.ts',
    ]);
    const { report, lines } = await smoke(base, scenarios);
    expect(report.common.status).toBe('PASS');
    expect(status(report)).toEqual({
      'py-echo': 'SKIP',
      'sample-broadcast': 'PASS',
      'sample-echo': 'PASS',
      'sample-faults': 'PASS',
      'sample-run-replace': 'PASS',
    });
    expect(report.coverage).toMatchObject({
      status: 'PASS',
      actions: ['sample_broadcast'],
      missing: [],
    });
    expect(report.ok).toBe(true);
    expect(lines).toContain('SKIP py-echo (0ms) — requires core py-echo');
    expect(lines.at(-1)).toBe('total: 5 pass, 0 fail, 1 skip; coverage PASS');
  }, 30_000);

  test('a failing scenario: FAIL with step and message, the rest still run, its Run and lease cleaned up', async () => {
    const { base, plane } = await startTestbed();
    const scenarios = (await loadScenarios()).map((scenario) =>
      scenario.definition.name === 'sample-echo'
        ? { ...scenario, definition: brokenEcho }
        : scenario,
    );
    const { report, lines } = await smoke(base, scenarios);
    const failed = report.scenarios.find((result) => result.name === 'sample-echo');
    expect(failed).toMatchObject({
      status: 'FAIL',
      step: 'equal (echoed bytes)',
      message: 'expected "HELLO", got "hello"',
    });
    expect(lines).toContain(
      `FAIL sample-echo (${failed?.durationMs}ms) at equal (echoed bytes): expected "HELLO", got "hello"`,
    );
    expect(status(report)).toMatchObject({
      'sample-faults': 'PASS',
      'sample-run-replace': 'PASS',
    });
    expect(report.ok).toBe(false);
    const after = plane.control.status();
    expect(after.run).toBeNull();
    expect(after.lease).toBeNull();
  }, 30_000);

  test('a scenario that requires a missing core is SKIP, and that is still ok', async () => {
    const { base } = await startTestbed();
    const scenarios = [
      ...(await loadScenarios()),
      {
        definition: defineSmoke({
          name: 'needs-nope',
          title: 'needs a core this testbed lacks',
          spec: 'docs/spec.md §11 M6',
          requires: { cores: ['nope'] },
          run: () => Promise.reject(new Error('must not run')),
        }),
      },
    ];
    const { report, lines } = await smoke(base, scenarios);
    expect(report.scenarios.find((result) => result.name === 'needs-nope')).toMatchObject({
      status: 'SKIP',
      reason: 'requires core nope',
    });
    expect(lines).toContain('SKIP needs-nope (0ms) — requires core nope');
    expect(report.ok).toBe(true);
  }, 30_000);

  test('without sample-broadcast the coverage fails: sample_broadcast was never called', async () => {
    const { base } = await startTestbed();
    const scenarios = (await loadScenarios()).filter(
      (scenario) => scenario.definition.name !== 'sample-broadcast',
    );
    const { report, lines } = await smoke(base, scenarios);
    expect(report.scenarios.every((result) => result.status !== 'FAIL')).toBe(true);
    expect(report.coverage).toMatchObject({ status: 'FAIL', missing: ['sample_broadcast'] });
    expect(lines).toContain('FAIL coverage — not called by any scenario: sample_broadcast');
    expect(report.ok).toBe(false);
  }, 30_000);

  test('--only runs one scenario after the common check and skips the coverage', async () => {
    const { base } = await startTestbed();
    const { report } = await smoke(base, await loadScenarios(), 'sample-echo');
    expect(report.common.status).toBe('PASS');
    expect(status(report)).toEqual({ 'sample-echo': 'PASS' });
    expect(report.coverage.status).toBe('SKIP');
    expect(report.ok).toBe(true);
  }, 30_000);

  test('a scenario over its time limit fails and is cleaned up', async () => {
    const { base, plane } = await startTestbed();
    const slow = defineSmoke({
      name: 'slow',
      title: 'never ends',
      spec: 'docs/spec.md §11 M6',
      timeoutMs: 300,
      async run(t) {
        await t.call('start_run', { label: 'smoke:slow' });
        await t.call('wait_for', { filter: { kind: 'never.comes' }, timeoutMs: 10_000 });
      },
    });
    const { report } = await smoke(base, [{ definition: slow }]);
    expect(report.scenarios[0]).toMatchObject({
      status: 'FAIL',
      step: 'call wait_for',
      message: 'timed out after 300ms',
    });
    expect(plane.control.status().run).toBeNull();
    expect(plane.control.status().lease).toBeNull();
  }, 30_000);
});

describe('bun run testbed:smoke', () => {
  const cli = (args: string[]) =>
    Bun.spawn([process.execPath, 'scripts/testbed-smoke.ts', ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, TESTBED_CONTROL_TOKEN: '' },
      stdout: 'pipe',
      stderr: 'pipe',
    });

  test('boots its own server; exit 0 and the JSON report', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'testbed-smoke-'));
    cleanups.push(() => rm(dir, { recursive: true, force: true }));
    const out = join(dir, 'out.json');
    const child = cli(['--json', out]);
    expect(await child.exited).toBe(0);
    const json = JSON.parse(await readFile(out, 'utf8')) as SmokeReport & { exitCode: number };
    expect(json.exitCode).toBe(0);
    expect(json.common.status).toBe('PASS');
    // Which scenarios ship and which cores run them is the testbed's choice:
    // every shipped scenario is reported, and none fails.
    const shipped = (await loadScenarios()).map((scenario) => scenario.definition.name).sort();
    expect(json.scenarios.map((result) => result.name).sort()).toEqual(shipped);
    expect(json.scenarios.filter((result) => result.status === 'FAIL')).toEqual([]);
    expect(json.coverage.status).toBe('PASS');
  }, 60_000);

  test('--url at a running instance passes the same way', async () => {
    const { base } = await startTestbed();
    const child = cli(['--url', base]);
    expect(await child.exited).toBe(0);
    const stdout = await new Response(child.stdout).text();
    // A testbed's own scenarios SKIP here (this server runs the sample core only).
    expect(stdout).toMatch(/total: 5 pass, 0 fail, \d+ skip; coverage PASS/);
  }, 60_000);

  test('nothing answering at --url is exit 2', async () => {
    const probe = Bun.listen({
      hostname: '127.0.0.1',
      port: 0,
      socket: { data: () => undefined },
    });
    const { port } = probe;
    probe.stop(true);
    const child = cli(['--url', `http://127.0.0.1:${port}`]);
    expect(await child.exited).toBe(2);
    expect(await new Response(child.stderr).text()).toContain('no testbed at');
  }, 30_000);
});
