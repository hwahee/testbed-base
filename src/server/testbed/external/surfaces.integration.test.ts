/**
 * External cores on the surfaces (docs/spec.md §11 M14): the `replica` event
 * filter, the core log, and `testbed_info`'s replica lines — over the control
 * service, REST and MCP, with the fake core (3 replicas) next to the sample.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CoreLog } from '@shared/testbed/control';
import type { EventLine, TestbedEvent } from '@shared/testbed/events';

import { sampleCore } from '../testing/sample-core';
import { REPO_ROOT } from '../smoke/load';
import { startTestServer, waitForEvent } from '../testing';
import { defineExternalCore } from './define';

const FAKE = join(REPO_ROOT, 'src/server/testbed/external/fake-core.ts');
const human = { actor: 'human' as const };
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

async function boot() {
  const testbed = await startTestServer({
    cores: [
      sampleCore,
      defineExternalCore({
        id: 'fake',
        kind: 'passive',
        title: 'Fake',
        command: [process.execPath, FAKE],
      }),
    ],
    env: { FAKE_REPLICAS: '3' },
  });
  cleanups.push(testbed.stop);
  const transport = new StreamableHTTPClientTransport(new URL('/testbed/mcp', testbed.base));
  const client = new Client({ name: 'm14', version: '0.0.0' });
  await client.connect(transport);
  cleanups.push(() => client.close());
  const call = async (name: string, args: Record<string, unknown> = {}) =>
    (await client.callTool({ name, arguments: args })) as ToolResult;
  const rest = async <T>(path: string): Promise<{ status: number; body: T }> => {
    const response = await fetch(`${testbed.base}/testbed/api${path}`);
    return { status: response.status, body: (await response.json()) as T };
  };
  // Every replica emits one fake.thing.happened event.
  await testbed.plane.control.invokeAction('fake', 'emit', {}, human);
  await waitForEvent(
    testbed.runtime.bus,
    (event) => event.kind === 'fake.thing.happened' && event.replica === 'r2',
  );
  return { ...testbed, client, call, rest };
}

describe('the replica event filter', () => {
  test('control service, REST ?replica= and MCP query_events / wait_for / check', async () => {
    const { plane, call, rest, runtime } = await boot();

    const page = await plane.control.queryEvents(
      { kind: 'fake.thing.happened', replica: 'r1' },
      human,
    );
    expect(page.events.map((event) => event.replica)).toEqual(['r1']);

    const fromRest = await rest<{ events: TestbedEvent[] }>(
      '/events?kind=fake.thing.happened&replica=r0',
    );
    expect(fromRest.status).toBe(200);
    expect(fromRest.body.events.map((event) => event.replica)).toEqual(['r0']);

    const queried = await call('query_events', { kind: 'fake', replica: 'r1' });
    const lines = (queried.structuredContent as { events: EventLine[] }).events;
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const event = (await call('get_event', { id: line.id }))
        .structuredContent as unknown as TestbedEvent;
      expect(event.replica).toBe('r1');
    }

    const checked = await call('check', {
      filter: { kind: 'fake.thing.happened', replica: 'r2' },
      expect: { count: '==1' },
    });
    expect(checked.structuredContent).toMatchObject({ pass: true, matched: 1 });

    // r1 emits first, then r0: wait_for with replica r0 wakes on r0's only.
    const cursor = runtime.bus.buffered().at(-1)?.id;
    const waiting = call('wait_for', {
      filter: { kind: 'fake.thing.happened', replica: 'r0', after: cursor },
      timeoutMs: 5000,
    });
    await plane.control.invokeAction('fake', 'emit', {}, human, 'r1');
    await plane.control.invokeAction('fake', 'emit', {}, human, 'r0');
    const waited = (await waiting).structuredContent as { timedOut: boolean; events: EventLine[] };
    expect(waited.timedOut).toBe(false);
    expect(waited.events.map((line) => line.summary)).toEqual(['r0 emitted']);
  }, 20_000);
});

describe('the core log', () => {
  test('stderr lines per replica, masked; one replica; an in-proc core has none', async () => {
    const { plane, call, rest } = await boot();
    await plane.control.invokeAction(
      'fake',
      'stderr',
      { line: 'Authorization: Bearer sk-live-123456 and more' },
      human,
      'r1',
    );
    await plane.control.invokeAction('fake', 'stderr', { line: 'plain line' }, human, 'r1');

    const deadline = Date.now() + 3000;
    let log: CoreLog = plane.control.getCoreLog('fake', human, 'r1');
    while (!log.replicas[0]?.lines.includes('plain line') && Date.now() < deadline) {
      await Bun.sleep(20);
      log = plane.control.getCoreLog('fake', human, 'r1');
    }
    expect(log.external).toBe(true);
    expect(log.replicas.map((entry) => entry.replica)).toEqual(['r1']);
    const lines = log.replicas[0]?.lines ?? [];
    expect(lines).toContain('plain line');
    expect(lines.join('\n')).not.toContain('sk-live-123456');
    expect(lines.some((line) => line.startsWith('Authorization:'))).toBe(true);

    const all = await rest<CoreLog>('/cores/fake/log');
    expect(all.body.replicas.map((entry) => entry.replica)).toEqual(['r0', 'r1', 'r2']);
    const one = await rest<CoreLog>('/cores/fake/log?replica=r0');
    expect(one.body.replicas.map((entry) => entry.replica)).toEqual(['r0']);
    const unknown = await rest<{ error: { code: string } }>('/cores/fake/log?replica=r9');
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('VALIDATION_ERROR');

    const fromMcp = await call('get_core_log', { core: 'fake', replica: 'r1' });
    expect(fromMcp.content[0]?.text).toContain('fake r1 (');
    expect(fromMcp.content[0]?.text).toContain('  plain line');
    expect(fromMcp.content[0]?.text).not.toContain('sk-live-123456');

    const sample = await call('get_core_log', { core: 'sample' });
    expect(sample.structuredContent).toEqual({
      core: 'sample',
      external: false,
      replicas: [],
      note: 'in-proc 코어는 프로세스 로그가 없음',
    });
    expect(sample.content[0]?.text).toBe('sample: in-proc 코어는 프로세스 로그가 없음');
    const missing = await call('get_core_log', { core: 'nope' });
    expect(missing.isError).toBe(true);
  }, 20_000);
});

describe('testbed_info', () => {
  test('an external core line has its replica count and each replica', async () => {
    const { call, runtime } = await boot();
    const pids = (runtime.host.status('fake').replicas ?? []).map((replica) => replica.pid);
    const info = await call('testbed_info');
    expect(info.content[0]?.text).toContain(
      `fake running x3 (r0 running pid ${pids[0]}, r1 running pid ${pids[1]}, r2 running pid ${pids[2]})`,
    );
    expect(info.content[0]?.text).toMatch(/^sample running tcp:/m);
    const fake = (
      info.structuredContent as {
        cores: { id: string; external?: boolean; replicas?: { id: string }[] }[];
      }
    ).cores.find((core) => core.id === 'fake');
    expect(fake?.external).toBe(true);
    expect(fake?.replicas?.map((replica) => replica.id)).toEqual(['r0', 'r1', 'r2']);
  }, 20_000);
});

describe('counters after events', () => {
  test('an event makes the glue read that replica status again (not waiting for the 5 s ping), and the WS hub hears of the change', async () => {
    const { runtime, plane } = await boot();
    const calls = () => runtime.host.status('fake').replicas?.[1]?.counters.calls ?? -1;
    let changed = 0;
    const off = plane.control.onStatusChanged(() => {
      changed += 1;
    });
    // Let the refresh the boot's events asked for land first.
    await Bun.sleep(400);
    const before = calls();
    await plane.control.invokeAction('fake', 'emit', {}, human, 'r1');
    const deadline = Date.now() + 2000;
    while (calls() <= before && Date.now() < deadline) await Bun.sleep(20);
    expect(calls()).toBeGreaterThan(before);
    expect(changed).toBeGreaterThan(0);
    off();
  }, 20_000);
});
