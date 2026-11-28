import { defineSmoke } from '@server/testbed/smoke';

export default defineSmoke({
  name: 'sample-echo',
  title: '보낸 바이트가 그대로 돌아오고 이벤트가 남음',
  spec: 'docs/spec.md §11 M3',
  requires: { cores: ['sample'] },
  async run(t) {
    await t.call('start_run', { label: 'smoke:sample-echo' });
    const echo = await t.tcp(t.endpoint('sample', 'echo'));
    echo.send('hello');
    t.equal(await echo.receive(5), 'hello');
    await t.expectCheck({ kind: 'sample.data.echoed' }, { count: '==1' });
    await t.call('end_run', {});
  },
});
