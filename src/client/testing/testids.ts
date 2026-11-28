/**
 * UI-automation test-id registry — the single source of truth for every
 * `data-testid` in the application. See docs/ui-automation.md for the full
 * conventions (naming, stability guarantees, ARIA-first selector guidance).
 *
 * Rules:
 *   - Never write a `data-testid` string inline in a component; add it here.
 *   - Format: `{page}.{section}.{element}`, kebab-case segments.
 *   - Dynamic ids (per-entity elements) are factory functions taking the
 *     entity id, e.g. `TESTID.designSystem.section(name)`.
 */
export const TESTID = {
  app: {
    header: 'app.header',
    /** The service name in the header — a link home. */
    homeLink: 'app.header.home-link',
    /** Kept from the old header nav; the link now sits in the footer's bottom line. */
    navDesignSystem: 'app.nav.design-system',
    themeToggle: 'app.controls.theme-toggle',
    designToggle: 'app.controls.design-toggle',
    localeSelect: 'app.controls.locale-select',
    account: {
      signIn: 'app.account.sign-in',
      user: 'app.account.user',
      signOut: 'app.account.sign-out',
    },
    footer: 'app.footer',
    /** The <ul> of services rendered from /sitemap.json (absent while loading). */
    footerServices: 'app.footer.services',
    footerGithub: 'app.footer.github',
    footerCopyright: 'app.footer.copyright',
    /** The bottom line's links: the design system, then terms and privacy. */
    footerLegal: 'app.footer.legal',
  },
  /** The dashboard at `/` (docs/spec.md §11 "대시보드 testid", docs/testbed/dashboard.md). */
  testbed: {
    dashboard: 'testbed.dashboard',
    layout: {
      /** A layout's view switch (`useLayoutView`): the tab button of view `name`. */
      view: (name: string) => `testbed.layout.view.${name}`,
    },
    statusBar: {
      root: 'testbed.status-bar',
      /** The state dot; its `aria-label` says `<core>: <state>`, `data-state` the state. */
      core: (id: string) => `testbed.status-bar.core.${id}`,
      run: 'testbed.status-bar.run',
      /** `data-connection`: connecting | open | reconnecting | unauthorized. */
      connection: 'testbed.status-bar.connection',
    },
    leaseBanner: 'testbed.lease-banner',
    restartNotice: 'testbed.restart-notice',
    restartDismiss: 'testbed.restart-notice.dismiss',
    loginRequired: 'testbed.login-required',
    connection: {
      root: 'testbed.connection',
      endpoint: (core: string, name: string) => `testbed.connection.endpoint.${core}.${name}`,
      copyEndpoint: (core: string, name: string) =>
        `testbed.connection.copy-endpoint.${core}.${name}`,
      mcpUrl: 'testbed.connection.mcp-url',
      copyMcpJson: 'testbed.connection.copy-mcp-json',
      copyClaudeMd: 'testbed.connection.copy-claude-md',
    },
    tabs: {
      tab: (id: string) => `testbed.tabs.tab.${id}`,
      panel: 'testbed.tabs.panel',
    },
    coreColumn: 'testbed.core-column',
    coreCard: (id: string) => `testbed.core-card.${id}`,
    /** Folds the card to its header; `aria-expanded` says which. */
    coreCardToggle: (id: string) => `testbed.core-card.toggle.${id}`,
    /** An external core's replica table. */
    coreCardReplicas: (id: string) => `testbed.core-card.replicas.${id}`,
    /** One replica's row: `data-state`, `data-restarts`; its button (`aria-expanded`) opens the log. */
    coreCardReplica: (id: string, replicaId: string) =>
      `testbed.core-card.replica.${id}.${replicaId}`,
    /** The replica's latest stderr lines, under its row once opened. */
    coreCardReplicaLog: (id: string, replicaId: string) =>
      `testbed.core-card.replica-log.${id}.${replicaId}`,
    /** start / stop / reset; `aria-disabled="true"` while the lease is held. */
    coreOp: {
      start: (id: string) => `testbed.core-card.start.${id}`,
      stop: (id: string) => `testbed.core-card.stop.${id}`,
      reset: (id: string) => `testbed.core-card.reset.${id}`,
    },
    configEditor: {
      /** The JSON editor's textarea. */
      root: (id: string) => `testbed.config-editor.${id}`,
      save: (id: string) => `testbed.config-editor.save.${id}`,
      /** Validation issues (`path: message`) or the error sentence. */
      errors: (id: string) => `testbed.config-editor.errors.${id}`,
      restartNotice: (id: string) => `testbed.config-editor.restart-notice.${id}`,
      restartNow: (id: string) => `testbed.config-editor.restart-now.${id}`,
    },
    /** Inside every lock-aware editor (config, action form, fault rules) — scope by its container. */
    editor: {
      lockedNotice: 'testbed.editor.locked-notice',
      copyInput: 'testbed.editor.copy-input',
      serverChanged: 'testbed.editor.server-changed',
      reload: 'testbed.editor.reload',
      keep: 'testbed.editor.keep',
    },
    action: {
      /** Opens the action's form (`aria-expanded`). */
      root: (core: string, name: string) => `testbed.action.${core}.${name}`,
      run: (core: string, name: string) => `testbed.action.run.${core}.${name}`,
      result: (core: string, name: string) => `testbed.action.result.${core}.${name}`,
      /** External cores: which replica runs it (`''` = every replica). */
      target: (core: string, name: string) => `testbed.action.target.${core}.${name}`,
      /** One input; `json` for the JSON editor fallback. */
      field: (core: string, name: string, field: string) =>
        `testbed.action.field.${core}.${name}.${field}`,
    },
    faults: {
      root: (id: string) => `testbed.faults.${id}`,
      add: (id: string) => `testbed.faults.add.${id}`,
      save: (id: string) => `testbed.faults.save.${id}`,
      row: (id: string, index: number) => `testbed.faults.row.${id}.${index}`,
      /** column: id | match | probability | delayMs | times | effect | error */
      cell: (id: string, index: number, column: string) =>
        `testbed.faults.cell.${id}.${index}.${column}`,
      up: (id: string, index: number) => `testbed.faults.up.${id}.${index}`,
      down: (id: string, index: number) => `testbed.faults.down.${id}.${index}`,
      remove: (id: string, index: number) => `testbed.faults.remove.${id}.${index}`,
    },
    detail: {
      root: 'testbed.detail',
      payload: 'testbed.detail.payload',
      /** The other events with the same correlationId. */
      group: 'testbed.detail.group',
      groupItem: (eventId: string) => `testbed.detail.group-item.${eventId}`,
      /** A value in the masking format, marked "redacted". */
      redacted: 'testbed.detail.redacted',
      copyEvent: 'testbed.detail.copy-event',
    },
    eventLog: {
      root: 'testbed.event-log',
      row: (eventId: string) => `testbed.event-log.row.${eventId}`,
      jumpLatest: 'testbed.event-log.jump-latest',
      /** field: run | core | kind | level | actor | text */
      filter: (field: string) => `testbed.event-log.filter.${field}`,
      count: 'testbed.event-log.count',
      omitted: 'testbed.event-log.omitted',
      /** The notice when no row is shown (no events yet, or none match). */
      empty: 'testbed.event-log.empty',
    },
    stats: {
      root: 'testbed.stats',
      sparkline: 'testbed.stats.sparkline',
      latency: 'testbed.stats.latency',
    },
    runs: {
      open: 'testbed.runs.open',
      start: 'testbed.runs.start',
      end: 'testbed.runs.end',
      label: 'testbed.runs.label',
      seed: 'testbed.runs.seed',
      endActive: 'testbed.runs.end-active',
      item: (runId: string) => `testbed.runs.item.${runId}`,
      summary: 'testbed.runs.summary',
      export: 'testbed.runs.export',
    },
    agentTimeline: {
      root: 'testbed.agent-timeline',
      item: (eventId: string) => `testbed.agent-timeline.item.${eventId}`,
      jumpLatest: 'testbed.agent-timeline.jump-latest',
    },
    /** Under 1024 px: the buttons that open the side columns as overlays. */
    openCores: 'testbed.open-cores',
    openDetail: 'testbed.open-detail',
    coresOverlay: 'testbed.cores-overlay',
    detailOverlay: 'testbed.detail-overlay',
  },
  designSystem: {
    page: 'design-system.page',
    section: (name: string) => `design-system.section.${name}`,
    overlay: {
      openModal: 'design-system.overlay.open-modal',
      openSheet: 'design-system.overlay.open-sheet',
      openSidebar: 'design-system.overlay.open-sidebar',
      modal: 'design-system.overlay.modal',
      sheet: 'design-system.overlay.sheet',
      sidebar: 'design-system.overlay.sidebar',
      /* Opened from inside the modal — the nesting the stack has to survive. */
      nest: 'design-system.overlay.nest',
      confirm: 'design-system.overlay.confirm',
      confirmYes: 'design-system.overlay.confirm.yes',
      confirmNo: 'design-system.overlay.confirm.no',
      save: 'design-system.overlay.save',
      result: 'design-system.overlay.result',
      /* The declarative door — an inline sidebar is layout, not a popup. */
      inline: 'design-system.overlay.inline',
      inlineToggle: 'design-system.overlay.inline.toggle',
    },
  },
  notFound: {
    page: 'not-found.page',
    homeLink: 'not-found.home-link',
  },
  signInFailed: {
    page: 'sign-in-failed.page',
    message: 'sign-in-failed.message',
    retry: 'sign-in-failed.retry',
    homeLink: 'sign-in-failed.home-link',
  },
} as const;
