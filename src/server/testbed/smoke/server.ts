/**
 * Boots this repository's server as a child process on a free port, for the
 * smoke (and, later, the UI tests): `TESTBED_RUN_STORE=memory`, every core's
 * data-plane port at 0. Resolves once `/api/health/ready` answers 200.
 */
import { CORES } from '../cores';
import { EXAMPLE_CORES } from '../examples';
import { REPO_ROOT } from './load';

const READY_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 5000;
const KEPT_LINES = 40;

export interface LocalTestbed {
  url: string;
  /** The server process. */
  pid: number;
  stop(this: void): Promise<void>;
}

/** The server did not come up (exit code 2). */
export class StartError extends Error {
  override readonly name = 'StartError';
}

function freePort(): number {
  const probe = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data: () => undefined } });
  const { port } = probe;
  probe.stop(true);
  return port;
}

/** `<CORE_ID>_PORT=0` for every core, the example cores included (docs/testbed/architecture.md §7). */
function corePortsAtZero(): Record<string, string> {
  return Object.fromEntries(
    [...CORES, ...EXAMPLE_CORES].map((core) => [
      `${core.id.toUpperCase().replaceAll('-', '_')}_PORT`,
      '0',
    ]),
  );
}

/** Keeps the last lines a stream wrote, for the error when start-up fails. */
function tail(stream: ReadableStream<Uint8Array>, lines: string[]): void {
  void (async () => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) {
      lines.push(...decoder.decode(chunk).split('\n').filter(Boolean));
      lines.splice(0, Math.max(0, lines.length - KEPT_LINES));
    }
  })();
}

export async function startLocalTestbed(
  options: { env?: Record<string, string> } = {},
): Promise<LocalTestbed> {
  const port = freePort();
  const url = `http://127.0.0.1:${port}`;
  const output: string[] = [];
  const child = Bun.spawn([process.execPath, 'src/server/index.ts'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      TESTBED_PUBLIC_URL: url,
      TESTBED_RUN_STORE: 'memory',
      SHUTDOWN_DRAIN_MS: '0',
      ...corePortsAtZero(),
      ...options.env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  tail(child.stdout, output);
  tail(child.stderr, output);

  async function stop(): Promise<void> {
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), STOP_TIMEOUT_MS);
    await child.exited;
    clearTimeout(timer);
  }

  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new StartError(`the server exited with code ${child.exitCode}:\n${output.join('\n')}`);
    }
    try {
      const response = await fetch(`${url}/api/health/ready`);
      if (response.status === 200) return { url, pid: child.pid, stop };
    } catch {
      // Not listening yet.
    }
    await Bun.sleep(100);
  }
  await stop();
  throw new StartError(
    `the server was not ready within ${READY_TIMEOUT_MS / 1000}s:\n${output.join('\n')}`,
  );
}
