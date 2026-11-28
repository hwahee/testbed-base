# UI 자동화 가이드 (E2E / 테스트 자동화 설계)

클라이언트의 **모든 요소는 UI 자동화가 가능하도록** 설계되어 있으며, 그 규약 전체를 이
문서 하나에서 확인할 수 있습니다.

## 원칙

1. **모든 인터랙티브 컴포넌트는 `testId`가 필수 prop**입니다
   (`Button`, `TextField`, `TextArea`, `Select`, `Checkbox`, `Accordion`, `Palette`). testId 없이 렌더링하면 타입
   에러가 나므로 자동화 불가능한 컨트롤이 애초에 만들어질 수 없습니다.
2. **testid 문자열은 인라인으로 쓰지 않습니다.** 유일한 출처는
   [`src/client/testing/testids.ts`](../src/client/testing/testids.ts)의 `TESTID` 레지스트리입니다.
   테스트 코드도 같은 레지스트리를 import해서 selector 오타·드리프트를 없앱니다.
3. **네이밍**: `{page}.{section}.{element}`, kebab-case.
   엔티티별 요소는 팩토리 함수 — 예: `TESTID.designSystem.section(name)` → `design-system.section.<name>`.
4. **ARIA 우선 선택**: 시맨틱이 있는 곳은 role/label 기반 selector
   (`getByRole('button', { name: … })`)를 우선 사용하고, testid는 안정적인 앵커/폴백으로
   사용하세요. 모든 컨트롤은 접근 가능한 이름(label, `aria-label`)을 갖습니다.

## 상태 신호 (기다림/검증에 사용)

| 신호                                | 의미                                        |
| ----------------------------------- | ------------------------------------------- |
| `role="status"` + 로딩 testid       | 초기 로딩 중 (`todos.loading`)              |
| `role="alert"` (`todos.error`)      | 로드 실패 — 재시도 버튼 `todos.error.retry` |
| `aria-busy="true"` (목록/버튼)      | 백그라운드 refetch / mutation 진행 중       |
| `aria-live="polite"` 페이지 표시    | 페이지네이션 상태 갱신                      |
| `aria-current="page"` (nav 링크)    | 활성 라우트                                 |
| `aria-invalid` + `aria-describedby` | 폼 필드 검증 오류                           |
| `aria-expanded` (아코디언 trigger)  | 패널 열림/닫힘 (`Accordion`)                |
| `aria-expanded` (팔레트 trigger)    | 팔레트 팝업 열림/닫힘 (`Palette`)           |
| `aria-selected` (팔레트 스와치)     | 현재 선택된 색                              |

## 전역 상태 전환 (테마/디자인/언어)

`<html>` 속성으로 관찰·제어 가능합니다:

- `data-theme="light|dark"` — 토글 버튼: `app.controls.theme-toggle`
- `data-design="standard|contrast|office|kids"` — 토글 버튼: `app.controls.design-toggle`
- `lang="en|ko"` — 셀렉트: `app.controls.locale-select`

셋 다 `localStorage`(`app.theme` / `app.design` / `app.locale`)에 저장되므로 테스트
셋업에서 미리 주입해 원하는 상태로 시작할 수 있습니다.

## testid 레지스트리 요약

전체 목록은 `src/client/testing/testids.ts`가 소스 오브 트루스입니다. 주요 항목:

| 영역          | testid                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 앱 셸         | `app.header`, `app.header.home-link` (서비스명 = 홈 링크)                                                                                       |
| 계정 (헤더)   | `app.account.sign-in`, `app.account.user` / `.sign-out`                                                                                         |
| 푸터          | `app.footer`, `app.controls.*`, `app.nav.design-system`, `app.footer.services`, `app.footer.github`, `app.footer.copyright`, `app.footer.legal` |
| 로그인 실패   | `sign-in-failed.page`, `sign-in-failed.message`, `sign-in-failed.retry` / `.home-link`                                                          |
| 테스트베드    | 아래 "테스트베드 대시보드" 절                                                                                                                   |
| 디자인 시스템 | `design-system.page`, `design-system.section.<name>`, `ds.*` (쇼케이스 컴포넌트)                                                                |
| NotFound      | `not-found.page`, `not-found.home-link`                                                                                                         |

