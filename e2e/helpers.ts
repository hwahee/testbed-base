/**
 * What the UI tests do outside the browser: act as the product (TCP) and as
 * an agent or CI (REST), and put the shared instance back to a known state.
 */
import { connect, type Socket } from 'node:net';

import type { Page, WebSocketRoute } from '@playwright/test';

const BASE = process.env.TESTBED_UI_URL ?? '';
if (BASE === '') {
  throw new Error('TESTBED_UI_URL is not set: run the UI tests with `bun run test:ui`.');
}

export async function api<T = Record<string, unknown>>(
  method: string,
  path: string,
  options: { actor?: 'agent' | 'ci'; lease?: string; body?: unknown } = {},
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${BASE}/testbed/api${path}`, {
    method,
    headers: {
      ...(options.actor === undefined ? {} : { 'x-testbed-actor': options.actor }),
      ...(options.lease === undefined ? {} : { 'x-testbed-lease': options.lease }),
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  return { status: response.status, body: (text === '' ? {} : JSON.parse(text)) as T };
}

/** Takes the lease as an agent over REST; `release()` gives it back. */
export async function takeLease(): Promise<{ leaseId: string; release: () => Promise<void> }> {
  const { status, body } = await api<{ leaseId: string }>('POST', '/lease', { actor: 'agent' });
  if (status !== 200) throw new Error(`lease: HTTP ${status}`);
  return {
    leaseId: body.leaseId,
    release: async () => {
      await api('DELETE', '/lease', { actor: 'agent', lease: body.leaseId });
    },
  };
}

/** The sample core's data-plane port, as the instance reports it. */
export async function echoPort(): Promise<number> {
  const { body } = await api<{ cores: { id: string; endpoints: { url: string }[] }[] }>(
    'GET',
    '/status',
  );
  const url = body.cores.find((core) => core.id === 'sample')?.endpoints[0]?.url ?? '';
  return Number(new URL(url.replace(/^tcp:/, 'http:')).port);
}

export interface TcpClient {
  send(text: string): void;
  /** Resolves with what has arrived once `text` is in it. */
  received(text: string, timeoutMs?: number): Promise<string>;
  closed(timeoutMs?: number): Promise<void>;
  close(): void;
}

const open: Socket[] = [];

/** A product-side TCP connection to the echo core. */
export async function tcp(): Promise<TcpClient> {
  const port = await echoPort();
  const socket = connect(port, '127.0.0.1');
  open.push(socket);
  let data = '';
  let ended = false;
  socket.on('data', (chunk) => (data += chunk.toString('utf8')));
  socket.on('close', () => (ended = true));
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const until = async (done: () => boolean, timeoutMs: number, what: string) => {
    const deadline = Date.now() + timeoutMs;
    while (!done()) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  return {
    send: (text) => socket.write(text),
    received: async (text, timeoutMs = 5000) => {
      await until(() => data.includes(text), timeoutMs, `"${text}" (got "${data}")`);
      return data;
    },
    closed: (timeoutMs = 5000) => until(() => ended, timeoutMs, 'the connection to close'),
    close: () => socket.destroy(),
  };
}

let registered: Promise<string[]> | undefined;

/** Whether the instance runs core `id` (read once from the manifest). */
export async function hasCore(id: string): Promise<boolean> {
  registered ??= api<{ cores: { id: string }[] }>('GET', '/manifest').then(({ body }) =>
    body.cores.map((core) => core.id),
  );
  return (await registered).includes(id);
}

/** Why the sample core's tests skip on this instance (a testbed that does not register it). */
export const NO_SAMPLE_CORE =
  'the sample core is not registered on this instance (a testbed drops it from CORES)';

/**
 * Back to a known state: no lease (forced through the local-only path), no
 * open Run, the sample core (when registered) running with no fault rules,
 * no TCP clients.
 */
export async function resetTestbed(): Promise<void> {
  for (const socket of open.splice(0)) socket.destroy();
  await fetch(`${BASE}/testbed/internal/release`, { method: 'POST' });
  await api('POST', '/runs/current/end');
  if (!(await hasCore('sample'))) return;
  await api('PATCH', '/cores/sample/config', {
    body: { faults: [], maxConnections: 100, maxChunkBytes: 65_536, idleTimeoutMs: 0 },
  });
  await api('POST', '/cores/sample/start');
}

/**
 * Holds back the dashboard's live updates while `hold()` is on, so a test can
 * act before the page learns about a change (e.g. click save just as the
 * lease is taken).
 */
export async function gateLiveUpdates(
  page: Page,
): Promise<{ hold: () => void; flush: () => void }> {
  let holding = false;
  const queued: { route: WebSocketRoute; message: string | Buffer }[] = [];
  await page.routeWebSocket('**/testbed/ws', (route) => {
    const server = route.connectToServer();
    server.onMessage((message) => {
      if (holding) queued.push({ route, message });
      else route.send(message);
    });
  });
  return {
    hold: () => {
      holding = true;
    },
    flush: () => {
      holding = false;
      for (const { route, message } of queued.splice(0)) route.send(message);
    },
  };
}
