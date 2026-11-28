import { defineSmoke } from '@server/testbed/smoke';

export default defineSmoke({
  name: 'sample-run-replace',
  title: '열린 Run이 있으면 RUN_ACTIVE, endActive로 바꿔 열면 앞 Run은 replaced',
  spec: 'docs/spec.md §11 M4',
  requires: { cores: ['sample'] },
  async run(t) {
    const first = await t.call<{ runId: string }>('start_run', { label: 'smoke:replace-1' });
    const active = await t.callError('start_run', { label: 'smoke:replace-2' }, 'RUN_ACTIVE');
    t.ok(active.message.includes('endActive'), 'RUN_ACTIVE says how to go on');
    const second = await t.call<{ runId: string }>('start_run', {
      label: 'smoke:replace-2',
      endActive: true,
    });
    t.ok(second.runId !== first.runId, 'a new Run is open');
    const previous = await t.rest<{ endReason?: string }>('GET', `/runs/${first.runId}`, {
      actor: 'ci',
    });
    t.equal(previous.status, 200);
    t.equal(previous.body.endReason, 'replaced');
    await t.call('end_run', {});
  },
});
