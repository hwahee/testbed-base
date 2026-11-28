/**
 * The main area's tabs: the common ones and every core's own panels. The
 * chosen tab stays in the address (`?tab=`), so a link opens the same view.
 */
import { useSearchParams } from 'react-router';

import { useI18n } from '../../i18n/locale-context';
import { TESTID } from '../../testing/testids';
import type { DashboardTab } from '../registry';

export function DashboardTabs({ tabs }: { tabs: readonly DashboardTab[] }) {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const active = tabs.find((tab) => tab.id === params.get('tab')) ?? tabs[0];
  if (!active) return null;
  const Panel = active.component;

  return (
    <div className="tb-tabs">
      <div role="tablist" className="tb-tabs__list" aria-label={t('testbed.tabs.label')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tb-tab-${tab.id}`}
            aria-selected={tab.id === active.id}
            aria-controls="tb-tabpanel"
            className="tb-tabs__tab"
            data-testid={TESTID.testbed.tabs.tab(tab.id)}
            onClick={() =>
              setParams(
                () => {
                  // From the address as it is now, so keys the router did not write stay.
                  const next = new URLSearchParams(window.location.search);
                  next.set('tab', tab.id);
                  return next;
                },
                { replace: true },
              )
            }
          >
            {t(tab.title)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="tb-tabpanel"
        aria-labelledby={`tb-tab-${active.id}`}
        className="tb-tabs__panel"
        data-testid={TESTID.testbed.tabs.panel}
      >
        {Panel && <Panel />}
      </div>
    </div>
  );
}
