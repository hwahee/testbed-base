/**
 * Sample core: a TCP echo server (docs/spec.md §3–§9). It exists to prove the
 * common runtime on a real data plane: every received chunk goes back as is,
 * with faults (`delay`, `disconnect`, `corrupt`) applied per chunk.
 */
import { createHash } from 'node:crypto';

import type {
  SampleCloseReason,
  SampleEventPayloads,
} from '@shared/testbed/testing/sample-core/events';
import type { Actor } from '@shared/testbed/events';
import { s, toValidator } from '@shared/validation';

import type { CoreContext, CoreDefinition, CoreInstance } from '../../core';
import { sampleConfigValidator, sampleDefaultConfig, type SampleConfig } from './config';

interface Connection {
  id: string;
  remote: string;
  openedAt: number;
  bytesIn: number;
  bytesOut: number;
  closed: boolean;
  /** Chunks are handled one at a time, so a delayed echo never overtakes. */
  chain: Promise<void>;
  /** Bytes the socket did not take yet; written on `drain`. */
  pending: Uint8Array[];
  idleTimer?: ReturnType<typeof setTimeout>;
}

type SampleSocket = Bun.Socket<Connection | undefined>;

const PREVIEW_BYTES = 64;
const decoder = new TextDecoder();

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export class SampleCore implements CoreInstance {
  private listener: Bun.TCPSocketListener<Connection | undefined> | undefined;
  /** The configured port the listener was opened with. */
  private startedPort: number | undefined;
  private readonly open = new Map<SampleSocket, Connection>();
  private nextConn = 1;
  private counters = { connectionsOpen: 0, connectionsTotal: 0, bytesIn: 0, bytesOut: 0 };

  constructor(private readonly ctx: CoreContext<SampleConfig>) {}

  private emit<K extends keyof SampleEventPayloads>(
    kind: K,
    payload: SampleEventPayloads[K],
    fields: {
      summary: string;
      level?: 'debug' | 'info' | 'warn';
      correlationId?: string;
      latencyMs?: number;
      actor?: Actor;
    },
  ): void {
    this.ctx.emit({ kind, payload, ...fields });
  }

  start(): Promise<void> {
    const { port } = this.ctx.config();
    this.startedPort = port;
    this.listener = Bun.listen<Connection | undefined>({
      hostname: this.ctx.bindHost,
      port,
      socket: {
        open: (socket) => this.onOpen(socket),
        data: (socket, chunk) => this.onData(socket, chunk),
        drain: (socket) => this.onDrain(socket),
        close: (socket) => this.onClientClose(socket),
        error: (socket) => this.onClientClose(socket),
      },
    });
    return Promise.resolve();
  }

  stop(): Promise<void> {
    this.closeAll('stop');
    this.listener?.stop(true);
    this.listener = undefined;
    return Promise.resolve();
  }

  reset(): Promise<void> {
    this.closeAll('server');
    this.nextConn = 1;
    this.counters = { connectionsOpen: 0, connectionsTotal: 0, bytesIn: 0, bytesOut: 0 };
    return Promise.resolve();
  }

  /** A new port needs a new listener; everything else is read live from the config. */
  applyConfig(next: SampleConfig): Promise<'applied' | 'restart-required'> {
    return Promise.resolve(
      this.startedPort !== undefined && next.port !== this.startedPort
        ? 'restart-required'
        : 'applied',
    );
  }

  status() {
    const port = this.listener?.port ?? this.ctx.config().port;
    return {
      endpoints: [{ name: 'echo', protocol: 'tcp', url: `tcp://${this.ctx.publicHost}:${port}` }],
      counters: { ...this.counters },
    };
  }

  /** Sends `text` to every open connection, without faults. */
  broadcast(text: string, actor: Actor): number {
    const bytes = new TextEncoder().encode(text);
    const connections = [...this.open.entries()].filter(([, conn]) => !conn.closed);
    for (const [socket, conn] of connections) this.write(socket, conn, bytes);
    this.emit(
      'sample.broadcast.sent',
      { bytes: bytes.byteLength, connections: connections.length },
      { summary: `broadcast ${bytes.byteLength}B to ${connections.length} conns`, actor },
    );
    return connections.length;
  }

  // ── Connections ──────────────────────────────────────────────────────────

  private onOpen(socket: SampleSocket): void {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    const { maxConnections } = this.ctx.config();
    if (this.open.size >= maxConnections) {
      this.emit(
        'sample.connection.rejected',
        { remote, max: maxConnections },
        { summary: `conn rejected from ${remote} (max ${maxConnections})`, level: 'warn' },
      );
      socket.end();
      return;
    }
    const conn: Connection = {
      id: `c-${this.nextConn++}`,
      remote,
      openedAt: performance.now(),
      bytesIn: 0,
      bytesOut: 0,
      closed: false,
      chain: Promise.resolve(),
      pending: [],
    };
    socket.data = conn;
    this.open.set(socket, conn);
    this.counters.connectionsOpen += 1;
    this.counters.connectionsTotal += 1;
    this.emit(
      'sample.connection.opened',
      { connId: conn.id, remote },
      { summary: `conn ${conn.id} opened from ${remote}`, correlationId: conn.id },
    );
    this.armIdle(socket, conn);
  }

  private onData(socket: SampleSocket, chunk: Buffer): void {
    const conn = socket.data;
    if (!conn || conn.closed) return;
    const bytes = new Uint8Array(chunk);
    const receivedAt = performance.now();
    conn.bytesIn += bytes.byteLength;
    this.counters.bytesIn += bytes.byteLength;
    this.armIdle(socket, conn);
    conn.chain = conn.chain.then(() => this.echo(socket, conn, bytes, receivedAt));
  }

  private async echo(
    socket: SampleSocket,
    conn: Connection,
    bytes: Uint8Array,
    receivedAt: number,
  ): Promise<void> {
    if (conn.closed) return;
    const { maxChunkBytes } = this.ctx.config();
    if (bytes.byteLength > maxChunkBytes) {
      this.emit(
        'sample.data.too-large',
        { connId: conn.id, bytes: bytes.byteLength, max: maxChunkBytes },
        {
          summary: `${conn.id} chunk ${bytes.byteLength}B > max ${maxChunkBytes}B, closing`,
          level: 'warn',
          correlationId: conn.id,
        },
      );
      this.close(socket, conn, 'too-large');
      return;
    }
    this.emit(
      'sample.data.received',
      { connId: conn.id, bytes: bytes.byteLength },
      {
        summary: `${conn.id} received ${bytes.byteLength}B`,
        level: 'debug',
        correlationId: conn.id,
      },
    );

    const decision = this.ctx.faults.decide(
      { connId: conn.id, remoteAddress: socket.remoteAddress },
      conn.id,
    );
    if (decision?.delayMs) await Bun.sleep(decision.delayMs);
    if (conn.closed) return;
    if (decision?.disconnect) {
      this.close(socket, conn, 'fault');
      return;
    }
    const out = decision?.corrupt ? bytes.map((byte) => byte ^ 0xff) : bytes;
    this.write(socket, conn, out);

    const latencyMs = Math.round(performance.now() - receivedAt);
    const faultId = decision?.ruleId;
    this.emit(
      'sample.data.echoed',
      {
        connId: conn.id,
        bytes: out.byteLength,
        preview: decoder.decode(out.subarray(0, PREVIEW_BYTES)),
        sha256: sha256(out),
        ...(faultId === undefined ? {} : { faultId }),
      },
      {
        summary: `${conn.id} echoed ${out.byteLength}B in ${latencyMs}ms${faultId === undefined ? '' : ` [fault ${faultId}]`}`,
        correlationId: conn.id,
        latencyMs,
      },
    );
  }

  private write(socket: SampleSocket, conn: Connection, bytes: Uint8Array): void {
    conn.bytesOut += bytes.byteLength;
    this.counters.bytesOut += bytes.byteLength;
    if (conn.pending.length > 0) {
      conn.pending.push(bytes);
      return;
    }
    const written = socket.write(bytes);
    if (written < bytes.byteLength) conn.pending.push(bytes.subarray(Math.max(0, written)));
  }

  private onDrain(socket: SampleSocket): void {
    const conn = socket.data;
    if (!conn) return;
    for (let next = conn.pending[0]; next !== undefined; next = conn.pending[0]) {
      const written = socket.write(next);
      if (written < next.byteLength) {
        conn.pending[0] = next.subarray(Math.max(0, written));
        return;
      }
      conn.pending.shift();
    }
  }

  private armIdle(socket: SampleSocket, conn: Connection): void {
    clearTimeout(conn.idleTimer);
    const { idleTimeoutMs } = this.ctx.config();
    if (idleTimeoutMs > 0) {
      conn.idleTimer = setTimeout(() => this.close(socket, conn, 'idle'), idleTimeoutMs);
    }
  }

  private onClientClose(socket: SampleSocket): void {
    const conn = socket.data;
    if (conn && !conn.closed) this.close(socket, conn, 'client', false);
  }

  /** Records the close first (so the event never waits on the socket), then ends the socket. */
  private close(
    socket: SampleSocket,
    conn: Connection,
    reason: SampleCloseReason,
    endSocket = true,
  ): void {
    if (conn.closed) return;
    conn.closed = true;
    clearTimeout(conn.idleTimer);
    this.open.delete(socket);
    this.counters.connectionsOpen = Math.max(0, this.counters.connectionsOpen - 1);
    const durationMs = Math.round(performance.now() - conn.openedAt);
    this.emit(
      'sample.connection.closed',
      { connId: conn.id, reason, durationMs, bytesIn: conn.bytesIn, bytesOut: conn.bytesOut },
      {
        summary: `conn ${conn.id} closed (${reason}) after ${seconds(durationMs)}, in ${conn.bytesIn}B out ${conn.bytesOut}B`,
        correlationId: conn.id,
      },
    );
    if (endSocket) socket.end();
  }

  private closeAll(reason: SampleCloseReason): void {
    for (const [socket, conn] of [...this.open]) this.close(socket, conn, reason);
  }
}

