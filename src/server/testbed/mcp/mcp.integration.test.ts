/**
 * The control plane over MCP (docs/spec.md §11 M5): the SDK client against the
 * app as the server builds it, with the sample core, on ephemeral ports.
 */
import { afterEach, describe, expect, test } from 'bun:test';

import packageJson from '../../../../package.json';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Caller, EventLine, TestbedEvent } from '@shared/testbed/events';

import { sampleCore } from '../testing/sample-core';
import { startTestServer, TcpClient, waitForEvent } from '../testing';
import { MCP_INSTRUCTIONS } from './endpoint';

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const COMMON_TOOLS = [
  'testbed_info',
  'get_core_log',
  'get_config',
  'set_config',
  'start',
  'stop',
  'reset',
  'start_run',
  'end_run',
  'query_events',
  'get_event',
  'wait_for',
  'check',
  'export_run',
  'acquire_control',
  'release_control',
];
const READ_TOOLS = [
  'testbed_info',
  'get_core_log',
  'get_config',
  'query_events',
  'get_event',
  'wait_for',
  'check',
  'export_run',
];

interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

interface ToolError {
  code: string;
  message: string;
  details?: unknown;
}

async function startTestbed(env: Record<string, string> = {}, idleTimeout?: number) {
  const testbed = await startTestServer({
    cores: [sampleCore],
    env,
    ...(idleTimeout === undefined ? {} : { idleTimeout }),
  });
  cleanups.push(testbed.stop);
  const mcpUrl = new URL('/testbed/mcp', testbed.base);

  /** One MCP session, as one agent. */
  async function connect(name: string, headers?: Record<string, string>) {
    const transport = new StreamableHTTPClientTransport(
      mcpUrl,
      headers === undefined ? undefined : { requestInit: { headers } },
    );
    const client = new Client({ name, version: '0.0.0' });
    await client.connect(transport);
    cleanups.push(() => client.close());
    const sessionId = transport.sessionId ?? '';

    const raw = async (tool: string, args: Record<string, unknown> = {}) =>
      (await client.callTool({ name: tool, arguments: args })) as ToolResult;
    /** A call that must succeed; its `structuredContent`. */
    async function call<T = Record<string, unknown>>(
      tool: string,
      args: Record<string, unknown> = {},
    ): Promise<T> {
      const result = await raw(tool, args);
      if (result.isError) throw new Error(`${tool} failed: ${result.content[0]?.text}`);
      return result.structuredContent as T;
    }
    /** A call that must fail with `code`; the error. */
    async function fail(
      tool: string,
      args: Record<string, unknown>,
      code: string,
    ): Promise<ToolError> {
      const result = await raw(tool, args);
      expect(result.isError).toBe(true);
      const error = (result.structuredContent as { error: ToolError }).error;
      expect(error.code).toBe(code);
      expect(result.content[0]?.text).toBe(error.message);
      return error;
    }
    return { client, transport, sessionId, raw, call, fail };
  }

  async function rest(method: string, path: string, body?: unknown) {
    const response = await fetch(`${testbed.base}/testbed/api${path}`, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  /** A raw initialize (for refusals the SDK client would only throw on). */
  function initialize(headers: Record<string, string> = {}) {
    return fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'raw', version: '0.0.0' },
        },
      }),
    });
  }

  async function tcp() {
    const client = await TcpClient.connect(
      testbed.runtime.host.status('sample').endpoints[0]?.url ?? '',
    );
    cleanups.push(() => Promise.resolve(client.close()));
    return client;
  }

  const lastCursor = () => testbed.runtime.bus.buffered().at(-1)?.id ?? '';
  const events = (kind: string) =>
    testbed.runtime.bus.buffered().filter((event) => event.kind === kind);
  return { ...testbed, mcpUrl, connect, rest, initialize, tcp, lastCursor, events };
}

