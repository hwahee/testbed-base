/**
 * Sample core config (docs/spec.md §7) and its env defaults.
 */
import { faultRuleSchema } from '@shared/testbed/faults';
import { s, toValidator, type Infer } from '@shared/validation';

export const sampleConfigValidator = toValidator(
  s.object({
    port: s.int().check(s.gte(0), s.lte(65535)),
    autoStart: s.boolean(),
    maxConnections: s.int().check(s.gte(1), s.lte(10_000)),
    maxChunkBytes: s.int().check(s.gte(1), s.lte(1_048_576)),
    idleTimeoutMs: s.int().check(s.gte(0), s.lte(3_600_000)),
    eventLevel: s.enum(['debug', 'info']),
    faults: s.array(faultRuleSchema),
  }),
);

export type SampleConfig = Infer<typeof sampleConfigValidator>;

function intFrom(value: string | undefined, fallback: number): number {
  return value === undefined || value === '' ? fallback : Number(value);
}

/** Raw defaults; the host validates them, so a bad env value fails the boot. */
export function sampleDefaultConfig(env: Record<string, string | undefined>): unknown {
  return {
    port: intFrom(env.SAMPLE_PORT, 40001),
    autoStart: env.SAMPLE_AUTO_START === undefined ? true : env.SAMPLE_AUTO_START !== 'false',
    maxConnections: intFrom(env.SAMPLE_MAX_CONNECTIONS, 100),
    maxChunkBytes: intFrom(env.SAMPLE_MAX_CHUNK_BYTES, 65_536),
    idleTimeoutMs: intFrom(env.SAMPLE_IDLE_TIMEOUT_MS, 0),
    eventLevel: 'info',
    faults: [],
  };
}
