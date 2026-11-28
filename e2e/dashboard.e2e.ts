/**
 * The dashboard, driven like a person while REST and TCP play the agent and
 * the product (docs/spec.md §11 M10). ARIA first, then `TESTID`.
 *
 * Every test here assumes the sample core. On an instance without it (a
 * testbed that dropped it from `CORES`) they skip and say why; M19 rewrites
 * them as contract tests and sample-core tests.
 */
import { expect, test, type Page } from '@playwright/test';

import { TESTID } from '../src/client/testing/testids';
import {
  api,
  echoPort,
  gateLiveUpdates,
  hasCore,
  NO_SAMPLE_CORE,
  resetTestbed,
  takeLease,
  tcp,
} from './helpers';

let reported = false;
test.beforeEach(async () => {
  const sample = await hasCore('sample');
  if (!sample && !reported) {
    reported = true;
    console.log(`e2e/dashboard.e2e.ts: skipped, ${NO_SAMPLE_CORE}`);
  }
  test.skip(!sample, NO_SAMPLE_CORE);
  await resetTestbed();
});

async function openDashboard(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'sample: running' })).toBeVisible();
}

/** The config editor with the server value loaded. */
async function configEditor(page: Page) {
  const editor = page.getByLabel('Config (JSON)');
  await expect(editor).toHaveValue(/"maxConnections"/);
  return editor;
}

test('1. basic view: the status bar shows sample running, the connection panel its TCP address', async ({
  page,
}) => {
  await openDashboard(page);
  await expect(page.getByTestId(TESTID.testbed.statusBar.core('sample'))).toHaveAttribute(
    'data-state',
    'running',
  );
  await expect(page.getByTestId(TESTID.testbed.connection.endpoint('sample', 'echo'))).toHaveText(
    `tcp://127.0.0.1:${await echoPort()}`,
  );
});

test('2. event flow: TCP data shows up in the log, and its payload in the detail panel', async ({
  page,
}) => {
  await openDashboard(page);
  const client = await tcp();
  client.send('hello');
  await client.received('hello');

  const row = page.getByRole('listitem').filter({ hasText: 'sample.data.echoed' }).last();
  await row.click();
  const payload = page.getByTestId(TESTID.testbed.detail.payload);
  const bytes = payload.locator('.tb-json__line[data-path="payload.bytes"]');
  await expect(bytes).toContainText('5');
  await expect(payload).toContainText('"hello"');

  // Typing fast into a filter keeps every character (the address follows).
  const kind = page.getByLabel('Kind prefix');
  await kind.pressSequentially('sample.data');
  await expect(kind).toHaveValue('sample.data');
  const search = page.getByLabel('Search summary');
  await search.pressSequentially('C-1 echoed');
  await expect(search).toHaveValue('C-1 echoed');
  await expect(page).toHaveURL(/kind=sample\.data/);
  await expect(page).toHaveURL(/q=C-1\+echoed/);

  // The columns are named, and a filter that leaves nothing says so.
  const log = page.getByTestId(TESTID.testbed.eventLog.root);
  await expect(log.locator('.tb-log__head')).toContainText('Summary');
  await search.pressSequentially(' nothing like this');
  await expect(log.getByTestId(TESTID.testbed.eventLog.empty)).toHaveText(
    'No events match the filters.',
  );
});

test('3. Run: start from the Run tab, data, end; the past Run summarizes it', async ({ page }) => {
  await openDashboard(page);
  await page.getByRole('tab', { name: 'Runs' }).click();
  const label = page.getByLabel('label', { exact: true });
  const endActive = page.getByTestId(TESTID.testbed.runs.endActive);
  await expect(endActive).toHaveCount(0);
  await label.fill('ui-run');
  await page.getByRole('button', { name: 'Start Run' }).click();
  await expect(page.getByTestId(TESTID.testbed.statusBar.run)).toContainText('Run ui-run');
  // The form is cleared; "end the open Run" appears now that one is open, unticked.
  await expect(label).toHaveValue('');
  await expect(endActive).not.toBeChecked();

  const client = await tcp();
  client.send('hello');
  await client.received('hello');
  await page.getByRole('button', { name: 'End Run' }).click();

  await expect(page.getByTestId(TESTID.testbed.statusBar.run)).toHaveText('No open Run');
  await expect(endActive).toHaveCount(0);
  await page.getByRole('button', { name: /^ui-run run-/ }).click();
  const summary = page.getByTestId(TESTID.testbed.runs.summary);
  await expect(summary.getByRole('row', { name: 'sample.data.echoed 1' })).toBeVisible();
});

