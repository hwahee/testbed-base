import { describe, expect, test } from 'bun:test';

import type { TestbedSocketMessage } from '@shared/testbed/control';

import { sampleCore } from '../testing/sample-core';
import { createTestControlPlane } from '../testing';

describe('WS back-pressure', () => {
  test('above 200 events a second the stream is sampled and the batches count what was left out', async () => {
    const { runtime, plane } = await createTestControlPlane({ cores: [sampleCore] });
    const received: TestbedSocketMessage[] = [];
    plane.hub.open({
      send: (data: string) => received.push(JSON.parse(data) as TestbedSocketMessage),
    });

    for (let i = 0; i < 1200; i += 1) {
      runtime.bus.emit({
        core: 'sample',
        kind: 'sample.data.echoed',
        actor: 'product',
        summary: `#${i}`,
      });
    }
    // Wait for the 100 ms flush by waiting on a message, not on time.
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        if (received.some((message) => message.type === 'event')) {
          clearInterval(timer);
          resolve();
        }
      }, 10);
    });

    const batches = received.filter(
      (message): message is Extract<TestbedSocketMessage, { type: 'event' }> =>
        message.type === 'event',
    );
    const sent = batches.reduce((sum, batch) => sum + batch.events.length, 0);
    const omitted = batches.reduce((sum, batch) => sum + batch.omitted, 0);
    expect(sent + omitted).toBe(1200);
    expect(sent).toBe(200 + 100);
    expect(omitted).toBe(900);
    // Nothing is lost where it is kept.
    expect(
      runtime.bus.buffered().filter((event) => event.kind === 'sample.data.echoed'),
    ).toHaveLength(1200);
    await plane.dispose();
  });
});

describe('WS state pushes', () => {
  test('the status after a Run ends no longer shows it open; after it starts, it does', async () => {
    const { plane } = await createTestControlPlane({ cores: [sampleCore] });
    const received: TestbedSocketMessage[] = [];
    plane.hub.open({
      send: (data: string) => received.push(JSON.parse(data) as TestbedSocketMessage),
    });
    const statuses = () =>
      received.filter(
        (message): message is Extract<TestbedSocketMessage, { type: 'status' }> =>
          message.type === 'status',
      );

    const run = await plane.control.startRun({ label: 'ws' }, { actor: 'ci', leaseId: 'x' });
    await Promise.resolve();
    expect(statuses().at(-1)?.status.run?.runId).toBe(run.runId);

    await plane.control.endRun({ actor: 'ci', leaseId: 'x' });
    await Promise.resolve();
    expect(statuses().at(-1)?.status.run).toBeNull();
    await plane.dispose();
  });

  test('a lease message carries the lease as it is after the change', async () => {
    const { plane } = await createTestControlPlane({ cores: [sampleCore] });
    const received: TestbedSocketMessage[] = [];
    plane.hub.open({
      send: (data: string) => received.push(JSON.parse(data) as TestbedSocketMessage),
    });
    const leases = () =>
      received.filter(
        (message): message is Extract<TestbedSocketMessage, { type: 'lease' }> =>
          message.type === 'lease',
      );
    const { leaseId } = plane.control.acquireLease({ actor: 'agent' });
    await Promise.resolve();
    expect(leases().at(-1)?.lease?.actor).toBe('agent');
    plane.control.releaseLease({ actor: 'agent', ...(leaseId === undefined ? {} : { leaseId }) });
    await Promise.resolve();
    expect(leases().at(-1)?.lease).toBeNull();
    await plane.dispose();
  });
});

describe('WS counters', () => {
  test('data-plane events bring a status with fresh counters, at most once a second', async () => {
    const { runtime, plane } = await createTestControlPlane({ cores: [sampleCore] });
    await runtime.host.startAutoStart();
    const received: TestbedSocketMessage[] = [];
    plane.hub.open({
      send: (data: string) => received.push(JSON.parse(data) as TestbedSocketMessage),
    });
    const statuses = () => received.filter((message) => message.type === 'status');
    const before = statuses().length;
    for (let i = 0; i < 50; i += 1) {
      runtime.bus.emit({
        core: 'sample',
        kind: 'sample.data.echoed',
        actor: 'product',
        summary: `#${i}`,
      });
    }
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        if (statuses().length > before) {
          clearInterval(timer);
          resolve();
        }
      }, 10);
    });
    // One status for the burst, not one per event.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(statuses().length - before).toBe(1);
    await runtime.host.stopAll();
    await plane.dispose();
  });
});