### 테스트베드 대시보드 (`/`)

공통 컴포넌트는 `TESTID.testbed.*`이고, 코어 고유 화면은 `TESTID.<core>.*`입니다([testbed/dashboard.md](testbed/dashboard.md)).

| testid                                                                                         | 요소                                                                                                                                            |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `testbed.dashboard`                                                                            | 대시보드 전체                                                                                                                                   |
| `testbed.status-bar`                                                                           | 상태 바                                                                                                                                         |
| `testbed.status-bar.core.<id>`                                                                 | 코어 상태 점. `aria-label`은 `<core>: <state>`, `data-state`는 상태                                                                             |
| `testbed.status-bar.run`                                                                       | 열린 Run 표시(없으면 "열린 Run 없음")                                                                                                           |
| `testbed.status-bar.connection`                                                                | 실시간 연결 상태. `data-connection`: `connecting` \| `open` \| `reconnecting` \| `unauthorized`                                                 |
| `testbed.lease-banner`                                                                         | 락 배너(락이 있을 때만 존재)                                                                                                                    |
| `testbed.restart-notice` / `.dismiss`                                                          | "테스트베드가 재시작됨" 알림과 닫기                                                                                                             |
| `testbed.login-required`                                                                       | 로그인이 필요할 때 대시보드 대신 보이는 안내                                                                                                    |
| `testbed.connection`                                                                           | 연결 패널                                                                                                                                       |
| `testbed.connection.endpoint.<core>.<name>` / `testbed.connection.copy-endpoint.<core>.<name>` | 데이터면 주소와 복사                                                                                                                            |
| `testbed.connection.mcp-url`                                                                   | 제어면 MCP URL(복사는 `.mcp.json` 조각으로)                                                                                                     |
| `testbed.connection.copy-mcp-json` / `.copy-claude-md`                                         | `.mcp.json` 조각, CLAUDE.md 스니펫 복사                                                                                                         |
| `testbed.tabs.tab.<id>` / `testbed.tabs.panel`                                                 | 주 영역 탭(`aria-selected`)과 내용                                                                                                              |
| `testbed.core-column` / `testbed.core-card.<id>`                                               | 코어 열과 코어 카드                                                                                                                             |
| `testbed.core-card.replicas.<id>`                                                              | 외부 코어의 복제 표                                                                                                                             |
| `testbed.core-card.replica.<id>.<replicaId>`                                                   | 복제 한 행(`data-state`, `data-restarts`). 행의 id 버튼(`aria-expanded`)이 로그를 엶                                                            |
| `testbed.core-card.replica-log.<id>.<replicaId>`                                               | 그 복제의 stderr 최근 50줄(행을 펼쳤을 때만)                                                                                                    |
| `testbed.action.target.<core>.<name>`                                                          | 외부 코어 액션의 대상 선택(`''` = 전체 복제, `r0`, `r1` …). 결과는 `testbed.action.result.<core>.<name>` 안에 복제마다 `[data-replica="r0"]` 칸 |
| `testbed.detail` / `.payload`                                                                  | 상세 패널과 payload 트리                                                                                                                        |
| `testbed.detail.group` / `testbed.detail.group-item.<eventId>`                                 | 같은 correlationId 묶음과 그 항목                                                                                                               |
| `testbed.detail.redacted`                                                                      | 가린 값(배지 "가린 값")                                                                                                                         |
| `testbed.detail.copy-event`                                                                    | 고른 이벤트 전체를 JSON으로 복사. payload 트리의 각 줄은 `.tb-json__line[data-path="payload.bytes"]`                                            |
| `testbed.event-log` / `testbed.event-log.row.<eventId>`                                        | 이벤트 로그와 행(`aria-current`가 고른 행)                                                                                                      |
| `testbed.event-log.jump-latest`                                                                | "새 이벤트 n건 · 맨 아래로"(따라가기를 멈췄을 때만)                                                                                             |
| `testbed.event-log.filter.<field>`                                                             | 필터(`run`, `core`, `kind`, `level`, `actor`, `replica`, `text`). `replica`는 외부 코어가 있을 때만                                             |
| `testbed.event-log.count` / `.omitted`                                                         | 보이는 건수, 표본화로 생략된 건수                                                                                                               |
| `testbed.event-log.empty`                                                                      | 보일 행이 없을 때의 안내(이벤트 없음 / 조건에 맞는 이벤트 없음)                                                                                 |
| `testbed.stats` / `.sparkline` / `.latency`                                                    | 통계 탭, 초당 이벤트 수 캔버스, 지연 표                                                                                                         |
| `testbed.runs.open` / `.start` / `.end`                                                        | 열린 Run, Run 시작·종료 버튼                                                                                                                    |
| `testbed.runs.label` / `.seed` / `.end-active`                                                 | 시작 폼 입력(`.end-active`는 열린 Run이 있을 때만)                                                                                              |
| `testbed.runs.item.<runId>` / `.summary` / `.export`                                           | 지난 Run, 고른 Run의 요약과 내보내기 링크                                                                                                       |
| `testbed.agent-timeline` / `testbed.agent-timeline.item.<eventId>`                             | 에이전트 타임라인과 항목                                                                                                                        |
| `testbed.agent-timeline.jump-latest`                                                           | 타임라인의 "새 이벤트 n건 · 맨 아래로"(따라가기를 멈췄을 때만)                                                                                  |
| `testbed.open-cores` / `testbed.open-detail`                                                   | 1024px 미만에서 코어 열·상세를 여는 버튼                                                                                                        |
| `testbed.cores-overlay` / `testbed.detail-overlay`                                             | 그때 열리는 사이드바·바텀시트(`.panel`, `.close` 파생)                                                                                          |