describe('initialize and tools/list', () => {
  test('instructions as written; 16 common tools and sample_broadcast; readOnlyHint on reads only', async () => {
    const { connect } = await startTestbed();
    const { client } = await connect('m5-agent');
    expect(client.getInstructions()).toBe(MCP_INSTRUCTIONS);

    const { tools } = await client.listTools();
    const names = tools.map((entry) => entry.name);
    expect(names).toEqual([...COMMON_TOOLS, 'sample_broadcast']);
    for (const entry of tools) {
      expect(entry.annotations?.readOnlyHint).toBe(READ_TOOLS.includes(entry.name));
      expect(entry.inputSchema.type).toBe('object');
      expect(entry.description?.length).toBeGreaterThan(20);
    }
    const broadcast = tools.find((entry) => entry.name === 'sample_broadcast');
    expect(broadcast?.description).toEndWith('(제어 락 필요)');
    expect(broadcast?.inputSchema.properties).toHaveProperty('text');
    const query = tools.find((entry) => entry.name === 'query_events');
    expect(query?.inputSchema.properties).toHaveProperty('after');
  });
});

describe('testbed_info', () => {
  test('cores with their data-plane endpoints, Run and lease', async () => {
    const { connect } = await startTestbed();
    const agent = await connect('m5-agent');
    const result = await agent.raw('testbed_info');
    const info = result.structuredContent as {
      name: string;
      cores: { id: string; state: string; endpoints: { protocol: string }[]; actions: string[] }[];
      run: unknown;
      lease: unknown;
    };
    expect(info.name).toBe(packageJson.name);
    expect(info.cores[0]?.id).toBe('sample');
    expect(info.cores[0]?.endpoints[0]?.protocol).toBe('tcp');
    expect(info.cores[0]?.actions).toEqual(['broadcast']);
    expect(info.run).toBeNull();
    expect(info.lease).toBeNull();
    expect(result.content[0]?.text).toMatch(
      /^sample running tcp:\/\/localhost:\d+ actions: broadcast$/m,
    );
    expect(result.content[0]?.text).toContain('Run: 없음');
    expect(result.content[0]?.text).toContain('제어 락: 없음');
  });

  test('an open Run is brief: no configSnapshot', async () => {
    const { connect } = await startTestbed();
    const agent = await connect('m5-agent');
    const run = await agent.call<{ runId: string; configSnapshot: unknown }>('start_run', {
      label: 'brief',
    });
    expect(run.configSnapshot).toBeDefined();
    const info = (await agent.raw('testbed_info')).structuredContent as {
      run: Record<string, unknown>;
    };
    expect(info.run).toMatchObject({ runId: run.runId, label: 'brief' });
    expect(info.run).not.toHaveProperty('configSnapshot');
  });
});

