/**
 * React access to the dashboard store. Components (and cores' own panels)
 * read live state only through these hooks; operating goes through REST
 * (`testbedApi`, src/client/api/endpoints.ts).
 */
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { TestbedManifest, TestbedStatus } from '@shared/testbed/control';
import { matchesFilter, type EventFilter, type TestbedEvent } from '@shared/testbed/events';
import type { LeaseView } from '@shared/testbed/lease';

import { testbedApi } from '../../api/endpoints';
import { TestbedStore, type TestbedSnapshot } from './store';

const StoreContext = createContext<TestbedStore | null>(null);

/** Owns one store (one WS connection) for the subtree. `store` is for tests. */
export function TestbedStoreProvider({
  store,
  children,
}: {
  store?: TestbedStore;
  children: ReactNode;
}) {
  const [own] = useState(() => store ?? new TestbedStore());
  useEffect(() => {
    own.start();
    return () => own.stop();
  }, [own]);
  return createElement(StoreContext.Provider, { value: own }, children);
}

function useStore(): TestbedStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Testbed hooks need <TestbedStoreProvider> above them.');
  return store;
}

/** The whole live snapshot (re-renders at most 10 times a second). */
export function useTestbed(): TestbedSnapshot {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/**
 * The manifest (`GET /manifest`), read again when the instance changes. The
 * frame and the layout share this query key.
 * @public (docs/testbed/dashboard.md §0)
 */
export function useTestbedManifest(): UseQueryResult<TestbedManifest> {
  const instanceId = useTestbed().status?.instanceId;
  return useQuery({
    queryKey: ['testbed', 'manifest', instanceId] as const,
    queryFn: () => testbedApi.manifest(),
    enabled: instanceId !== undefined,
  });
}

/** Clears the "testbed restarted" notice. */
export function useDismissRestart(): () => void {
  const store = useStore();
  return useMemo(() => () => store.dismissRestart(), [store]);
}

/**
 * Cores, the open Run and the lease; `null` before the first snapshot.
 * @public for cores' own panels (docs/testbed/dashboard.md §4)
 */
export function useTestbedStatus(): TestbedStatus | null {
  return useTestbed().status;
}

/** The lease and when it arrived (its `remainingMs` counts from `receivedAt`). */
export function useLease(): { lease: LeaseView | null; receivedAt: number } {
  const { lease, leaseReceivedAt } = useTestbed();
  return useMemo(() => ({ lease, receivedAt: leaseReceivedAt }), [lease, leaseReceivedAt]);
}

/**
 * Whether a person may operate now: nobody holds the lease
 * (docs/testbed/dashboard.md §2). Every operating control decides with this.
 * @public used by the operating controls (P3 M8) and cores' own panels
 */
export function useCanOperate(): boolean {
  return useTestbed().lease === null;
}

/**
 * The stored events that match `filter` (`runId: 'current'` = the open Run).
 * `after` and `limit` do not apply — this is the live window, not a query.
 * @public for cores' own panels (docs/testbed/dashboard.md §4)
 */
export function useTestbedEvents(filter: EventFilter = {}): readonly TestbedEvent[] {
  const { events, status } = useTestbed();
  const openRun = status?.run?.runId ?? null;
  const { runId, core, kind, level, actor, correlationId, replica, text } = filter;
  return useMemo(() => {
    const wanted: EventFilter = {
      ...(core === undefined ? {} : { core }),
      ...(kind === undefined ? {} : { kind }),
      ...(level === undefined ? {} : { level }),
      ...(actor === undefined ? {} : { actor }),
      ...(correlationId === undefined ? {} : { correlationId }),
      ...(replica === undefined ? {} : { replica }),
      ...(text === undefined ? {} : { text }),
    };
    const run = runId === 'current' ? openRun : runId;
    return events.filter(
      (event) => (runId === undefined || event.runId === run) && matchesFilter(event, wanted),
    );
  }, [events, openRun, runId, core, kind, level, actor, correlationId, replica, text]);
}
