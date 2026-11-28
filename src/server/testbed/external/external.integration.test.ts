/**
 * External cores, one replica (docs/spec.md §11 M11), with the fake core
 * (./fake-core.ts) run by `bun`.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import type { TestbedEvent } from '@shared/testbed/events';

import type { Logger } from '../../lib/log';
import { sampleCore } from '../testing/sample-core';
import { REPO_ROOT } from '../smoke/load';
import { startTestServer, waitForEvent } from '../testing';
import { defineExternalCore } from './define';
import { fakeInitializeResult } from './fake-core-spec';

const FAKE = join(REPO_ROOT, 'src/server/testbed/external/fake-core.ts');

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

function fakeCore(id = 'fake', command: readonly string[] = [process.execPath, FAKE]) {
  return defineExternalCore({ id, kind: 'passive', title: 'Fake core', command });
}

/** Records warnings, to see what the glue logs. */
function recordingLogger(): Logger & { warnings: string[] } {
  const warnings: string[] = [];
  return {
    warnings,
    debug: () => undefined,
    info: () => undefined,
    warn: (message, fields) => warnings.push(`${message} ${JSON.stringify(fields ?? {})}`),
    error: () => undefined,
  };
}

async function boot(
  options: {
    env?: Record<string, string>;
    cores?: Parameters<typeof startTestServer>[0] extends infer O
      ? O extends { cores?: infer C }
        ? C
        : never
      : never;
    log?: Logger;
  } = {},
) {
  const testbed = await startTestServer({
    cores: options.cores ?? [fakeCore()],
    env: options.env ?? {},
    ...(options.log === undefined ? {} : { log: options.log }),
  });
  cleanups.push(testbed.stop);
  const { runtime, plane, base } = testbed;
  const human = { actor: 'human' as const };
  const events = (kind: string) => runtime.bus.buffered().filter((event) => event.kind === kind);
  async function rest(method: string, path: string, body?: unknown) {
    const response = await fetch(`${base}/testbed/api${path}`, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }
  return { ...testbed, control: plane.control, host: runtime.host, human, events, rest };
}

/** Whether a process with this pid is still there. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function spawnedPid(events: TestbedEvent[]): number {
  return (events.at(-1)?.payload as { pid: number }).pid;
}

describe('an external core (one replica)', () => {
  test('normal: running at boot, spawned with a pid, the manifest is what initialize said', async () => {
    const { host, control, human, events } = await boot();
    expect(host.status('fake').state).toBe('running');
    const spawned = events('testbed.core.process.spawned');
    expect(spawned).toHaveLength(1);
    expect(spawned[0]).toMatchObject({ core: 'fake', replica: 'r0', actor: 'system' });
    expect(alive(spawnedPid(spawned))).toBe(true);

    const expected = fakeInitializeResult('normal', 'fake', {}) as {
      configSchema: unknown;
      actions: Record<
        string,
        { title: string; description: string; mutating: boolean; inputSchema: unknown }
      >;
      faults: string[];
    };
    const manifest = control.getManifest(human).cores.find((core) => core.id === 'fake');
    expect(manifest?.configSchema).toEqual(expected.configSchema as Record<string, unknown>);
    expect(manifest?.faults).toEqual(expected.faults as never);
    expect(manifest?.actions).toEqual(
      Object.entries(expected.actions).map(([name, action]) => ({
        name,
        title: action.title,
        description: action.description,
        mutating: action.mutating,
        surfaces: ['rest', 'mcp', 'ui'],
        inputSchema: action.inputSchema,
      })) as never,
    );
  });

  test('normal: an action answers, its events get core and replica, a fault becomes testbed.fault.injected', async () => {
    const { control, human, runtime } = await boot();
    expect(await control.invokeAction('fake', 'echo', { text: 'hi' }, human)).toEqual({
      text: 'hi',
      replica: 'r0',
    });

    await control.invokeAction('fake', 'emit', {}, human);
    const event = await waitForEvent(runtime.bus, (e) => e.kind === 'fake.thing.happened');
    expect(event).toMatchObject({
      core: 'fake',
      replica: 'r0',
      actor: 'product',
      correlationId: 'c-1',
    });
    // The glue masks secrets once more.
    expect(JSON.stringify(event.payload)).not.toContain('sk-secret-value-123');

    await control.invokeAction('fake', 'fault', {}, human);
    const fault = await waitForEvent(runtime.bus, (e) => e.kind === 'testbed.fault.injected');
    expect(fault).toMatchObject({ replica: 'r0', correlationId: 'c-1' });
    expect(fault.payload).toMatchObject({
      core: 'fake',
      ruleId: 'f1',
      effects: { disconnect: true },
    });
  });

  test('a config patch is checked against the schema from initialize', async () => {
    const { rest, control, human } = await boot();
    const bad = await rest('PATCH', '/cores/fake/config', { limit: 99 });
    expect(bad.status).toBe(400);
    expect((bad.body.error as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(await control.setConfig('fake', { limit: 7 }, human)).toMatchObject({
      result: 'applied',
      config: { limit: 7, replicas: 1, restart: 'on-failure' },
    });
    // A fault kind the core did not declare.
    const unsupported = await rest('PATCH', '/cores/fake/config', {
      faults: [{ id: 'f1', corrupt: true }],
    });
    expect(unsupported.status).toBe(400);
    // A key neither the core's schema nor the glue has.
    const unknown = await rest('PATCH', '/cores/fake/config', { limt: 3 });
    expect(unknown.status).toBe(400);
    expect(JSON.stringify(unknown.body)).toContain('unknown_key');
    expect(control.getConfig('fake', human)).toMatchObject({ limit: 7 });
  });

  test('stop leaves the process alive; start runs it again with the same pid', async () => {
    const { control, human, host, events } = await boot();
    const pid = spawnedPid(events('testbed.core.process.spawned'));
    await control.stop('fake', human);
    expect(host.status('fake').state).toBe('stopped');
    expect(alive(pid)).toBe(true);
    await control.start('fake', human);
    expect(host.status('fake').state).toBe('running');
    expect(events('testbed.core.process.spawned')).toHaveLength(1);
    expect(alive(pid)).toBe(true);
  });

  test('every Run opened and closed reaches the core as runChanged, with <seed>:r0', async () => {
    const { control, human, runtime } = await boot();
    const bootSeed = runtime.runs.bootSeed();
    const run = await control.startRun(
      { label: 'm11', seed: 'abc' },
      { actor: 'ci', leaseId: 'l' },
    );
    await control.endRun({ actor: 'ci', leaseId: 'l' });
    await Bun.sleep(50);
    const seen = (await control.invokeAction('fake', 'seen', {}, human)) as {
      seeds: string[];
      runIds: (string | null)[];
    };
    expect(seen.seeds).toEqual([`${bootSeed}:r0`, 'abc:r0', `${bootSeed}:r0`]);
    expect(seen.runIds).toEqual([null, run.runId, null]);
  });

  test('wrong-kind and reserved-field: that core is in error with the reason; sample is fine', async () => {
    const { host } = await boot({
      cores: [sampleCore, fakeCore('fake'), fakeCore('fake-b')],
      env: { FAKE_MODE: 'wrong-kind', FAKE_B_MODE: 'reserved-field' },
    });
    expect(host.status('fake')).toMatchObject({ state: 'error' });
    expect(host.status('fake').detail).toContain(
      'kind "active" differs from the declared \'passive\'',
    );
    expect(host.status('fake-b')).toMatchObject({ state: 'error' });
    expect(host.status('fake-b').detail).toContain('reserves: replicas');
    expect(host.status('sample').state).toBe('running');
  });

  test('bad-stdout: both lines are dropped with a warning; the core keeps running', async () => {
    const log = recordingLogger();
    const { host, control, human } = await boot({ env: { FAKE_MODE: 'bad-stdout' }, log });
    expect(await control.invokeAction('fake', 'echo', { text: 'still' }, human)).toEqual({
      text: 'still',
      replica: 'r0',
    });
    expect(host.status('fake').state).toBe('running');
    const dropped = log.warnings.filter((line) =>
      line.startsWith('external core wrote a non-protocol line'),
    );
    expect(dropped.some((line) => line.includes('not JSON'))).toBe(true);
    expect(dropped.some((line) => line.includes('line over 1048576 bytes'))).toBe(true);
  });

  test('slow-action: CORE_TIMEOUT (504); the core keeps running', async () => {
    const { rest, control, human, host } = await boot({ env: { FAKE_MODE: 'slow-action' } });
    await control.setConfig('fake', { requestTimeoutMs: 1000 }, human);
    const slow = await rest('POST', '/cores/fake/actions/echo', { text: 'late' });
    expect(slow.status).toBe(504);
    expect((slow.body.error as { code: string }).code).toBe('CORE_TIMEOUT');
    expect(host.status('fake').state).toBe('running');
  }, 10_000);

  test("a core's own error code becomes CORE_ERROR (502) with coreCode; VALIDATION_ERROR stays 400", async () => {
    const { rest } = await boot();
    const oops = await rest('POST', '/cores/fake/actions/fail', { code: 'OOPS' });
    expect(oops.status).toBe(502);
    expect(oops.body.error).toMatchObject({ code: 'CORE_ERROR', details: { coreCode: 'OOPS' } });
    const invalid = await rest('POST', '/cores/fake/actions/fail', { code: 'VALIDATION_ERROR' });
    expect(invalid.status).toBe(400);
    expect((invalid.body.error as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  test('print-env: PATH and FAKE_* reach the core, TESTBED_CONTROL_TOKEN does not', async () => {
    const { runtime } = await boot({
      env: { FAKE_MODE: 'print-env', FAKE_EXTRA: 'x', TESTBED_CONTROL_TOKEN: 'secret-token' },
    });
    const listed = await waitForEvent(runtime.bus, (event) => event.kind === 'fake.env.listed');
    const names = (listed.payload as { names: string[] }).names;
    expect(names).toContain('PATH');
    expect(names).toContain('FAKE_MODE');
    expect(names).toContain('FAKE_EXTRA');
    expect(names).not.toContain('TESTBED_CONTROL_TOKEN');
    expect(names.filter((name) => name.startsWith('TESTBED_'))).toEqual([]);
  });

  test('a command that does not exist: error with ENOENT, and the core is still in the manifest', async () => {
    const { host, control, human } = await boot({
      cores: [sampleCore, fakeCore('ghost', ['no-such-command-for-testbed'])],
    });
    expect(host.status('ghost').state).toBe('error');
    expect(host.status('ghost').detail).toContain('ENOENT');
    const manifest = control.getManifest(human).cores.find((core) => core.id === 'ghost');
    expect(manifest).toMatchObject({
      id: 'ghost',
      kind: 'passive',
      title: 'Fake core',
      state: 'error',
      actions: [],
    });
    // start tries the process again.
    await control.start('ghost', human);
    expect(host.status('ghost').state).toBe('error');
  });
});

describe('server shutdown', () => {
  test('no fake core process is left', async () => {
    const testbed = await startTestServer({ cores: [fakeCore()] });
    const pid = spawnedPid(
      testbed.runtime.bus
        .buffered()
        .filter((event) => event.kind === 'testbed.core.process.spawned'),
    );
    expect(alive(pid)).toBe(true);
    await testbed.stop();
    expect(alive(pid)).toBe(false);
  });

  test('ignore-shutdown: SIGKILL ends it within shutdownGraceMs × 2', async () => {
    const testbed = await startTestServer({
      cores: [fakeCore()],
      env: { FAKE_MODE: 'ignore-shutdown' },
    });
    await testbed.plane.control.setConfig('fake', { shutdownGraceMs: 300 }, { actor: 'human' });
    const pid = spawnedPid(
      testbed.runtime.bus
        .buffered()
        .filter((event) => event.kind === 'testbed.core.process.spawned'),
    );
    const started = performance.now();
    await testbed.stop();
    const elapsed = performance.now() - started;
    expect(alive(pid)).toBe(false);
    expect(elapsed).toBeLessThan(300 * 2 + 500);
  }, 10_000);
});