describe('a test session', () => {
  test('start_run takes the lease; wait_for, check and end_run see the echo', async () => {
    const { connect, tcp, events, lastCursor } = await startTestbed();
    const agent = await connect('m5-agent');
    const run = await agent.call<{ runId: string; label: string }>('start_run', { label: 'm5' });
    expect(run.label).toBe('m5');

    const acquired = events('testbed.lease.acquired');
    expect(acquired).toHaveLength(1);
    expect(acquired[0]?.actor).toBe('agent');
    expect(acquired[0]?.payload).toMatchObject({
      lease: { actor: 'agent', name: 'm5-agent', holder: agent.sessionId.slice(0, 4) },
    });

    const after = lastCursor();
    const client = await tcp();
    client.send('hello');
    const waited = await agent.call<{ matched: number; timedOut: boolean; events: EventLine[] }>(
      'wait_for',
      { filter: { kind: 'sample.data.echoed', after } },
    );
    expect(waited).toMatchObject({ matched: 1, timedOut: false });
    expect(waited.events[0]?.kind).toBe('sample.data.echoed');

    const checked = await agent.raw('check', {
      filter: { kind: 'sample.data.echoed' },
      expect: { count: '==1' },
    });
    expect(checked.structuredContent).toMatchObject({ pass: true, matched: 1 });
    expect(checked.content[0]?.text).toStartWith('PASS: 1건 일치(기대 ==1)');
    // A bare number means exactly that many.
    const bare = await agent.raw('check', {
      filter: { kind: 'sample.data.echoed' },
      expect: { count: '1' },
    });
    expect(bare.content[0]?.text).toStartWith('PASS: 1건 일치(기대 ==1)');

    const ended = await agent.raw('end_run');
    expect(ended.structuredContent).toMatchObject({
      runId: run.runId,
      endReason: 'ended',
      summary: { byKind: { 'sample.data.echoed': 1 } },
    });
    expect(ended.content[0]?.text).toContain('sample.data.echoed=1');
  });

  test("what an agent did carries its name and session's first 4 characters, so two agents tell apart", async () => {
    const { connect, tcp, events, runtime } = await startTestbed();
    const agent = await connect('qa-claude');
    const short = agent.sessionId.slice(0, 4);
    await tcp();
    await agent.call('start_run', { label: 'who' });
    await agent.call('sample_broadcast', { text: 'hi' });
    await agent.call('check', { filter: { kind: 'sample.broadcast.sent' }, expect: { count: 1 } });
    await agent.call('end_run');

    const caller: Caller = { actor: 'agent', name: 'qa-claude', sessionId: short };
    for (const kind of [
      'testbed.control.invoked',
      'testbed.run.started',
      'sample.broadcast.sent',
      'testbed.check.evaluated',
      'testbed.run.ended',
    ]) {
      const [event] = events(kind);
      expect({ kind, caller: event?.caller }).toEqual({ kind, caller });
    }
    // Never the whole session id: it would let anyone act as the holder.
    expect(JSON.stringify(runtime.bus.buffered())).not.toContain(agent.sessionId);
  });

  test('wait_for with a cap above 120 s is cut, not refused', async () => {
    const { connect, tcp } = await startTestbed();
    const agent = await connect('m5-agent');
    const client = await tcp();
    const waiting = agent.call<{ matched: number }>('wait_for', {
      filter: { kind: 'sample.data.echoed' },
      timeoutMs: 999_999,
    });
    // The wait is registered once the call is running; send until it sees one.
    const sender = setInterval(() => client.send('x'), 50);
    try {
      expect((await waiting).matched).toBe(1);
    } finally {
      clearInterval(sender);
    }
  });

  test('a wait longer than the HTTP idle timeout is not cut off', async () => {
    // Bun checks idle sockets every ~4 s, so a 1 s idle timeout bites within 5 s.
    const { connect } = await startTestbed({}, 1);
    const agent = await connect('m5-agent');
    expect(
      await agent.call('wait_for', { filter: { kind: 'nothing.here' }, timeoutMs: 6000 }),
    ).toMatchObject({ matched: 0, timedOut: true });
  }, 10_000);

  test('wait_for with nothing coming times out with what it has', async () => {
    const { connect } = await startTestbed();
    const agent = await connect('m5-agent');
    expect(
      await agent.call<Record<string, unknown>>('wait_for', {
        filter: { kind: 'nothing.here' },
        timeoutMs: 200,
      }),
    ).toEqual({ matched: 0, timedOut: true, events: [] });
  });
});

