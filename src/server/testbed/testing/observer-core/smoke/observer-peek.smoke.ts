import { defineSmoke } from '@server/testbed/smoke';

export default defineSmoke({
  name: 'observer-peek',
  title: '관찰 코어: 이벤트 없이 ageSec가 올라가고, peek은 락 없이 읽힘',
  spec: 'docs/spec.md §11 M19',
  requires: { cores: ['observer'] },
  async run(t) {
    const first = await t.call<{ ageSec: number; sinceAt: string | null }>('observer_peek', {});
    t.ok(first.sinceAt !== null, 'started (sinceAt set)');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const second = await t.call<{ ageSec: number }>('observer_peek', {});
    t.ok(second.ageSec > first.ageSec, `ageSec went up (${first.ageSec} → ${second.ageSec})`);
  },
});
