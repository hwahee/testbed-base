import { defineSmoke } from '@server/testbed/smoke';

export default defineSmoke({
  name: 'sample-faults',
  title: 'disconnect는 연결을 닫고, corrupt는 바이트를 0xFF와 XOR함',
  spec: 'docs/spec.md §11 M3',
  requires: { cores: ['sample'] },
  async run(t) {
    await t.call('start_run', { label: 'smoke:sample-faults' });
    const echo = t.endpoint('sample', 'echo');

    await t.call('set_config', {
      core: 'sample',
      patch: { faults: [{ id: 'f-disconnect', disconnect: true }] },
    });
    const dropped = await t.tcp(echo);
    dropped.send('hello');
    // The core records the close before it ends the socket.
    await dropped.closed();
    await t.expectCheck({ kind: 'testbed.fault.injected' }, { count: '==1' });
    const closed = await t.call<{ events: { summary: string }[] }>('query_events', {
      runId: 'current',
      kind: 'sample.connection.closed',
    });
    t.ok(
      closed.events.some((line) => line.summary.includes('(fault)')),
      "the connection closed with reason 'fault'",
    );

    await t.call('set_config', {
      core: 'sample',
      patch: { faults: [{ id: 'f-corrupt', corrupt: true }] },
    });
    const garbled = await t.tcp(echo);
    garbled.send(new Uint8Array([0x00, 0x0f, 0xf0, 0xff]));
    t.equal([...(await garbled.receiveBytes(4))], [0xff, 0xf0, 0x0f, 0x00], 'XOR 0xFF');

    await t.call('set_config', { core: 'sample', patch: { faults: [] } });
    const clean = await t.tcp(echo);
    clean.send('ok');
    t.equal(await clean.receive(2), 'ok', 'no fault once the rules are cleared');
    await t.call('end_run', {});
  },
});