describe('the lease across sessions', () => {
  test('LEASE_HELD for a second session, 423 for people; release hands it over', async () => {
    const { connect, rest, events } = await startTestbed();
    const first = await connect('agent-one');
    const second = await connect('agent-two');
    await first.call('acquire_control');

    const denied = await second.fail('stop', { core: 'sample' }, 'LEASE_HELD');
    expect(denied.message).toContain('agent-one');
    expect(denied.message).toContain(first.sessionId.slice(0, 4));
    expect(denied.message).toMatch(/남은 시간 \d+:\d\d/);
    expect(denied.details).toMatchObject({ holder: { actor: 'agent', name: 'agent-one' } });
    expect(events('testbed.lease.denied')).toHaveLength(1);

    const read = await second.call<{ events: unknown[] }>('query_events', {});
    expect(read.events.length).toBeGreaterThan(0);

    const human = await rest('POST', '/cores/sample/stop');
    expect(human.status).toBe(423);
    expect((human.body.error as ToolError).code).toBe('LOCKED');

    // release_control by a session without the lease: false, no error, no denial.
    expect(await second.call<Record<string, unknown>>('release_control')).toEqual({
      released: false,
    });
    expect(events('testbed.lease.denied')).toHaveLength(2);

    expect(await first.call<Record<string, unknown>>('release_control')).toEqual({
      released: true,
    });
    const stopped = await second.call<{ cores: { id: string; state: string }[] }>('stop', {
      core: 'sample',
    });
    expect(stopped.cores[0]).toMatchObject({ id: 'sample', state: 'stopped' });
    const status = await rest('GET', '/status');
    expect(status.body.lease).toMatchObject({
      actor: 'agent',
      name: 'agent-two',
      holder: second.sessionId.slice(0, 4),
    });
  });

  test('an operation that took the lease and failed gives it back', async () => {
    const { connect, rest, runtime, plane } = await startTestbed();
    expect((await rest('POST', '/runs', { label: 'human-run' })).status).toBe(201);
    const agent = await connect('m5-agent');
    await agent.fail('start_run', { label: 'agent-run' }, 'RUN_ACTIVE');
    const released = await waitForEvent(
      runtime.bus,
      (event) => event.kind === 'testbed.lease.released',
    );
    expect(released.payload).toMatchObject({ reason: 'operation-failed' });
    expect(plane.control.lease.view()).toBeNull();
    // A lease the session already held stays when a later call fails.
    await agent.call('acquire_control');
    await agent.fail('start_run', { label: 'agent-run' }, 'RUN_ACTIVE');
    expect(plane.control.lease.view()).toMatchObject({ name: 'm5-agent' });
  });

  test('closing the holding session with DELETE releases the lease', async () => {
    const { connect, runtime, plane } = await startTestbed();
    const agent = await connect('m5-agent');
    await agent.call('acquire_control');
    await agent.transport.terminateSession();
    const released = await waitForEvent(
      runtime.bus,
      (event) => event.kind === 'testbed.lease.released',
    );
    expect(released.payload).toMatchObject({ reason: 'session-closed' });
    expect(plane.control.lease.view()).toBeNull();
    expect(plane.mcp.size).toBe(0);
  });
});

describe('Runs', () => {
  test('a second start_run is RUN_ACTIVE and says how to go on; endActive replaces', async () => {
    const { connect, rest } = await startTestbed();
    const agent = await connect('m5-agent');
    const first = await agent.call<{ runId: string }>('start_run', { label: 'one' });
    const active = await agent.fail('start_run', { label: 'two' }, 'RUN_ACTIVE');
    expect(active.message).toContain('endActive: true');
    expect(active.details).toMatchObject({ runId: first.runId });

    const second = await agent.call<{ runId: string }>('start_run', {
      label: 'two',
      endActive: true,
    });
    expect(second.runId).not.toBe(first.runId);
    const previous = await rest('GET', `/runs/${first.runId}`);
    expect(previous.body.endReason).toBe('replaced');
  });

  test('export_run gives the export URL; the file store adds the path', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'testbed-mcp-'));
    cleanups.push(() => rm(dataDir, { recursive: true, force: true }));
    const { connect, base } = await startTestbed({
      TESTBED_RUN_STORE: 'file',
      TESTBED_DATA_DIR: dataDir,
    });
    const agent = await connect('m5-agent');
    const run = await agent.call<{ runId: string }>('start_run', { label: 'export' });
    await agent.call('end_run');

    const out = await agent.call<{ runId: string; url: string; path?: string }>('export_run');
    expect(out.runId).toBe(run.runId);
    expect(out.url).toEndWith(`/testbed/api/runs/${run.runId}/export`);
    expect(out.path).toBe(join(dataDir, 'runs', `${run.runId}.jsonl`));
    expect((await stat(out.path ?? '')).isFile()).toBe(true);

    // The URL is under TESTBED_PUBLIC_URL; in tests the server's own port differs.
    const exported = await (await fetch(new URL(new URL(out.url).pathname, base))).text();
    expect(exported.split('\n').filter(Boolean).length).toBeGreaterThan(0);
  });

  test('export_run with the memory store has no path; no Run at all is NOT_FOUND', async () => {
    const { connect } = await startTestbed();
    const agent = await connect('m5-agent');
    await agent.fail('export_run', {}, 'NOT_FOUND');
    const run = await agent.call<{ runId: string }>('start_run', { label: 'open' });
    const out = await agent.call<{ runId: string; path?: string }>('export_run');
    expect(out.runId).toBe(run.runId);
    expect(out).not.toHaveProperty('path');
  });
});

