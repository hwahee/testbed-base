/**
 * Sample core over real sockets (docs/spec.md §11 M3). Ports are 0 and the
 * address comes from `status().endpoints`; time-dependent checks wait on events.
 */
import { afterEach, describe, expect, test } from 'bun:test';

import type { TestbedEvent } from '@shared/testbed/events';
import { ValidationError } from '@shared/validation';

import { silentLogger } from '../../../lib/log';
import { CoreHost } from '../../core-host';
import { TestbedError } from '../../errors';
import { EventBus } from '../../events/bus';
import { createMemoryRunStore } from '../../runs/memory-store';
import { RunManager } from '../../runs/runs';
import { TcpClient, waitForEvent } from '..';
import { sampleCore } from '.';

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function boot(config: Record<string, unknown> = {}, env: Record<string, string> = {}) {
  const bus = new EventBus({ instanceId: 'test' });
  const runs = new RunManager(bus, createMemoryRunStore(), { bootSeed: 'sample-test' });
  const host = new CoreHost({ bus, runs, log: silentLogger, env: { SAMPLE_PORT: '0', ...env } });
  host.register(sampleCore);
  if (Object.keys(config).length > 0) await host.setConfig('sample', config);
  await host.start('sample');
  cleanups.push(() => host.stopAll());
  const url = () => host.status('sample').endpoints[0]?.url ?? '';
  const connect = async () => {
    const client = await TcpClient.connect(url());
    cleanups.push(() => Promise.resolve(client.close()));
    return client;
  };
  const kinds = (prefix = 'sample.') =>
    bus
      .buffered()
      .filter((event) => event.kind.startsWith(prefix))
      .map((event) => event.kind);
  const waitKind = (kind: string, where: (event: TestbedEvent) => boolean = () => true) =>
    waitForEvent(bus, (event) => event.kind === kind && where(event));
  return { bus, runs, host, url, connect, kinds, waitKind };
}

const payload = <T>(event: TestbedEvent) => event.payload as T;

describe('sample core — echo', () => {
  test('32 bytes go out and the same 32 come back; opened then echoed (with latencyMs)', async () => {
    const { connect, kinds, waitKind, url } = await boot();
    expect(url()).toMatch(/^tcp:\/\/localhost:\d+$/);
    const client = await connect();
    const data = new Uint8Array(32).map((_, i) => i * 7);
    client.send(data);
    expect(await client.receive(32)).toEqual(data);

    const echoed = await waitKind('sample.data.echoed');
    expect(echoed.latencyMs).toBeNumber();
    expect(echoed).toMatchObject({ correlationId: 'c-1', actor: 'product', level: 'info' });
    expect(echoed.summary).toMatch(/^c-1 echoed 32B in \d+ms$/);
    expect(kinds()).toEqual(['sample.connection.opened', 'sample.data.echoed']);
  });

  test('received is emitted only with eventLevel debug', async () => {
    const { connect, kinds, waitKind } = await boot({ eventLevel: 'debug' });
    const client = await connect();
    client.send('hello');
    await waitKind('sample.data.echoed');
    expect(kinds()).toEqual([
      'sample.connection.opened',
      'sample.data.received',
      'sample.data.echoed',
    ]);
  });

  test('maxConnections 1: a second connection is closed at once and rejected (warn)', async () => {
    const { connect, waitKind } = await boot({ maxConnections: 1 });
    await connect();
    await waitKind('sample.connection.opened');
    const second = await connect();
    await second.closed;
    const rejected = await waitKind('sample.connection.rejected');
    expect(rejected.level).toBe('warn');
    expect(payload<{ max: number }>(rejected).max).toBe(1);
  });

  test('maxChunkBytes 16: 32 bytes → no echo, too-large, closed(too-large)', async () => {
    const { connect, waitKind, kinds } = await boot({ maxChunkBytes: 16 });
    const client = await connect();
    client.send(new Uint8Array(32));
    await client.closed;
    expect(client.bytes().byteLength).toBe(0);
    expect((await waitKind('sample.data.too-large')).level).toBe('warn');
    const closed = await waitKind('sample.connection.closed');
    expect(payload<{ reason: string }>(closed).reason).toBe('too-large');
    expect(kinds()).not.toContain('sample.data.echoed');
  });

  test('idleTimeoutMs 100: a silent connection is closed as idle', async () => {
    const { connect, waitKind } = await boot({ idleTimeoutMs: 100 });
    const client = await connect();
    const closed = await waitKind('sample.connection.closed');
    expect(payload<{ reason: string }>(closed).reason).toBe('idle');
    await client.closed;
  });

  test('a client that closes is recorded as closed(client) with its byte counts', async () => {
    const { connect, waitKind } = await boot();
    const client = await connect();
    client.send('abc');
    await client.receive(3);
    client.close();
    const closed = await waitKind('sample.connection.closed');
    expect(payload<object>(closed)).toMatchObject({ reason: 'client', bytesIn: 3, bytesOut: 3 });
    expect(closed.summary).toMatch(/^conn c-1 closed \(client\) after \d+\.\ds, in 3B out 3B$/);
  });
});

