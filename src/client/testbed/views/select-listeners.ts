/** Who hears of every pick in the selection (the same event picked again too). */
import type { TestbedEvent } from '@shared/testbed/events';

export class SelectListeners {
  private readonly listeners = new Set<(event: TestbedEvent) => void>();

  /** Returns the unsubscribe. */
  add(listener: (event: TestbedEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(event: TestbedEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
