/**
 * Observer core (docs/spec.md §11 M19): a test-only core shaped like a
 * testbed's "observer" core — no data plane, one read-only action, no faults.
 * While running, `counters.ageSec` goes up every `tickMs` with no event, so the
 * dashboard's view of values that change without events can be tested.
 */
import { faultRuleSchema } from '@shared/testbed/faults';
import { s, toValidator, type Infer } from '@shared/validation';

import type { CoreContext, CoreDefinition, CoreInstance } from '../../core';

const observerConfigValidator = toValidator(
  s.object({
    autoStart: s.boolean(),
    eventLevel: s.enum(['debug', 'info']),
    faults: s.array(faultRuleSchema),
    tickMs: s.int().check(s.gte(10), s.lte(60_000)),
  }),
);

type ObserverConfig = Infer<typeof observerConfigValidator>;

function observerDefaultConfig(env: Record<string, string | undefined>): unknown {
  const tick = env.OBSERVER_TICK_MS;
  return {
    autoStart: env.OBSERVER_AUTO_START !== 'false',
    eventLevel: 'info',
    faults: [],
    tickMs: tick === undefined || tick === '' ? 1000 : Number(tick),
  };
}

class ObserverCore implements CoreInstance {
  private ageSec = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  /** When the core last started (UTC ISO), `null` before. */
  private sinceAt: string | null = null;

  constructor(private readonly ctx: CoreContext<ObserverConfig>) {}

  start(): Promise<void> {
    this.sinceAt = new Date().toISOString();
    this.schedule();
    return Promise.resolve();
  }

  stop(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    return Promise.resolve();
  }

  reset(): Promise<void> {
    this.ageSec = 0;
    return Promise.resolve();
  }

  applyConfig(): Promise<'applied'> {
    if (this.timer !== undefined) this.schedule();
    return Promise.resolve('applied');
  }

  status() {
    return { endpoints: [], counters: { ageSec: this.ageSec } };
  }

  /** The current counters (the `peek` action). */
  peek(): { ageSec: number; sinceAt: string | null } {
    return { ageSec: this.ageSec, sinceAt: this.sinceAt };
  }

  private schedule(): void {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.ageSec += 1;
    }, this.ctx.config().tickMs);
    this.timer.unref();
  }
}

const peekOutput = toValidator(
  s.object({ ageSec: s.int().check(s.gte(0)), sinceAt: s.nullable(s.string()) }),
);

export const observerCore: CoreDefinition<ObserverConfig, ObserverCore> = {
  id: 'observer',
  kind: 'passive',
  title: 'Observer (test)',
  configSchema: observerConfigValidator,
  defaultConfig: observerDefaultConfig,
  actions: {
    peek: {
      title: 'Peek',
      description: '지금 카운터(ageSec)와 시작 시각(sinceAt)을 돌려줌. 아무것도 바꾸지 않음.',
      input: toValidator(s.object({})),
      output: peekOutput,
      mutating: false,
      summarize: (output) => `ageSec ${(output as { ageSec: number }).ageSec}`,
      run: (instance) => Promise.resolve(instance.peek()),
    },
  },
  create: (ctx) => new ObserverCore(ctx),
};
