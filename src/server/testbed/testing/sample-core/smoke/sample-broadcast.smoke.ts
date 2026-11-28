import { defineSmoke } from '@server/testbed/smoke';

export default defineSmoke({
  name: 'sample-broadcast',
  title: 'broadcast가 열린 연결 모두에 닿음',
  spec: 'docs/spec.md §11 M3',
  requires: { cores: ['sample'] },
  async run(t) {
    await t.call('start_run', { label: 'smoke:sample-broadcast' });
    const started = await t.call<{ events: { id: string }[] }>('query_events', {
      runId: 'current',
      kind: 'testbed.run.started',
    });
    const echo = t.endpoint('sample', 'echo');
    const first = await t.tcp(echo);
    const second = await t.tcp(echo);
    // Both connections are open on the server before broadcasting.
    await t.waitFor({ kind: 'sample.connection.opened', after: started.events[0]?.id }, 2);
    const result = await t.call<{ sent: number }>('sample_broadcast', { text: 'hi' });
    t.equal(result.sent, 2, 'sent to both connections');
    t.equal(await first.receive(2), 'hi');
    t.equal(await second.receive(2), 'hi');
    await t.call('end_run', {});
  },
});
