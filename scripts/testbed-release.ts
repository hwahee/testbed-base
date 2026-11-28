/**
 * `bun run testbed:release` — forcibly releases the control lease of the
 * testbed running on this machine (docs/testbed/control-plane.md §2). The
 * emergency exit besides the TTL; the dashboard has no such button.
 *
 * It calls the local-only path, so it works only on the machine (or inside
 * the container) the testbed runs on. The release is recorded as
 * `testbed.lease.released` with `actor: 'system'`, `reason: 'forced'`.
 *
 *   bun run testbed:release            # PORT from the env, else PORT_BLOCK
 */
import { PORT_BLOCK } from '../src/server/testbed/cores/port-block';

const port =
  process.env.PORT === undefined || process.env.PORT === '' ? String(PORT_BLOCK) : process.env.PORT;
const url = `http://127.0.0.1:${port}/testbed/internal/release`;

try {
  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) {
    console.error(`release failed: HTTP ${response.status} from ${url}`);
    process.exit(1);
  }
  const { released } = (await response.json()) as { released: boolean };
  console.log(released ? 'lease released (forced)' : 'no lease was held');
} catch (error) {
  console.error(
    `no testbed answering at ${url}: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
