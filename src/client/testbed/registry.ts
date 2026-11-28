/**
 * Panel slots (docs/testbed/dashboard.md §4): what a testbed adds to the
 * default layout without touching the frame. A core registers a module in
 * `src/client/testbed/cores/<core>/index.ts`, listed in `cores/index.ts` —
 * the same pattern as the server's `cores/index.ts`.
 */
import type { ComponentType } from 'react';

import type { MessageKey } from '@shared/i18n';

/**
 * What a core's own config form gets (M8: rendered inside the lock-aware editor).
 * @public part of the panel-slot contract
 */
export interface ConfigFormProps {
  core: string;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** The lease is held by someone: show, do not edit. */
  readOnly: boolean;
}

export interface ClientCoreModule {
  core: string;
  /** Main-area tabs. They read live state only through the store hooks and call REST. */
  panels?: { id: string; title: MessageKey; component: ComponentType }[];
  /** A dedicated config form; without one the JSON editor is used. */
  configForm?: ComponentType<ConfigFormProps>;
}

/**
 * The layout contract (docs/testbed/dashboard.md §0): what a testbed's
 * `src/client/testbed/cores/layout.tsx` exports. The frame (status bar, lease
 * banner, selection, store) is drawn around it.
 * @public 배치 계약 (docs/testbed/dashboard.md)
 */
export interface DashboardLayout {
  /** 'default' 또는 테스트베드가 정한 이름. <html data-layout>과 시험 어댑터가 씀 */
  id: string;
  /** 프레임 안의 화면 전체 */
  Dashboard: ComponentType;
  /** 공통 푸터를 둘지. 기본 true */
  footer?: boolean;
}

export interface DashboardTab {
  id: string;
  title: MessageKey;
  /** Common tabs are drawn by the default layout; core tabs bring their component. */
  component?: ComponentType;
}

/** The common tabs, first in this order; the default layout draws their views. */
export const COMMON_TABS: readonly DashboardTab[] = [
  { id: 'events', title: 'testbed.tab.events' },
  { id: 'stats', title: 'testbed.tab.stats' },
  { id: 'runs', title: 'testbed.tab.runs' },
  { id: 'agent', title: 'testbed.tab.agent' },
];

/** Common tabs, then each core's panels as `<core>.<panel id>`. */
export function dashboardTabs(modules: readonly ClientCoreModule[]): DashboardTab[] {
  return [
    ...COMMON_TABS,
    ...modules.flatMap((module) =>
      (module.panels ?? []).map((panel) => ({
        id: `${module.core}.${panel.id}`,
        title: panel.title,
        component: panel.component,
      })),
    ),
  ];
}
