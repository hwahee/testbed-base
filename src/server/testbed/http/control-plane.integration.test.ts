/**
 * The control plane over real HTTP, WS and TCP (docs/spec.md §11 M4): the app
 * as the server builds it, with the sample core, on ephemeral ports.
 */
import { afterEach, describe, expect, test } from 'bun:test';

import packageJson from '../../../../package.json';

import type { TestbedEvent } from '@shared/testbed/events';

import { sampleCore } from '../testing/sample-core';
import { startTestServer, TcpClient, waitForEvent } from '../testing';
import type { TestbedSocketMessage } from '@shared/testbed/control';

const stops: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const stop of stops.splice(0)) await stop();
});

/** A port nothing listens on right now. */
function freePort(): number {
  const probe = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data: () => undefined } });
  const { port } = probe;
  probe.stop(true);
  return port;
}

async function startTestbed(env: Record<string, string> = {}, idleTimeout?: number) {
  const { base, server, runtime, plane, stop } = await startTestServer({
    cores: [sampleCore],
    env,
    ...(idleTimeout === undefined ? {} : { idleTimeout }),
  });
  stops.push(stop);

  async function call<T = Record<string, unknown>>(
    method: string,
    path: string,
    options: { actor?: string; lease?: string; token?: string; body?: unknown } = {},
  ): Promise<{ status: number; body: T; headers: Headers; text: string }> {
    const response = await fetch(`${base}/testbed/api${path}`, {
      method,
      headers: {
        ...(options.actor === undefined ? {} : { 'x-testbed-actor': options.actor }),
        ...(options.lease === undefined ? {} : { 'x-testbed-lease': options.lease }),
        ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const text = await response.text();
    const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
    return {
      status: response.status,
      body: (isJson ? JSON.parse(text) : undefined) as T,
      headers: response.headers,
      text,
    };
  }

  const echoUrl = () => runtime.host.status('sample').endpoints[0]?.url ?? '';
  const events = (kind: string) => runtime.bus.buffered().filter((event) => event.kind === kind);
  return { base, server, runtime, plane, call, echoUrl, events };
}

interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

describe('manifest', () => {
  test('describes the sample core, its endpoints and the control plane', async () => {
    const { call } = await startTestbed();
    const { status, body } = await call<{
      name: string;
      instanceId: string;
      baseVersion: string;
      cores: {
        id: string;
        kind: string;
        endpoints: { protocol: string }[];
        actions: { name: string; mutating: boolean; inputSchema: Record<string, unknown> }[];
        configSchema: Record<string, unknown>;
        faults: string[];
      }[];
      control: { rest: string; mcp: string; ws: string };
      auth: { control: string };
    }>('GET', '/manifest');
    expect(status).toBe(200);
    expect(body.name).toBe(packageJson.name);
    expect(body.instanceId).toBeString();
    expect(body.cores[0]?.id).toBe('sample');
    expect(body.cores[0]?.kind).toBe('passive');
    expect(body.cores[0]?.endpoints[0]?.protocol).toBe('tcp');
    expect(body.cores[0]?.faults).toEqual(['delay', 'disconnect', 'corrupt']);
    expect(body.cores[0]?.actions[0]).toMatchObject({ name: 'broadcast', mutating: true });
    expect(body.cores[0]?.actions[0]?.inputSchema).toMatchObject({ type: 'object' });
    expect(body.cores[0]?.configSchema).toMatchObject({ type: 'object' });
    expect(body.control).toEqual({ rest: '/testbed/api', mcp: '/testbed/mcp', ws: '/testbed/ws' });
    expect(body.auth).toEqual({ control: 'none' });
  });
});

describe('control lease over REST', () => {
  test('ci takes the lease and operates; a person gets 423, another lease 409; each refusal is recorded', async () => {
    const { call, events } = await startTestbed();
    const lease = await call<{ leaseId: string; expiresAt: string }>('POST', '/lease', {
      actor: 'ci',
    });
    expect(lease.status).toBe(200);
    expect(lease.body.leaseId).toBeString();
    const leaseId = lease.body.leaseId;

    const run = await call('POST', '/runs', {
      actor: 'ci',
      lease: leaseId,
      body: { label: 't1' },
    });
    expect(run.status).toBe(201);

    const human = await call<ErrorBody>('POST', '/cores/sample/stop', { actor: 'human' });
    expect(human.status).toBe(423);
    expect(human.body.error.code).toBe('LOCKED');
    expect(human.body.error.details).toMatchObject({
      holder: { actor: 'ci', holder: leaseId.slice(0, 4) },
    });
    expect(human.body.error.details?.remainingMs).toBeGreaterThan(0);

    const other = await call<ErrorBody>('POST', '/cores/sample/stop', {
      actor: 'ci',
      lease: 'someone-else',
    });
    expect(other.status).toBe(409);
    expect(other.body.error.code).toBe('LEASE_HELD');

    expect(events('testbed.lease.denied').map((event) => event.actor)).toEqual(['human', 'ci']);
    expect(events('testbed.lease.acquired')).toHaveLength(1);
    // The full lease id never shows up where everyone can read it.
    expect(JSON.stringify(events('testbed.lease.denied'))).not.toContain(leaseId);
    expect(JSON.stringify(events('testbed.control.invoked'))).not.toContain(leaseId);
  });

  test('while the lease is held, status and events are open to everyone', async () => {
    const { call } = await startTestbed();
    await call('POST', '/lease', { actor: 'agent' });
    expect((await call('GET', '/status', { actor: 'human' })).status).toBe(200);
    expect((await call('GET', '/events', { actor: 'human' })).status).toBe(200);
    expect((await call('GET', '/status', { actor: 'ci', lease: 'nope' })).status).toBe(200);
  });

  test('the holder releases with DELETE /lease; then anyone may operate', async () => {
    const { call, events } = await startTestbed();
    const { body } = await call<{ leaseId: string }>('POST', '/lease', { actor: 'ci' });
    expect((await call('DELETE', '/lease', { actor: 'ci', lease: body.leaseId })).body).toEqual({
      released: true,
    });
    expect(events('testbed.lease.released')[0]?.payload).toMatchObject({ reason: 'released' });
    expect((await call('POST', '/cores/sample/reset', { actor: 'human' })).status).toBe(200);
  });

  test('TESTBED_LEASE_TTL_SEC=1: with no calls the lease expires, then a person may operate', async () => {
    const { call, runtime } = await startTestbed({ TESTBED_LEASE_TTL_SEC: '1' });
    await call('POST', '/lease', { actor: 'ci' });
    expect((await call('POST', '/cores/sample/reset', { actor: 'human' })).status).toBe(423);
    const expired = await waitForEvent(
      runtime.bus,
      (event) => event.kind === 'testbed.lease.expired',
      3000,
    );
    expect(expired.actor).toBe('system');
    expect((await call('POST', '/cores/sample/reset', { actor: 'human' })).status).toBe(200);
  });
});

describe('operations', () => {
  test('broadcast by the lease holder → { sent: n } and testbed.control.invoked', async () => {
    const { call, echoUrl, events, runtime } = await startTestbed();
    const client = await TcpClient.connect(echoUrl());
    stops.push(() => Promise.resolve(client.close()));
    await waitForEvent(runtime.bus, (event) => event.kind === 'sample.connection.opened');
    const { body: lease } = await call<{ leaseId: string }>('POST', '/lease', { actor: 'agent' });

    const result = await call('POST', '/cores/sample/actions/broadcast', {
      actor: 'agent',
      lease: lease.leaseId,
      body: { text: 'hi' },
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ sent: 1 });
    expect(new TextDecoder().decode(await client.receive(2))).toBe('hi');
    expect(events('testbed.control.invoked').at(-1)).toMatchObject({
      actor: 'agent',
      payload: { fn: 'sample.broadcast', result: 'ok' },
    });
  });

  test('PATCH config: a new port → restart-required; an error fault → 400 VALIDATION_ERROR', async () => {
    const { call, events } = await startTestbed({ SAMPLE_PORT: String(freePort()) });
    const moved = await call<{ result: string }>('PATCH', '/cores/sample/config', {
      body: { port: 0 },
    });
    expect(moved.status).toBe(200);
    expect(moved.body.result).toBe('restart-required');

    const bad = await call<ErrorBody>('PATCH', '/cores/sample/config', {
      body: { faults: [{ id: 'f1', error: 'x' }] },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    // The failure is recorded with the input as a value and what was wrong.
    const failed = events('testbed.control.invoked').at(-1);
    expect(failed).toMatchObject({
      summary: 'human setConfig failed (VALIDATION_ERROR)',
      payload: {
        fn: 'setConfig',
        input: { core: 'sample', patch: { faults: [{ id: 'f1', error: 'x' }] } },
        result: 'VALIDATION_ERROR',
        error: {
          code: 'VALIDATION_ERROR',
          issues: [expect.objectContaining({ path: 'faults.0' })],
        },
      },
    });

    // A secret in the input is masked like any payload field.
    await call('PATCH', '/cores/sample/config', { body: { apiToken: 'sk-very-secret' } });
    const masked = events('testbed.control.invoked').at(-1);
    expect(JSON.stringify(masked)).not.toContain('sk-very-secret');
    const input = (masked?.payload as { input: { patch: { apiToken: string } } }).input;
    expect(input.patch.apiToken).toMatch(/^sk-v…\(len 14/);
  });

  test("start/stop/reset on '_all', and an action on a stopped core → 409 CORE_NOT_RUNNING", async () => {
    const { call } = await startTestbed();
    const stopped = await call<{ cores: { id: string; state: string }[] }>(
      'POST',
      '/cores/_all/stop',
    );
    expect(stopped.body.cores.map(({ id, state }) => ({ id, state }))).toEqual([
      { id: 'sample', state: 'stopped' },
    ]);
    const action = await call<ErrorBody>('POST', '/cores/sample/actions/broadcast', {
      body: { text: 'x' },
    });
    expect(action.status).toBe(409);
    expect(action.body.error.code).toBe('CORE_NOT_RUNNING');
    expect((await call('POST', '/cores/sample/start')).status).toBe(200);
    expect((await call('POST', '/cores/sample/explode')).status).toBe(404);
    expect((await call('GET', '/cores/nope/config')).status).toBe(404);
  });
});

describe('runs', () => {
  test('a second POST /runs → 409 RUN_ACTIVE; endActive replaces the open Run', async () => {
    const { call } = await startTestbed();
    const first = await call<{ runId: string }>('POST', '/runs', { body: { label: 'one' } });
    expect(first.status).toBe(201);

    const again = await call<ErrorBody>('POST', '/runs', { body: { label: 'two' } });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('RUN_ACTIVE');
    expect(again.body.error.details).toMatchObject({ runId: first.body.runId, label: 'one' });

    const replaced = await call<{ runId: string }>('POST', '/runs', {
      body: { label: 'two', endActive: true },
    });
    expect(replaced.status).toBe(201);
    const previous = await call<{ endReason: string }>('GET', `/runs/${first.body.runId}`);
    expect(previous.body.endReason).toBe('replaced');
    const current = await call<{ runId: string }>('GET', '/runs/current');
    expect(current.body.runId).toBe(replaced.body.runId);
  });

  test('configOverrides apply for the Run only; one that needs a restart → 409 RESTART_REQUIRED', async () => {
    const { call } = await startTestbed();
    const run = await call<{ configSnapshot: Record<string, { maxConnections: number }> }>(
      'POST',
      '/runs',
      { body: { label: 'o', configOverrides: { sample: { maxConnections: 3 } } } },
    );
    expect(run.body.configSnapshot.sample?.maxConnections).toBe(3);
    expect(
      (await call<{ maxConnections: number }>('GET', '/cores/sample/config')).body.maxConnections,
    ).toBe(3);
    const ended = await call<{ endReason: string; summary: object }>('POST', '/runs/current/end');
    expect(ended.body.endReason).toBe('ended');
    expect(
      (await call<{ maxConnections: number }>('GET', '/cores/sample/config')).body.maxConnections,
    ).toBe(100);

    const needsRestart = await call<ErrorBody>('POST', '/runs', {
      body: { label: 'p', configOverrides: { sample: { port: freePort() } } },
    });
    expect(needsRestart.status).toBe(409);
    expect(needsRestart.body.error.code).toBe('RESTART_REQUIRED');
    expect((await call<{ port: number }>('GET', '/cores/sample/config')).body.port).toBe(0);
    expect((await call('POST', '/runs/current/end')).status).toBe(404);
  });

  test('GET /runs/:id/export is NDJSON, one event per line', async () => {
    const { call, echoUrl } = await startTestbed();
    const run = await call<{ runId: string }>('POST', '/runs', { body: { label: 'x' } });
    const client = await TcpClient.connect(echoUrl());
    stops.push(() => Promise.resolve(client.close()));
    client.send('abc');
    await client.receive(3);
    await call('POST', '/runs/current/end');

    const exported = await call('GET', `/runs/${run.body.runId}/export`);
    expect(exported.status).toBe(200);
    expect(exported.headers.get('content-type')).toStartWith('application/x-ndjson');
    const lines = exported.text.trimEnd().split('\n');
    const kinds = lines.map((line) => (JSON.parse(line) as TestbedEvent).kind);
    expect(kinds[0]).toBe('testbed.run.started');
    expect(kinds).toContain('sample.data.echoed');
    expect(kinds.at(-1)).toBe('testbed.run.ended');
    expect((await call('GET', '/runs/nope/export')).status).toBe(404);
  });
});

describe('events, wait and check', () => {
  test('a cursor from another instance → 410 CURSOR_STALE with the fresh cursor', async () => {
    const { call, runtime } = await startTestbed();
    const { status, body } = await call<ErrorBody>('GET', '/events?after=another-boot:0');
    expect(status).toBe(410);
    expect(body.error.code).toBe('CURSOR_STALE');
    expect(body.error.details).toEqual({ cursor: `${runtime.bus.instanceId}:0` });
  });

  test('GET /events filters and returns the next cursor; GET /events/:id one event', async () => {
    const { call } = await startTestbed();
    const page = await call<{ events: TestbedEvent[]; cursor: string }>(
      'GET',
      '/events?kind=testbed.core&limit=1',
    );
    expect(page.body.events).toHaveLength(1);
    expect(page.body.cursor).toBe(page.body.events[0]?.id ?? 'missing');
    const next = await call<{ events: TestbedEvent[] }>(
      'GET',
      `/events?kind=testbed.core&after=${page.body.cursor}`,
    );
    expect(next.body.events.map((event) => event.payload)).toEqual([
      expect.objectContaining({ to: 'running' }),
    ]);
    const one = await call<TestbedEvent>('GET', `/events/${page.body.cursor}`);
    expect(one.body.kind).toBe('testbed.core.state');
    expect((await call('GET', '/events/none:1')).status).toBe(404);
  });

  test('POST /wait returns once the echo happens; with nothing coming it times out with 0', async () => {
    const { call, echoUrl } = await startTestbed();
    const waiting = call<{ events: TestbedEvent[]; timedOut: boolean }>('POST', '/wait', {
      body: { filter: { kind: 'sample.data.echoed' }, count: 1, timeoutMs: 5000 },
    });
    const client = await TcpClient.connect(echoUrl());
    stops.push(() => Promise.resolve(client.close()));
    client.send('ping');
    const done = await waiting;
    expect(done.body.timedOut).toBe(false);
    expect(done.body.events.map((event) => event.kind)).toEqual(['sample.data.echoed']);

    const idle = await call<{ events: TestbedEvent[]; timedOut: boolean }>('POST', '/wait', {
      body: { filter: { kind: 'sample.never.happens' }, timeoutMs: 100 },
    });
    expect(idle.body).toEqual({ events: [], timedOut: true });
  });

  test('POST /wait may outlast the HTTP idle timeout', async () => {
    // Bun checks idle sockets every ~4 s, so a 1 s idle timeout bites within 5 s.
    const { call } = await startTestbed({}, 1);
    const idle = await call<{ events: TestbedEvent[]; timedOut: boolean }>('POST', '/wait', {
      body: { filter: { kind: 'sample.never.happens' }, timeoutMs: 6000 },
    });
    expect(idle.status).toBe(200);
    expect(idle.body).toEqual({ events: [], timedOut: true });
  }, 10_000);

  test('POST /check judges and records', async () => {
    const { call, events } = await startTestbed();
    const result = await call<{ pass: boolean; matched: number }>('POST', '/check', {
      body: { filter: { kind: 'testbed.core.state' }, expect: { count: '==2' }, label: 'boot' },
    });
    expect(result.body).toMatchObject({ pass: true, matched: 2 });
    expect(events('testbed.check.evaluated')).toHaveLength(1);
  });
});

describe('WS /testbed/ws', () => {
  test('snapshot first, then event increments for TCP traffic and a lease increment', async () => {
    const { base, call, echoUrl } = await startTestbed();
    const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/testbed/ws`);
    stops.push(() => Promise.resolve(ws.close()));
    const messages: TestbedSocketMessage[] = [];
    const arrived = (predicate: (message: TestbedSocketMessage) => boolean) =>
      new Promise<TestbedSocketMessage>((resolve, reject) => {
        const found = messages.find(predicate);
        if (found) return resolve(found);
        const timer = setTimeout(() => reject(new Error('no such WS message')), 3000);
        ws.addEventListener('message', function listen() {
          const match = messages.find(predicate);
          if (!match) return;
          clearTimeout(timer);
          ws.removeEventListener('message', listen);
          resolve(match);
        });
      });
    ws.addEventListener('message', (message) => {
      messages.push(JSON.parse(String(message.data)) as TestbedSocketMessage);
    });

    const snapshot = await arrived((message) => message.type === 'snapshot');
    expect(messages[0]?.type).toBe('snapshot');
    expect(snapshot).toMatchObject({
      status: { cores: [expect.objectContaining({ id: 'sample' })] },
    });

    const client = await TcpClient.connect(echoUrl());
    stops.push(() => Promise.resolve(client.close()));
    client.send('abc');
    await arrived(
      (message) =>
        message.type === 'event' &&
        message.events.some((event) => event.kind === 'sample.data.echoed'),
    );

    await call('POST', '/lease', { actor: 'agent' });
    const lease = await arrived((message) => message.type === 'lease');
    expect(lease).toMatchObject({ lease: { actor: 'agent' } });
  });
});

describe('TESTBED_CONTROL_TOKEN', () => {
  test('agents and CI need the Bearer token; with it they pass', async () => {
    const { call } = await startTestbed({ TESTBED_CONTROL_TOKEN: 'x' });
    for (const actor of ['agent', 'ci']) {
      const refused = await call<ErrorBody>('GET', '/status', { actor });
      expect(refused.status).toBe(401);
      expect(refused.body.error.code).toBe('UNAUTHORIZED');
    }
    expect((await call('GET', '/status', { actor: 'ci', token: 'wrong' })).status).toBe(401);
    expect((await call('GET', '/status', { actor: 'agent', token: 'x' })).status).toBe(200);
    expect((await call('POST', '/lease', { actor: 'ci', token: 'x' })).status).toBe(200);
    const manifest = await call<{ auth: { control: string } }>('GET', '/manifest', { token: 'x' });
    expect(manifest.body.auth.control).toBe('bearer');
  });
});

describe('bun run testbed:release', () => {
  test('releases the lease as system/forced; refused from anywhere but this machine', async () => {
    const { call, server, events } = await startTestbed();
    await call('POST', '/lease', { actor: 'agent' });
    const proc = Bun.spawn(['bun', 'scripts/testbed-release.ts'], {
      env: { ...process.env, PORT: String(server.port) },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(await proc.exited).toBe(0);
    expect(await new Response(proc.stdout).text()).toContain('lease released (forced)');
    expect(events('testbed.lease.released').at(-1)).toMatchObject({
      actor: 'system',
      payload: { reason: 'forced' },
    });
    expect((await call('POST', '/cores/sample/reset', { actor: 'human' })).status).toBe(200);

    const proxied = await fetch(`http://127.0.0.1:${server.port}/testbed/internal/release`, {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    expect(proxied.status).toBe(404);
  });
});

describe('fallback', () => {
  test('unknown control-plane paths get the JSON 404 envelope', async () => {
    const { call } = await startTestbed();
    const missing = await call<ErrorBody>('GET', '/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });
});