- 대시보드의 배치는 `<html data-layout="<배치 id>">`(기본 배치는 `default`)로 관찰합니다. 배치가 보기를 둘 이상 두면 보기 전환 탭 버튼의 testid는 `testbed.layout.view.<name>`(`TESTID.testbed.layout.view(name)`)입니다.
- 락 상태는 `<html data-lease="none|agent|ci">`와 조작 컨트롤의 `aria-disabled="true"`로 관찰합니다. 코어 상태에 맞지 않는 start/stop(`running` 코어의 start 등)은 락과 별개로 `disabled`입니다([testbed/dashboard.md](testbed/dashboard.md) §1.2).
- 실시간 값은 WS로 100ms 묶음으로 들어오므로 고정 시간 대신 요소·속성의 변화를 기다립니다.

`TextField`는 에러 표시 시 자동으로 `` `${testId}.error` `` 요소를 추가합니다. `TextArea`와 `Select`도 같습니다.
둘 다 힌트(글자 수, 입력 형식 등)가 있으면 `` `${testId}.hint` ``를 더합니다.

`Button`은 `to`를 주면 링크(`<a>`)로 그려집니다. 이동은 링크, 동작은 버튼이므로 자동화에서도
`getByRole('link')`로 찾습니다. 링크를 버튼으로 감싸거나 그 반대로 중첩하지 않습니다.

테마·디자인·언어 컨트롤(`app.controls.*`)은 헤더가 아니라 푸터의 정체성 행에 있습니다 — testid는 그대로이므로 selector는 바뀌지 않지만, 스크롤이 필요할 수 있습니다.

