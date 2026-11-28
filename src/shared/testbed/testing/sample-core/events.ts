/**
 * Event payloads of the sample core (docs/spec.md §6).
 */
export type SampleCloseReason = 'client' | 'server' | 'idle' | 'too-large' | 'fault' | 'stop';

export interface SampleEventPayloads {
  'sample.connection.opened': { connId: string; remote: string };
  'sample.connection.rejected': { remote: string; max: number };
  'sample.data.received': { connId: string; bytes: number };
  'sample.data.echoed': {
    connId: string;
    bytes: number;
    /** The first 64 bytes as UTF-8 (lossy). */
    preview: string;
    sha256: string;
    faultId?: string;
  };
  'sample.data.too-large': { connId: string; bytes: number; max: number };
  'sample.connection.closed': {
    connId: string;
    reason: SampleCloseReason;
    durationMs: number;
    bytesIn: number;
    bytesOut: number;
  };
  'sample.broadcast.sent': { bytes: number; connections: number };
}
