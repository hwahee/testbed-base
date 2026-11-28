/**
 * The observer core (a test-only core): no data plane, a read-only action,
 * and `counters.ageSec` that changes every `tickMs` without an event.
 */
import { afterEach, describe, expect, test } from 'bun:test';

import { silentLogger } from '../../../lib/log';
import { CoreHost } from '../../core-host';
import { EventBus } from '../../events/bus';
import { createMemoryRunStore } from '../../runs/memory-store';
import { RunManager } from '../../runs/runs';
import { observerCore } from '.';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function boot(env: Record<string, string> = {}) {
  const bus = new EventBus({ instanceId: 'test' });
  const runs = new RunManager(bus, createMemoryRunStore(), { bootSeed: 'observer-test' });
  const host = new CoreHost({ bus, runs, log: silentLogger, env });
  host.register(observerCore);
  await host.startAutoStart();
  cleanups.push(() => host.stopAll());
  return { bus, host };
}

describe('observer core', () => {
  test('ageSec goes up every tickMs with no event of its own; no data plane, no faults', async () => {
    const { bus, host } = await boot({ OBSERVER_TICK_MS: '20' });
    expect(host.status('observer').state).toBe('running');
    expect(host.status('observer').endpoints).toEqual([]);
    expect(host.describe('observer').faults).toEqual([]);
    await Bun.sleep(120);
    expect(host.status('observer').counters.ageSec).toBeGreaterThanOrEqual(2);
    expect(bus.buffered().filter((event) => event.core === 'observer')).toEqual([]);
  });

  test('peek is read-only and returns the counters and the start time', async () => {
    const { host } = await boot();
    const action = host.describe('observer').actions.find((entry) => entry.name === 'peek');
    expect(action?.mutating).toBe(false);
    const out = (await host.invokeAction('observer', 'peek', {}, { actor: 'agent' })) as {
      ageSec: number;
      sinceAt: string;
    };
    expect(out.ageSec).toBe(0);
    expect(Date.parse(out.sinceAt)).not.toBeNaN();
  });
});