헤더에는 내비게이션이 없습니다. 디자인 시스템 링크(`app.nav.design-system`)는 푸터 하단 줄의 약관 링크 앞(`app.footer.legal` 안)으로 옮겼고 testid는 그대로입니다. 홈으로는 헤더의 서비스명(`app.header.home-link`)으로 갑니다.

푸터의 `app.footer.services`는 `/sitemap.json` 응답이 도착한 뒤에만 존재합니다 — 서비스 목록을 검증하는 테스트는 이 요소의 등장을 기다리세요. 로딩·실패 시에는 컬럼 제목만 남고 목록 자체가 렌더링되지 않으므로, 그 상태를 나타내는 별도 신호는 없습니다.

`Accordion`은 항목마다 `` `${testId}.trigger.<itemId>` ``와 `` `${testId}.panel.<itemId>` ``를
자동 파생합니다. 열림/닫힘은 trigger의 `aria-expanded`로 관찰·대기하세요.

`Palette`는 `` `${testId}.popup` ``, `` `${testId}.swatch.<hex>` ``(`#` 없는 hex),
`` `${testId}.hex` ``(+ `.hex.error`), `` `${testId}.native` ``, `` `${testId}.contrast` ``를
파생합니다. 팝업은 top layer(`popover`)에 뜨므로 DOM 위치가 아니라 testid나
`role="dialog"`로 잡으세요. 선택 대기는 스와치의 `aria-selected`로 합니다.

오버레이(`Modal` / `BottomSheet` / `Sidebar`)는 `` `${testId}.panel` ``, `` `${testId}.title` ``,
`` `${testId}.close` ``를 파생합니다. 명령형(`useOverlay()`)으로 열든 선언형으로 열든 같은
testid가 나오므로 테스트는 둘을 구분할 필요가 없습니다. 모달 오버레이는 `<dialog>` top
layer에 뜨므로 DOM 위치가 아니라 testid나 `role="dialog"`로 잡고, 열림/닫힘은 패널의 존재로
기다립니다. 중첩됐을 때 화면이 한 겹만 어두워지는지는 `dialog[open]` 중
`data-overlay-top="true"`가 정확히 하나인지로 확인할 수 있습니다. 인라인 사이드바
(`modality="inline"`, 넓은 뷰포트의 `auto`)는 오버레이가 아니라 레이아웃이라 `<aside>`로
렌더되고 top layer에 뜨지 않습니다.

```ts
test('picks a preset color', async ({ page }) => {
  await page.goto('/design-system');
  await page.getByTestId('ds.palette').click();
  await page.getByTestId('ds.palette.swatch.ef4444').click();
  await expect(page.getByTestId('ds.palette')).toHaveAttribute('aria-expanded', 'false');
});
```

## Playwright 예시

테스트베드의 UI 시험은 `e2e/*.e2e.ts`에 있고 `bun run test:ui`로 돌립니다([testbed/verification.md](testbed/verification.md) §5).

```ts
import { TESTID } from '../src/client/testing/testids';

test('shows the sample core running at /', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId(TESTID.testbed.statusBar.core('sample'))).toHaveAttribute(
    'data-state',
    'running',
  );
});

test('switches to the contrast skin', async ({ page }) => {
  await page.goto('/design-system');
  await page.getByTestId(TESTID.app.designToggle).click();
  await expect(page.locator('html')).toHaveAttribute('data-design', 'contrast');
});
```

## 새 요소를 추가할 때 체크리스트

1. `TESTID` 레지스트리에 항목 추가 (인라인 문자열 금지).
2. 인터랙티브 요소면 디자인 시스템 컴포넌트를 사용 (testId 필수 prop이 강제됨).
3. 접근 가능한 이름 확인 — 아이콘 전용 버튼은 반드시 `aria-label`.
4. 비동기 상태가 있으면 위 표의 ARIA 신호(`aria-busy` 등)로 노출.
5. 이 문서의 요약 표를 갱신.
