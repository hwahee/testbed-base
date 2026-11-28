/**
 * The default layout (docs/testbed/dashboard.md §1): the core column
 * (connection panel, cores), the main area (tabs: the common ones and every
 * core's panels) and the detail panel. Under 1024 px the two side columns
 * open as overlays (a sidebar and a bottom sheet); picking an event there
 * opens the detail sheet. It does not use `?view=`.
 *
 * A default to replace, not a model to follow: a testbed designs its own
 * layout from its scenes (docs/testbed/ui-design.md).
 */
import { PanelLeft, PanelRight } from 'lucide-react';
import { useState, type ComponentType } from 'react';

import { useI18n } from '../../i18n/locale-context';
import { TESTID } from '../../testing/testids';
import { Button } from '../../ui/button';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- the bodies read the testbed store, a context of THIS subtree (case 1)
import { BottomSheet, Sidebar } from '../../ui/overlay/declarative';
import { Spinner } from '../../ui/spinner';
import { CLIENT_CORES } from '../cores';
import { dashboardTabs, type DashboardLayout } from '../registry';
import { useTestbedManifest, useTestbedStatus } from '../store/hooks';
import { AgentTimeline } from '../views/agent-timeline';
import { DetailPanel } from '../views/detail-panel';
import { EventLog } from '../views/event-log';
import { RunsPanel } from '../views/runs-panel';
import { useSelectListener } from '../views/selection';
import { StatsPanel } from '../views/stats-panel';
import { CoreColumn } from './core-column';
import { DashboardTabs } from './tabs';
import { useMediaQuery } from './use-media-query';

const WIDE = '(min-width: 1024px)';

/** The common tabs' views (docs/testbed/dashboard.md §1). */
const COMMON_VIEWS: Record<string, ComponentType> = {
  events: EventLog,
  stats: StatsPanel,
  runs: RunsPanel,
  agent: AgentTimeline,
};

function DefaultDashboard() {
  const { t } = useI18n();
  const status = useTestbedStatus();
  const manifest = useTestbedManifest();
  const wide = useMediaQuery(WIDE);
  const [coresOpen, setCoresOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  // On narrow screens, picking an event opens the detail sheet.
  useSelectListener(() => {
    if (!wide) setDetailOpen(true);
  });

  const tabs = dashboardTabs(CLIENT_CORES).map((tab) => {
    const component = tab.component ?? COMMON_VIEWS[tab.id];
    return component === undefined ? tab : { ...tab, component };
  });
  const column = manifest.data ? (
    <CoreColumn manifest={manifest.data} status={status} />
  ) : (
    <Spinner label={t('common.loading')} />
  );

  return (
    <>
      {!wide && (
        <div className="tb-dashboard__toolbar">
          <Button
            variant="secondary"
            onClick={() => setCoresOpen(true)}
            testId={TESTID.testbed.openCores}
          >
            <PanelLeft aria-hidden size="1em" />
            {t('testbed.cores.open')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setDetailOpen(true)}
            testId={TESTID.testbed.openDetail}
          >
            <PanelRight aria-hidden size="1em" />
            {t('testbed.detail.title')}
          </Button>
        </div>
      )}

      <div className="tb-layout" data-wide={wide || undefined}>
        {wide && <aside className="tb-layout__side">{column}</aside>}
        <div className="tb-layout__main">
          <DashboardTabs tabs={tabs} />
        </div>
        {wide && (
          <aside className="tb-layout__side">
            <DetailPanel />
          </aside>
        )}
      </div>

      {!wide && (
        <>
          <Sidebar
            modality="modal"
            open={coresOpen}
            onClose={() => setCoresOpen(false)}
            title={t('testbed.cores.open')}
            testId={TESTID.testbed.coresOverlay}
          >
            {column}
          </Sidebar>
          <BottomSheet
            open={detailOpen}
            onClose={() => setDetailOpen(false)}
            title={t('testbed.detail.title')}
            testId={TESTID.testbed.detailOverlay}
          >
            <DetailPanel />
          </BottomSheet>
        </>
      )}
    </>
  );
}

/** @public the default layout (docs/testbed/dashboard.md §0) */
export const defaultLayout: DashboardLayout = { id: 'default', Dashboard: DefaultDashboard };
