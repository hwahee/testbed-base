/**
 * The dashboard frame (docs/testbed/dashboard.md §0): everything on `/` that
 * does not depend on the layout — the store, the sign-in check, the manifest
 * and the browser tab title, the status bar, the lease banner and
 * `<html data-lease>`, the restart notice, the selection — with the layout's
 * `Dashboard` drawn inside. It marks `<html data-layout="<layout id>">`.
 *
 * The frame neither reads nor clears the address's query: that is the
 * layout's (`?tab=`, `?view=`, the event log filters).
 */
import { useEffect } from 'react';

import { AccountControls } from '../../auth/account-controls';
import { useI18n } from '../../i18n/locale-context';
import { TESTID } from '../../testing/testids';
import { Alert } from '../../ui/alert';
import { Button } from '../../ui/button';
import type { DashboardLayout } from '../registry';
import {
  TestbedStoreProvider,
  useDismissRestart,
  useTestbed,
  useTestbedManifest,
} from '../store/hooks';
import { SelectionProvider } from '../views/selection';
import { LeaseBanner, useLeaseAttribute } from './lease-banner';
import { StatusBar } from './status-bar';

function LoginRequired() {
  const { t } = useI18n();
  return (
    <section className="tb-login" data-testid={TESTID.testbed.loginRequired}>
      <h2>{t('testbed.login.title')}</h2>
      <p className="muted">{t('testbed.login.description')}</p>
      <AccountControls />
    </section>
  );
}

/** Keeps `<html data-layout>` on the layout in use. */
function useLayoutAttribute(id: string): void {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.layout = id;
    return () => {
      delete root.dataset.layout;
    };
  }, [id]);
}

/** The browser tab carries the testbed's name, so testbeds open side by side can be told apart. */
function useDocumentTitle(name: string | undefined): void {
  const { t } = useI18n();
  const title = name === undefined ? undefined : t('testbed.documentTitle', { name });
  useEffect(() => {
    if (title === undefined) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

function Frame({ layout }: { layout: DashboardLayout }) {
  const { t } = useI18n();
  const snapshot = useTestbed();
  const dismissRestart = useDismissRestart();
  const manifest = useTestbedManifest();
  useLeaseAttribute();
  useLayoutAttribute(layout.id);
  useDocumentTitle(manifest.data?.name);

  if (snapshot.connection === 'unauthorized') return <LoginRequired />;
  const { Dashboard } = layout;

  return (
    <SelectionProvider>
      <div className="tb-dashboard" data-testid={TESTID.testbed.dashboard}>
        <StatusBar
          manifest={manifest.data}
          status={snapshot.status}
          connection={snapshot.connection}
        />
        <LeaseBanner />
        {snapshot.restarted && (
          <div data-testid={TESTID.testbed.restartNotice}>
            <Alert
              tone="info"
              action={
                <Button
                  variant="ghost"
                  onClick={dismissRestart}
                  testId={TESTID.testbed.restartDismiss}
                >
                  {t('common.close')}
                </Button>
              }
            >
              {t('testbed.restarted')}
            </Alert>
          </div>
        )}
        <Dashboard />
      </div>
    </SelectionProvider>
  );
}

/** `/`: the frame around `layout`. */
export function TestbedFrame({ layout }: { layout: DashboardLayout }) {
  return (
    <TestbedStoreProvider>
      <Frame layout={layout} />
    </TestbedStoreProvider>
  );
}
