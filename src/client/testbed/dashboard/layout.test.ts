/**
 * The frame and layout split (docs/spec.md §11 M16): the layout in use, the
 * pick listeners and the `?view=` address rules.
 */
import { describe, expect, test } from 'bun:test';

import type { TestbedEvent } from '@shared/testbed/events';

import { layout } from '../cores/layout';
import { SelectListeners } from '../views/select-listeners';
import { searchWithView, viewFromSearch } from './layout-view';

const VIEWS = ['live', 'history'] as const;

describe('layout', () => {
  test("this repository's layout is the default one", () => {
    expect(layout.id).toBe('default');
    expect(layout.footer).toBeUndefined();
  });
});

describe('pick listeners', () => {
  test('a registered listener hears every pick, the same event twice too; unsubscribed hears none', () => {
    const listeners = new SelectListeners();
    const heard: string[] = [];
    const off = listeners.add((event) => heard.push(event.id));
    const event = { id: 'e:1' } as TestbedEvent;
    listeners.notify(event);
    listeners.notify(event);
    expect(heard).toEqual(['e:1', 'e:1']);
    off();
    listeners.notify(event);
    expect(heard).toHaveLength(2);
  });
});

describe('useLayoutView address rules', () => {
  test('the address gives the view; absent or unknown is the default view', () => {
    expect(viewFromSearch('?view=history', VIEWS, 'live')).toBe('history');
    expect(viewFromSearch('', VIEWS, 'live')).toBe('live');
    expect(viewFromSearch('?view=nope&tab=runs', VIEWS, 'live')).toBe('live');
  });

  test('changing the view keeps the other keys; the default view leaves the address', () => {
    expect(searchWithView('?tab=runs&kind=sample', 'history', 'live')).toBe(
      '?tab=runs&kind=sample&view=history',
    );
    expect(searchWithView('?tab=runs&view=history', 'live', 'live')).toBe('?tab=runs');
    expect(searchWithView('?view=history', 'live', 'live')).toBe('');
  });
});
