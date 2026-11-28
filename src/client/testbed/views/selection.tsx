/**
 * The event picked in the log or the agent timeline, shared with the detail
 * panel. The frame owns it; a layout that reacts to a pick (e.g. opens the
 * detail sheet on narrow screens) registers with `useSelectListener`.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { TestbedEvent } from '@shared/testbed/events';

import { SelectListeners } from './select-listeners';

interface Selection {
  selected: TestbedEvent | null;
  select: (event: TestbedEvent) => void;
}

const SelectionContext = createContext<Selection | null>(null);
const ListenersContext = createContext<SelectListeners | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<TestbedEvent | null>(null);
  const [listeners] = useState(() => new SelectListeners());
  // Goes down through context, so its identity matters (CLAUDE.md).
  const value = useMemo(
    () => ({
      selected,
      select: (event: TestbedEvent) => {
        setSelected(event);
        listeners.notify(event);
      },
    }),
    [selected, listeners],
  );
  return (
    <ListenersContext.Provider value={listeners}>
      <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
    </ListenersContext.Provider>
  );
}

/** @public the selected event (docs/testbed/dashboard.md §4) */
export function useSelection(): Selection {
  const selection = useContext(SelectionContext);
  if (!selection) throw new Error('useSelection needs <SelectionProvider> above it.');
  return selection;
}

/**
 * Calls `listener` every time an event is picked — the same event picked
 * again too. The layout decides what a pick does (the default layout opens
 * the detail sheet on narrow screens).
 * @public (docs/testbed/dashboard.md §0)
 */
export function useSelectListener(listener: (event: TestbedEvent) => void): void {
  const listeners = useContext(ListenersContext);
  if (!listeners) throw new Error('useSelectListener needs <SelectionProvider> above it.');
  // The latest listener, without re-registering on every render.
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => listeners.add((event) => latest.current(event)), [listeners]);
}