test('4. lease: editing input survives a lease, every operation is aria-disabled; after release the changed server value offers "keep mine"', async ({
  page,
}) => {
  await openDashboard(page);
  await page.getByRole('button', { name: 'Broadcast' }).click();
  const editor = await configEditor(page);
  const mine = JSON.stringify(
    { ...JSON.parse(await editor.inputValue()), maxConnections: 42 },
    null,
    2,
  );
  await editor.fill(mine);

  const lease = await takeLease();
  await expect(page.locator('html')).toHaveAttribute('data-lease', 'agent');
  await expect(page.getByTestId(TESTID.testbed.leaseBanner)).toContainText('agent is in control');
  const config = page.getByRole('region', { name: 'Config' });
  await expect(config.getByTestId(TESTID.testbed.editor.lockedNotice)).toBeVisible();
  for (const control of [
    page.getByRole('button', { name: 'Start', exact: true }),
    page.getByRole('button', { name: 'Stop', exact: true }),
    page.getByRole('button', { name: 'Reset', exact: true }),
    page.getByRole('button', { name: 'Save config' }),
    page.getByRole('button', { name: 'Save rules' }),
    page.getByRole('button', { name: 'Run', exact: true }),
  ]) {
    await expect(control).toHaveAttribute('aria-disabled', 'true');
  }
  await expect(editor).toHaveValue(mine);
  await expect(editor).toHaveJSProperty('readOnly', true);

  // The holder changes the same setting, then lets go.
  await api('PATCH', '/cores/sample/config', {
    actor: 'agent',
    lease: lease.leaseId,
    body: { maxConnections: 9 },
  });
  await lease.release();
  await expect(page.locator('html')).toHaveAttribute('data-lease', 'none');
  const changed = config.getByTestId(TESTID.testbed.editor.serverChanged);
  await expect(changed).toBeVisible();
  await changed.getByRole('button', { name: 'Keep mine' }).click();
  await expect(editor).toHaveValue(mine);
  await expect(editor).toHaveJSProperty('readOnly', false);

  await page.getByRole('button', { name: 'Save config' }).click();
  await expect(config.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await expect
    .poll(
      async () =>
        (await api<{ maxConnections: number }>('GET', '/cores/sample/config')).body.maxConnections,
    )
    .toBe(42);
});

test('5. a save the lease beat to the server: 423, the notice, the input kept', async ({
  page,
}) => {
  const gate = await gateLiveUpdates(page);
  await openDashboard(page);
  const editor = await configEditor(page);
  const mine = JSON.stringify(
    { ...JSON.parse(await editor.inputValue()), maxConnections: 43 },
    null,
    2,
  );
  await editor.fill(mine);

  // The lease is taken but the page has not heard yet when the save goes out.
  gate.hold();
  const lease = await takeLease();
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/testbed/api/cores/sample/config') &&
      response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save config' }).click();
  expect((await saved).status()).toBe(423);

  const config = page.getByRole('region', { name: 'Config' });
  await expect(config.getByTestId(TESTID.testbed.editor.lockedNotice)).toBeVisible();
  await expect(editor).toHaveValue(mine);
  await expect(editor).toHaveJSProperty('readOnly', true);

  gate.flush();
  await lease.release();
});

test('6. action: broadcast "hi" reaches the TCP client and shows { sent: 1 }', async ({ page }) => {
  await openDashboard(page);
  const client = await tcp();
  await expect(page.getByTestId(TESTID.testbed.coreCard('sample'))).toContainText(
    /connectionsOpen\s*1/,
  );
  await page.getByRole('button', { name: 'Broadcast' }).click();
  await page.getByLabel('text', { exact: true }).fill('hi');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await client.received('hi');
  await expect(page.getByTestId(TESTID.testbed.action.result('sample', 'broadcast'))).toContainText(
    '"sent": 1',
  );
});

test('7. fault rules: a disconnect rule closes the connection, and the log shows testbed.fault.injected', async ({
  page,
}) => {
  await openDashboard(page);
  await page.getByRole('button', { name: 'Add rule' }).click();
  await page.getByLabel('effect').selectOption('disconnect');
  await page.getByRole('button', { name: 'Save rules' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();

  const client = await tcp();
  client.send('hello');
  await client.closed();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'testbed.fault.injected' }).last(),
  ).toBeVisible();
});