describe('events', () => {
  test('query_events pages with nextCursor, lines carry no payload; get_event has it all', async () => {
    const { connect, runtime, tcp } = await startTestbed();
    const agent = await connect('m5-agent');
    const client = await tcp();
    client.send('hello');
    await client.receive(5);
    await waitForEvent(runtime.bus, (event) => event.kind === 'sample.data.echoed');

    const first = await agent.raw('query_events', { limit: 2 });
    const page = first.structuredContent as {
      events: EventLine[];
      nextCursor: string;
      total: number;
    };
    expect(page.events).toHaveLength(2);
    expect(page.total).toBeGreaterThan(2);
    expect(page.nextCursor).toBe(page.events[1]?.id ?? '');
    for (const line of page.events) expect(line).not.toHaveProperty('payload');
    const [firstLine] = page.events;
    expect(first.content[0]?.text.split('\n')[0]).toBe(
      `${firstLine?.id} ${firstLine?.ts.slice(11, 23)} ${firstLine?.level} ${firstLine?.kind} ${firstLine?.summary}`,
    );

    const next = await agent.call<{ events: EventLine[] }>('query_events', {
      limit: 2,
      after: page.nextCursor,
    });
    const all = runtime.bus.buffered();
    expect(next.events.map((line) => line.id)).toEqual(
      all.slice(2, 4).map((event: TestbedEvent) => event.id),
    );

    const stale = await agent.fail('query_events', { after: 'another-boot:0' }, 'CURSOR_STALE');
    expect(stale.details).toEqual({ cursor: `${runtime.bus.instanceId}:0` });

    const echoed = all.find((event) => event.kind === 'sample.data.echoed');
    const full = await agent.call<TestbedEvent>('get_event', { id: echoed?.id });
    expect(full.payload).toMatchObject({ bytes: 5, preview: 'hello' });
    const noEvent = await agent.fail('get_event', { id: 'nope:1' }, 'NOT_FOUND');
    expect(noEvent.message).toContain('query_events');
  });
});

