/**
 * A layout's views (docs/testbed/dashboard.md §0): a layout with two or more
 * views (e.g. "live" / "history") keeps the chosen one in the address as
 * `?view=`, so a reload, a shared link or going back opens the same view.
 * No router: `history.replaceState` changes `view` only, other query keys stay.
 */
import { useCallback, useSyncExternalStore } from 'react';

const CHANGE = 'testbed:layout-view';

/** The view the address asks for; the default one when absent or unknown. */
export function viewFromSearch<V extends string>(
  search: string,
  views: readonly V[],
  defaultView: V,
): V {
  const asked = new URLSearchParams(search).get('view');
  return asked !== null && (views as readonly string[]).includes(asked)
    ? (asked as V)
    : defaultView;
}

/** `search` with `view` set (removed for the default view); other keys untouched. */
export function searchWithView(search: string, view: string, defaultView: string): string {
  const params = new URLSearchParams(search);
  if (view === defaultView) params.delete('view');
  else params.set('view', view);
  const next = params.toString();
  return next === '' ? '' : `?${next}`;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

const currentSearch = () => window.location.search;

/**
 * `[view, setView]`. An address value not in `views` gives the default view
 * and the address is left as it is.
 * @public (docs/testbed/dashboard.md §0)
 */
export function useLayoutView<V extends string>(
  views: readonly V[],
  defaultView: V,
): [V, (view: V) => void] {
  const search = useSyncExternalStore(subscribe, currentSearch, () => '');
  const view = viewFromSearch(search, views, defaultView);
  // A `.ts` hook's returned function: its identity is kept (CLAUDE.md).
  const setView = useCallback(
    (next: V) => {
      const { pathname, search: now, hash } = window.location;
      const target = `${pathname}${searchWithView(now, next, defaultView)}${hash}`;
      window.history.replaceState(window.history.state, '', target);
      window.dispatchEvent(new Event(CHANGE));
    },
    [defaultView],
  );
  return [view, setView];
}