const broadcastInput = toValidator(
  s.object({ text: s.string().check(s.minLength(1), s.maxLength(4096)) }),
);
const broadcastOutput = toValidator(s.object({ sent: s.int().check(s.gte(0)) }));

export const sampleCore: CoreDefinition<SampleConfig, SampleCore> = {
  id: 'sample',
  kind: 'passive',
  title: 'TCP echo (sample)',
  configSchema: sampleConfigValidator,
  defaultConfig: sampleDefaultConfig,
  faults: ['delay', 'disconnect', 'corrupt'],
  actions: {
    broadcast: {
      title: 'Broadcast',
      description:
        '열린 TCP 연결 모두에 text(UTF-8, 1–4096자)를 보냄. 결함은 적용하지 않음. 보낸 연결 수(sent)를 돌려줌. 열린 연결이 없으면 0.',
      input: broadcastInput,
      output: broadcastOutput,
      mutating: true,
      summarize: (output) => {
        const { sent } = output as { sent: number };
        return sent === 0
          ? '열린 연결이 없어 아무에게도 보내지 않음(sent: 0)'
          : `열린 연결 ${sent}개에 보냄(sent: ${sent})`;
      },
      run: (instance, input, caller) => {
        const { text } = broadcastInput.parse(input);
        return Promise.resolve({ sent: instance.broadcast(text, caller.actor) });
      },
    },
  },
  create: (ctx) => new SampleCore(ctx),
};