describe('actions and config', () => {
  test('sample_broadcast reaches the open connections; empty text is VALIDATION_ERROR', async () => {
    const { connect, tcp } = await startTestbed();
    const agent = await connect('m5-agent');
    const client = await tcp();
    expect(await agent.call<Record<string, unknown>>('sample_broadcast', { text: 'hi' })).toEqual({
      sent: 1,
    });
    expect(new TextDecoder().decode(await client.receive(2))).toBe('hi');
    await agent.fail('sample_broadcast', { text: '' }, 'VALIDATION_ERROR');
  });

  test('a broadcast result says in words where it went, also when nowhere', async () => {
    const { connect, tcp } = await startTestbed();
    const agent = await connect('m5-agent');
    const none = await agent.raw('sample_broadcast', { text: 'hi' });
    expect(none.content[0]?.text).toBe('열린 연결이 없어 아무에게도 보내지 않음(sent: 0)');
    expect(none.structuredContent).toEqual({ sent: 0 });
    await tcp();
    const one = await agent.raw('sample_broadcast', { text: 'hi' });
    expect(one.content[0]?.text).toBe('열린 연결 1개에 보냄(sent: 1)');
  });

  test('set_config with an unsupported fault kind is VALIDATION_ERROR; a port change needs a restart', async () => {
    const { connect } = await startTestbed();
    const agent = await connect('m5-agent');
    const error = await agent.fail(
      'set_config',
      { core: 'sample', patch: { faults: [{ id: 'f1', error: 'x' }] } },
      'VALIDATION_ERROR',
    );
    expect(error.message).toContain('도구의 입력 스키마에 맞춰 다시 호출');
    expect(
      await agent.call('set_config', { core: 'sample', patch: { maxConnections: 5 } }),
    ).toMatchObject({ result: 'applied', config: { maxConnections: 5 } });
    expect(await agent.call('get_config', { core: 'sample' })).toMatchObject({
      maxConnections: 5,
    });
    const missing = await agent.fail('get_config', { core: 'nope' }, 'NOT_FOUND');
    expect(missing.message).toBe("core 'nope' 없음. 있는 core: sample");
    expect(missing.details).toMatchObject({ known: ['sample'] });
  });

  test('set_config with a key the config does not have is VALIDATION_ERROR, and nothing changes', async () => {
    const { connect } = await startTestbed();
    const agent = await connect('m5-agent');
    const before = await agent.call<Record<string, unknown>>('get_config', { core: 'sample' });
    const error = await agent.fail(
      'set_config',
      { core: 'sample', patch: { eventLevl: 'debug', maxConnections: 7 } },
      'VALIDATION_ERROR',
    );
    expect(error.message).toContain('eventLevl');
    expect(error.details).toEqual([
      expect.objectContaining({ path: 'eventLevl', code: 'unknown_key' }),
    ]);
    expect(await agent.call<Record<string, unknown>>('get_config', { core: 'sample' })).toEqual(
      before,
    );
  });
});

describe('auth and session limits', () => {
  test('with TESTBED_CONTROL_TOKEN, initialize needs the Bearer token', async () => {
    const { initialize, connect } = await startTestbed({ TESTBED_CONTROL_TOKEN: 'x' });
    expect((await initialize()).status).toBe(401);
    expect((await initialize({ authorization: 'Bearer wrong' })).status).toBe(401);
    const agent = await connect('m5-agent', { authorization: 'Bearer x' });
    expect(await agent.call<Record<string, unknown>>('release_control')).toEqual({
      released: false,
    });
  });

  test('TESTBED_MCP_MAX_SESSIONS=1: a second initialize is 503 with a JSON-RPC error', async () => {
    const { connect, initialize } = await startTestbed({ TESTBED_MCP_MAX_SESSIONS: '1' });
    await connect('m5-agent');
    const refused = await initialize();
    expect(refused.status).toBe(503);
    expect(await refused.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      error: {
        message: 'MCP 세션이 상한(1)에 도달함. 쓰지 않는 세션을 닫거나(`DELETE`) 잠시 뒤 다시 시도',
      },
    });
  });

  test('TESTBED_MCP_SESSION_IDLE_SEC=1: an idle session is closed with its lease', async () => {
    const { connect, runtime, mcpUrl } = await startTestbed({ TESTBED_MCP_SESSION_IDLE_SEC: '1' });
    const agent = await connect('m5-agent');
    await agent.call('acquire_control');
    const released = await waitForEvent(
      runtime.bus,
      (event) => event.kind === 'testbed.lease.released',
      3000,
    );
    expect(released.payload).toMatchObject({ reason: 'session-closed' });

    const after = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-session-id': agent.sessionId,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list', params: {} }),
    });
    expect(after.status).toBe(404);
  });
});