test('8. agent timeline: an agent taking and giving back the lease', async ({ page }) => {
  await openDashboard(page);
  // A person's operation stays out of the agent's timeline.
  expect((await api('POST', '/cores/sample/reset')).status).toBe(200);
  const lease = await takeLease();
  await lease.release();
  await page.getByRole('tab', { name: 'Agent timeline' }).click();
  const timeline = page.getByTestId(TESTID.testbed.agentTimeline.root);
  const short = lease.leaseId.slice(0, 4);
  await expect(
    timeline.getByRole('button', {
      name: new RegExp(`agent · ${short} testbed\\.lease\\.acquired`),
    }),
  ).toBeVisible();
  await expect(
    timeline.getByRole('button', {
      name: new RegExp(`agent · ${short} testbed\\.lease\\.released`),
    }),
  ).toBeVisible();
  await expect(timeline).not.toContainText('human');
});

test('core card: start and stop are enabled only when they would do something', async ({
  page,
}) => {
  await openDashboard(page);
  const start = page.getByRole('button', { name: 'Start', exact: true });
  const stop = page.getByRole('button', { name: 'Stop', exact: true });
  const reset = page.getByRole('button', { name: 'Reset', exact: true });
  await expect(start).toBeDisabled();
  await expect(stop).toBeEnabled();
  await expect(stop).toHaveClass(/btn--danger/);
  await expect(reset).toBeEnabled();

  await stop.click();
  await expect(page.getByRole('img', { name: 'sample: stopped' })).toBeVisible();
  await expect(stop).toBeDisabled();
  await expect(stop).not.toHaveClass(/btn--danger/);
  await expect(start).toBeEnabled();
  await expect(reset).toBeEnabled();

  await start.click();
  await expect(page.getByRole('img', { name: 'sample: running' })).toBeVisible();
  await expect(start).toBeDisabled();
  await expect(stop).toBeEnabled();
});

test('validation errors read as sentences that name the field', async ({ page }) => {
  await openDashboard(page);
  const editor = await configEditor(page);
  const errors = page.getByTestId(TESTID.testbed.configEditor.errors('sample'));
  await editor.fill(
    JSON.stringify({ ...JSON.parse(await editor.inputValue()), maxConnections: 0 }, null, 2),
  );
  await page.getByRole('button', { name: 'Save config' }).click();
  await expect(errors).toHaveText('maxConnections: Must be at least 1');
  await editor.fill('{\n  maxConnections: 5\n}');
  await page.getByRole('button', { name: 'Save config' }).click();
  await expect(errors).toHaveText('Not valid JSON near line 2, column 3.');

  await page.getByRole('button', { name: 'Broadcast' }).click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByTestId(TESTID.testbed.action.result('sample', 'broadcast'))).toHaveText(
    'text: Must not be empty',
  );
  await expect(page.getByLabel('text', { exact: true })).toHaveAccessibleDescription(
    'Must not be empty',
  );

  await page.getByRole('button', { name: 'Add rule' }).click();
  await page.getByTestId(TESTID.testbed.faults.cell('sample', 0, 'times')).fill('0');
  await page.getByRole('button', { name: 'Save rules' }).click();
  await expect(page.getByText('Pick an effect or set a delay')).toBeVisible();
  await expect(page.getByText('Must be a whole number of at least 1')).toBeVisible();
});

test.describe('away from UTC', () => {
  // Server sentences say UTC times; the page must show the browser's own clock.
  test.use({ timezoneId: 'Asia/Seoul' });

  test('control-plane errors use the names on screen and local time', async ({ page }) => {
    await openDashboard(page);
    const opened = await api<{ startedAt: string }>('POST', '/runs', { body: { label: 'other' } });
    expect(opened.status).toBe(201);
    await page.getByRole('tab', { name: 'Runs' }).click();
    await expect(page.getByTestId(TESTID.testbed.runs.endActive)).toBeVisible();
    await page.getByLabel('label', { exact: true }).fill('mine');
    await page.getByRole('button', { name: 'Start Run' }).click();
    const time = await page.evaluate((ts) => {
      const date = new Date(ts);
      return [date.getHours(), date.getMinutes(), date.getSeconds()]
        .map((part) => String(part).padStart(2, '0'))
        .join(':');
    }, opened.body.startedAt);
    await expect(page.getByRole('alert').filter({ hasText: "Run 'other'" })).toHaveText(
      `Run 'other' is already open (opened by human at ${time}). To close it and start a new one, tick “End the open Run first” and start again.`,
    );

    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.getByRole('img', { name: 'sample: stopped' })).toBeVisible();
    await page.getByRole('button', { name: 'Broadcast' }).click();
    await page.getByLabel('text', { exact: true }).fill('hi');
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.getByTestId(TESTID.testbed.action.result('sample', 'broadcast'))).toHaveText(
      'Core sample is stopped, not running. Press “Start” on its card, then try again.',
    );
  });
});