describe('sample core — faults', () => {
  test('delay 200ms → latencyMs ≥ 200, the echo names the fault', async () => {
    const { connect, waitKind } = await boot({ faults: [{ id: 'f1', delayMs: 200 }] });
    const client = await connect();
    client.send('slow');
    await client.receive(4);
    const echoed = await waitKind('sample.data.echoed');
    expect(echoed.latencyMs).toBeGreaterThanOrEqual(200);
    expect(echoed.summary).toEndWith(' [fault f1]');
    expect(payload<{ faultId: string }>(echoed).faultId).toBe('f1');
  });

  test('disconnect → no echo, closed(fault), fault.injected with the same correlationId', async () => {
    const { connect, waitKind } = await boot({ faults: [{ id: 'cut', disconnect: true }] });
    const client = await connect();
    client.send('bye');
    await client.closed;
    expect(client.bytes().byteLength).toBe(0);
    const closed = await waitKind('sample.connection.closed');
    expect(payload<{ reason: string }>(closed).reason).toBe('fault');
    const injected = await waitKind('testbed.fault.injected');
    expect(injected.correlationId).toBe(closed.correlationId);
    expect(injected).toMatchObject({ core: 'testbed', payload: { core: 'sample', ruleId: 'cut' } });
  });

  test('corrupt → every byte XOR 0xFF, same length', async () => {
    const { connect } = await boot({ faults: [{ id: 'flip', corrupt: true }] });
    const client = await connect();
    const data = new Uint8Array([0x00, 0x0f, 0xf0, 0xff, 0x41]);
    client.send(data);
    expect(await client.receive(5)).toEqual(data.map((byte) => byte ^ 0xff));
  });

  test('match selects by connId; times stops after n', async () => {
    const { connect, waitKind } = await boot({
      faults: [{ id: 'only-c2', match: { connId: 'c-2' }, corrupt: true, times: 1 }],
    });
    const first = await connect();
    await waitKind('sample.connection.opened');
    const second = await connect();
    await waitKind('sample.connection.opened', (event) => event.correlationId === 'c-2');
    first.send('A');
    expect(await first.receive(1)).toEqual(new Uint8Array([0x41]));
    second.send('A');
    expect(await second.receive(1)).toEqual(new Uint8Array([0x41 ^ 0xff]));
    second.send('A');
    expect((await second.receive(2)).at(1)).toBe(0x41);
  });

  test('an error fault is rejected by config validation', async () => {
    const { host } = await boot();
    await expect(
      host.setConfig('sample', { faults: [{ id: 'f1', error: 'x' }] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(host.getConfig('sample').faults).toEqual([]);
  });
});

describe('sample core — lifecycle', () => {
  test('a port already in use → error state with EADDRINUSE', async () => {
    const first = await boot();
    const taken = new URL(first.url().replace('tcp:', 'http:')).port;
    const second = await boot({}, { SAMPLE_PORT: taken });
    expect(second.host.status('sample')).toMatchObject({ state: 'error', detail: 'EADDRINUSE' });
    const state = await second.waitKind(
      'testbed.core.state',
      (event) => payload<{ to: string }>(event).to === 'error',
    );
    expect(state).toMatchObject({
      level: 'error',
      actor: 'system',
      payload: { detail: 'EADDRINUSE' },
    });
  });

  test('port change → restart-required; after stop → start it serves on the new port', async () => {
    const free = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data: () => undefined } });
    const newPort = free.port;
    free.stop(true);

    const { host, url, connect } = await boot();
    expect(await host.setConfig('sample', { port: newPort })).toBe('restart-required');
    expect(url()).not.toEndWith(`:${newPort}`);
    await host.stop('sample');
    await host.start('sample');
    expect(url()).toBe(`tcp://localhost:${newPort}`);
    const client = await connect();
    client.send('moved');
    expect(new TextDecoder().decode(await client.receive(5))).toBe('moved');
  });

  test('other config changes apply at once', async () => {
    const { host } = await boot();
    expect(await host.setConfig('sample', { maxConnections: 5 })).toBe('applied');
  });

  test('state changes are announced: idle → starting → running → stopping → stopped', async () => {
    const { host, bus } = await boot();
    await host.stop('sample');
    expect(
      bus
        .buffered()
        .filter((event) => event.kind === 'testbed.core.state')
        .map((event) => payload<{ to: string }>(event).to),
    ).toEqual(['starting', 'running', 'stopping', 'stopped']);
  });

  test('reset closes open connections, zeroes counters, keeps the listener', async () => {
    const { host, bus, connect, url, waitKind } = await boot();
    const client = await connect();
    client.send('abc');
    await client.receive(3);
    const before = url();
    await host.reset('sample');
    const resetAt = bus.buffered().at(-1)?.seq ?? 0;
    await client.closed;
    expect(host.status('sample').counters).toEqual({
      connectionsOpen: 0,
      connectionsTotal: 0,
      bytesIn: 0,
      bytesOut: 0,
    });
    expect(url()).toBe(before);
    const again = await connect();
    // Connection numbers start over too.
    const reopened = await waitKind('sample.connection.opened', (event) => event.seq > resetAt);
    expect(reopened.correlationId).toBe('c-1');
    again.send('x');
    expect(await again.receive(1)).toEqual(new Uint8Array([0x78]));
  });

  test("broadcast({ text: 'hello' }) reaches both open connections → { sent: 2 }", async () => {
    const { host, connect, waitKind } = await boot();
    const a = await connect();
    const b = await connect();
    await waitKind('sample.connection.opened', (event) => event.correlationId === 'c-2');
    const result = await host.invokeAction(
      'sample',
      'broadcast',
      { text: 'hello' },
      { actor: 'agent', name: 'qa-claude', sessionId: '074a9c1e-5b2d' },
    );
    expect(result).toEqual({ sent: 2 });
    expect(new TextDecoder().decode(await a.receive(5))).toBe('hello');
    expect(new TextDecoder().decode(await b.receive(5))).toBe('hello');
    const sent = await waitKind('sample.broadcast.sent');
    // The action's event carries its caller, ids cut to 4 characters.
    expect(sent).toMatchObject({
      actor: 'agent',
      caller: { actor: 'agent', name: 'qa-claude', sessionId: '074a' },
      summary: 'broadcast 5B to 2 conns',
    });
  });

  test('broadcast validates input and needs a running core', async () => {
    const { host } = await boot();
    await expect(
      host.invokeAction('sample', 'broadcast', { text: '' }, { actor: 'ci' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await host.stop('sample');
    const error = await host
      .invokeAction('sample', 'broadcast', { text: 'x' }, { actor: 'ci' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TestbedError);
    expect((error as TestbedError).code).toBe('CORE_NOT_RUNNING');
  });

  test('stop closes every open connection as stop', async () => {
    const { host, connect, waitKind } = await boot();
    const client = await connect();
    await waitKind('sample.connection.opened');
    await host.stop('sample');
    await client.closed;
    const closed = await waitKind('sample.connection.closed');
    expect(payload<{ reason: string }>(closed).reason).toBe('stop');
  });
});
