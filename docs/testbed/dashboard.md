# 대시보드

메인 페이지 `/`가 대시보드입니다. `testbed-base`가 **프레임**과 공통 컴포넌트, 그리고 교체할 수 있는 **기본 배치**를 줍니다. 각 테스트베드는 자기 **배치**를 소유합니다(기본 배치를 그대로 쓰거나, 패널 슬롯으로 탭만 더하거나, 새로 짬). 프레임은 고치지 않습니다.

## 0. 프레임과 배치

| 부분                                                                         | 소유        | 내용                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 프레임 `TestbedFrame`(`src/client/testbed/dashboard/frame.tsx`)              | 공통 런타임 | 스토어(`TestbedStoreProvider`), 로그인 판정(로그인 필요면 안내만), 매니페스트 조회와 브라우저 탭 제목, `<html data-lease>`, 상태 바, 락 배너, 재시작 알림, 선택(`SelectionProvider`), `<html data-layout="<배치 id>">`. 그 아래에 배치의 `Dashboard`를 그림 |
| 배치 모듈 `src/client/testbed/cores/layout.tsx`                              | 테스트베드  | `export const layout: DashboardLayout`. 이 저장소는 `defaultLayout`                                                                                                                                                                                         |
| 기본 배치 `defaultLayout`(`src/client/testbed/dashboard/default-layout.tsx`) | 공통 런타임 | 코어 열 · 주 영역 탭 · 상세 패널(§1.1). 교체할 수 있는 기본값이며 테스트베드가 따라 할 본보기가 아님                                                                                                                                                        |

```ts
/** @public 배치 계약 (src/client/testbed/registry.ts) */
interface DashboardLayout {
  /** 'default' 또는 테스트베드가 정한 이름. <html data-layout>과 시험 어댑터가 씀 */
  id: string;
  /** 프레임 안의 화면 전체 */
  Dashboard: ComponentType;
  /** 공통 푸터를 둘지. 기본 true */
  footer?: boolean;
}
```

- 프레임은 주소의 쿼리를 읽거나 지우지 않습니다. 쿼리는 배치의 것입니다(`?tab=`, `?view=`, 이벤트 로그 필터).
- `App`(`src/client/app.tsx`)은 `layout?: DashboardLayout`을 받고, 없으면 `cores/layout.tsx`의 것을 씁니다. `/`는 프레임 + 배치이고, `layout.footer === false`면 푸터 없이 그립니다.
- **보기 전환** `useLayoutView(views, defaultView)`(`dashboard/layout-view.ts`): 배치가 보기 둘 이상(예: "실시간"/"지난 기록")을 두고 고른 보기를 주소 `?view=`에 남깁니다. `[view, setView]`를 돌려주고, `setView`는 `history.replaceState`로 `view`만 바꿉니다(다른 쿼리는 그대로, 기본 보기면 `view`를 뺌). 주소의 값이 `views`에 없으면 기본 보기를 쓰고 주소는 고치지 않습니다. 새로고침·주소 공유·뒤로 가기 후에도 같은 보기입니다. 라우터는 쓰지 않습니다. 보기 전환 탭 버튼의 testid는 `testbed.layout.view(name)`입니다. 기본 배치는 `?view=`를 쓰지 않습니다.
- 이벤트 로그 필터와 기본 배치의 탭은 주소를 바꿀 때 그 순간의 `window.location`에서 시작하므로, 라우터가 모르는 키(`?view=`)를 지우지 않습니다.
- **선택 알림** `useSelectListener(listener)`(`views/selection.tsx`): 이벤트를 고를 때마다(같은 이벤트를 다시 골라도) 불립니다. 고른 뒤에 무엇을 할지(예: 좁은 화면에서 상세 시트 열기)는 배치가 정합니다.
- **매니페스트 훅** `useTestbedManifest()`(`store/hooks.ts`): 프레임과 배치가 같은 쿼리 키(`['testbed', 'manifest', instanceId]`)를 씁니다.
- 테스트베드 소유 파일: `src/client/testbed/cores/layout.tsx`. 공통 런타임은 처음 만든 뒤 고치지 않습니다.

## 1. 공통 컴포넌트

| 컴포넌트          | 내용                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 상태 바           | 이름, 버전, 인스턴스, 코어별 상태 점, 열린 Run, 락 배너                                                                                                 |
| 연결 패널         | 데이터면 주소(복사 버튼), 제어면 MCP URL, `.mcp.json` 조각, CLAUDE.md 스니펫 복사. 복사 버튼은 아이콘만(이름·툴팁 "… 복사", 누르면 체크 표시)           |
| 코어 카드         | 상태, start/stop/reset, 설정 편집(JSON 편집기가 기본, 코어가 전용 폼으로 대체 가능), 액션 버튼, 결함 규칙 편집(§1.3). 외부 코어는 복제 표와 복제별 로그 |
| 이벤트 로그       | 가상 스크롤(행 높이 고정, 보이는 행 + 위아래 20행). 필터·따라가기·생략 건수, 지난 Run은 REST(§1.5)                                                      |
| 상세 패널         | 고른 이벤트의 봉투 + payload 트리(접기·펴기), 이벤트 JSON 복사, 가린 값 표시, 같은 correlationId 묶음(§1.5)                                             |
| 통계 패널         | 현재 Run(없으면 스토어 전체)의 kind·level별 건수, 오류율, `latencyMs`의 평균·p95·최대, 초당 이벤트 수 스파크라인(§1.5)                                  |
| Run 패널          | 열린 Run과 시작·종료, 지난 Run 목록, 요약, check 결과, 내보내기, 다른 주체가 닫은 Run·교체·재시작 표시(§1.5)                                            |
| 에이전트 타임라인 | actor=`agent`인 이벤트와 사람이 아닌 주체의 `testbed.control.*`, `testbed.lease.*`만 시간순으로. 항목마다 caller 이름과 세션 앞 4자(§1.5)               |

### 1.1 기본 배치

| 영역      | 위치(1024px 이상)                    | 1024px 미만                                                    |
| --------- | ------------------------------------ | -------------------------------------------------------------- |
| 상태 바   | 맨 위, 그 아래 락 배너·재시작 알림   | 같음                                                           |
| 코어 열   | 왼쪽. 연결 패널, 코어(카드는 P3 M8)  | "코어와 연결" 버튼 → 보일러플레이트 사이드바(`Sidebar`, modal) |
| 주 영역   | 가운데. 탭(공통 탭 + 코어 고유 패널) | 같음                                                           |
| 상세 패널 | 오른쪽(내용은 P3 M9)                 | "상세" 버튼 → 바텀시트(`BottomSheet`)                          |

- 1024px 이상에서 코어 열·주 영역·상세 패널은 각각 화면 높이까지만 차지하고 따로 스크롤하며, 페이지를 내려도 화면에 붙어 있습니다(`position: sticky`). 코어 카드를 길게 펼쳐 편집하는 동안에도 이벤트 로그와 상세 패널이 보입니다. 양옆 열의 폭은 전체의 25%를 16–22rem 사이로 맞춥니다.
- 주 영역 탭은 이벤트 로그(`events`), 통계(`stats`), Run(`runs`), 에이전트 타임라인(`agent`), 그다음 코어 고유 패널(`<core>.<panel id>`) 순서입니다. 선택한 탭은 주소 `?tab=<id>`에 남습니다.
- 브라우저 탭 제목은 매니페스트 이름으로 "`<name>` · 테스트베드"입니다(매니페스트를 받기 전에는 "Testbed"). 여러 테스트베드를 탭으로 띄워도 구분됩니다. 머리글과 푸터의 서비스명은 "테스트베드"(`app.title`)이고, 푸터의 관련 서비스는 `public/sitemap.json`(testbed-base, Boilerplate)입니다.
- 상태 바: 이름, 버전, `instanceId` 앞 8자, 코어별 상태 점(전체 상태의 색 + `aria-label` "`<core>: <state>`", 외부 코어는 "`<core>: <state> (2 replicas)`"처럼 복제 수를 덧붙임), 열린 Run(label과 경과 시간, 1초마다 갱신), 실시간 연결 상태(연결 중 / 연결됨 / 다시 연결 중).
- `AUTH_DRIVER=oidc`인데 로그인하지 않았으면 대시보드 대신 "로그인 필요" 안내와 보일러플레이트의 로그인 컨트롤을 보여 줍니다. 판정: WS가 아무 메시지 없이 닫히면 `GET /testbed/api/status`를 불러 보고, 401이면 로그인 필요로 보고 다시 연결하지 않습니다.
- 구현: `src/client/testbed/dashboard/`(프레임 `frame.tsx`, 기본 배치 `default-layout.tsx`), `src/client/testbed/store/`(스토어), `src/client/testbed/registry.ts`(패널 슬롯), `src/client/testbed/connection.ts`(연결 패널 조각).

### 1.2 코어 카드

코어 열에 코어마다 하나(`src/client/testbed/dashboard/core-card.tsx`). 머리글을 눌러 접었다 펼 수 있습니다.

- **머리글**: 제목, 상태 배지, id·유형(외부 코어면 "외부 프로세스", `error`면 `detail`).
- **카운터**: `status().counters` 그대로(외부 코어는 복제 합).
- **복제 표**(외부 코어, `dashboard/replica-table.tsx`): 복제마다 한 행(id, 상태, pid, 재시작 횟수, 마지막 응답 ms, 엔드포인트). 행의 id 버튼을 누르면 그 아래에 stderr 최근 50줄(`GET /cores/:core/log?replica=`, 가림 적용)이 열리고, 열려 있는 동안 2초마다 다시 읽습니다.
- **조작**: start / stop / reset(`POST /cores/:core/{op}`). 실패하면 오류 문장을 버튼 아래에 보여 줍니다.
  - 지금 상태에서 아무 일도 하지 않을 조작은 `disabled`입니다(`dashboard/core-ops.ts`): start는 `idle`·`stopped`·`error`일 때만, stop은 `running`일 때만 켜집니다(`starting`·`stopping` 동안은 둘 다 꺼짐). 외부 코어는 복제 상태로 판단해, 내려간 복제가 하나라도 있으면 start, 도는 복제가 하나라도 있으면 stop이 켜집니다. reset은 언제나 켜져 있습니다. stop의 강조색(`danger`)은 켜져 있을 때만 씁니다.
- **설정**: 코어가 `configForm`을 등록했으면 그 폼, 아니면 JSON 편집기(TextArea, 들여쓰기 2칸). 저장은 `PATCH /cores/:core/config`이고, `VALIDATION_ERROR`의 `details`를 `경로: 문장` 줄로 편집기 아래에 보여 줍니다(문장은 §1.7). JSON이 아니면 보내지 않고 그 자리에서 알립니다(브라우저가 알려 주면 몇째 줄 몇째 칸인지, 아니면 따옴표·쉼표·괄호를 확인하라는 안내. 엔진의 영어 문장은 보이지 않음). 결과가 `applied`면 저장 버튼 옆에 "저장됨"(`role="status"`)을 보여 주고, 다시 편집하면 지웁니다(결함 규칙 편집기와 같음). 결과가 `restart-required`면 "재시작해야 적용됨 · 지금 재시작" 안내와 버튼(stop → start)을 띄웁니다.
- **액션**: `surfaces`에 `ui`가 있는 액션마다 버튼 하나. 누르면 액션 `description`과 `inputSchema`로 만든 폼이 열립니다(§1.4). 실행 결과(출력 JSON 또는 오류 문장)를 폼 아래에 보여 주고, 입력은 다음 실행을 위해 남겨 둡니다. 입력 검증 실패는 `필드: 문장` 줄로 보여 주고(§1.7), 서버가 짚은 필드가 폼의 입력칸이면 그 칸에도 표시합니다. `mutating: false` 액션은 락이 걸려도 실행할 수 있습니다.
  - 외부 코어면 폼 위에 대상 선택(전체 복제 / r0 / r1 …)이 있습니다(`?replica=`). 결과는 복제별로 나눠 보여 줍니다: 하나를 골랐으면 그 복제 하나, 전체면 `{ r0, r1, … }`의 자리마다(실패한 자리 `{ error }`는 오류 색).
- **결함 규칙**: 매니페스트의 `faults`가 비어 있지 않을 때만 보입니다(§1.3).

### 1.3 결함 규칙 편집기

코어 설정의 `faults`([faults-and-seed.md](faults-and-seed.md))를 규칙마다 한 줄로 편집합니다(`src/client/testbed/editing/fault-editor.tsx`, 변환은 `faults-table.ts`).

| 열            | 입력                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`          | 필수                                                                                                              |
| `match`       | `키=값, 키=값`. 값이 JSON으로 읽히면(숫자, `true`, `"따옴표"`) 그 값, 아니면 문자열                               |
| `probability` | `0`–`1`, 비우면 항상                                                                                              |
| `delayMs`     | `200` 또는 범위 `100-300`. 코어가 `delay`를 지원할 때만 보임                                                      |
| 효과          | 없음 / 매니페스트 `faults`에 있는 종류(`delay` 제외: 위 열). `error`를 고르면 오류 종류 칸(예: `http-500`)이 생김 |
| `times`       | 1 이상 정수, 비우면 제한 없음                                                                                     |

- 라벨은 열 이름만 두고, 입력 형식(`키=값, …`, `0–1`, `n 또는 min-max`)은 칸 아래 안내로 둡니다. 좁은 코어 열에서도 라벨이 한 줄이라 칸 높이가 맞습니다. 이동·삭제 버튼은 규칙 아래 한 줄입니다.
- 행 추가·삭제·위아래 이동. 읽을 수 없는 칸은 저장하지 않고 그 칸에 표시합니다. 서버가 거절하면 `faults.<n>.<열>` 경로의 문제는 그 칸에(규칙 전체나 `disconnect`·`corrupt`는 효과 칸에), 보이지 않는 칸이나 그 밖의 경로는 표 아래에 "규칙 n · 열: 문장"으로 보여 줍니다. 문장은 모두 i18n 키(`testbed.issue.*`)입니다.
- 저장은 설정 패치 `{ faults: [...] }`이고, 규칙 목록을 통째로 바꿉니다.

### 1.4 액션 폼이 지원하는 스키마

`src/client/testbed/editing/schema-form.ts`. 액션의 `inputSchema`(JSON Schema)가 다음이면 필드 폼, 아니면 JSON 편집기입니다.

- 최상위가 `object`이고 모든 속성이 아래 중 하나(중첩 없음):
  - `string`: `minLength`·`maxLength`(입력 제한), `enum`이면 선택 상자
  - `number`·`integer`: `minimum`·`maximum`(JSON Schema의 안전 정수 경계는 무시)
  - `boolean`: 체크박스
- `required`에 없는 필드는 "(선택)"이 붙고, 비우면 입력에서 빠집니다. 숫자로 읽을 수 없거나(정수 필드에 소수 포함) 필수 숫자가 비면 보내지 않고 그 필드에 표시합니다. 범위·길이 검사는 서버가 하고, 화면은 그 `code`·`params`로 문장을 만듭니다(§1.7).

### 1.5 주 영역 탭과 상세 패널

구현은 `src/client/testbed/views/`. 계산(가상 스크롤 범위, 필터 ↔ 주소, 따라가기, 통계, 가린 값 감지, 타임라인 필터)은 React와 분리된 함수이고 단위 테스트가 있습니다.

- **이벤트 로그**(`event-log.tsx`)
  - 한 행: 시각(브라우저 시간대 `HH:MM:SS.mmm`), level, actor, replica(보이는 행 중 하나라도 값이 있을 때만), kind, summary. 행 높이 28px 고정, 보이는 행과 위아래 20행만 그립니다. 스크롤되는 행 위에 같은 열 배치로 열 이름(시각, level, actor, replica, kind, summary)을 고정해 둡니다.
  - 보일 행이 없으면 빈 상자 대신 안내를 띄웁니다: 이벤트가 하나도 없으면 "아직 이벤트가 없습니다", 있는데 필터에 걸러졌으면 "조건에 맞는 이벤트가 없습니다". 지난 Run을 불러오는 동안에는 띄우지 않습니다.
  - 필터: Run(현재 = 열린 Run, 없으면 전체 / 전체 / 특정 Run), core, kind 접두사, level 이상, actor, replica(외부 코어가 있을 때), summary 검색. 주소의 `run`, `core`, `kind`, `level`, `actor`, `replica`, `q`에 남습니다(`run=current`와 빈 값은 생략). kind와 검색 입력칸은 친 글자를 스스로 들고 있다가 바뀔 때마다 주소에 씁니다(주소에서 값을 다시 읽어 넣지 않으므로 빠르게 치거나 한글을 조합해도 글자가 사라지지 않음). 각 필터는 주소의 현재 값에 덮어씁니다.
  - 맨 아래(반 행 이내)에 있으면 새 이벤트를 따라갑니다. 위로 스크롤하면 멈추고 "새 이벤트 n건 · 맨 아래로" 버튼을 띄웁니다. 스크롤 이벤트가 닿기 전에 새 행이 오면, 마지막 자동 스크롤 위치보다 위에 있는지로 사람이 올라간 것을 알아챕니다.
  - 스토어의 `omitted` 누적(서버 표본화로 빠진 건수)을 로그 위에 표시합니다.
  - 열린 Run이 아닌 Run을 고르면 스토어 대신 `GET /events?runId=…`를 커서로 이어 받습니다(500건씩, 최대 20,000건).
- **상세 패널**(`detail-panel.tsx`): 고른 이벤트를 `GET /events/:id`로 다시 읽습니다(링버퍼에서 밀려나 404면 목록의 이벤트를 그대로 씀). 봉투 필드(시각은 로컬과 UTC)와 payload 트리. 트리는 두 단계까지 펼쳐 두고, 줄마다 경로(`data-path="payload.lease.holder"`, `payload.items[0]`)를 붙입니다. 제목 옆 버튼은 이벤트 전체를 JSON(들여쓰기 2칸)으로 복사합니다. 공통 가림 형식(`앞4자…(len n, sha256:12자)`)의 값은 점선으로 강조하고 "가린 값" 배지를 붙입니다. `correlationId`가 있으면 같은 묶음의 이벤트를 REST(`GET /events?correlationId=…`, 같은 Run)로 가져와 보여 주고, 누르면 그 이벤트로 바뀝니다.
- **통계**(`stats-panel.tsx`): 대상은 열린 Run의 이벤트(없으면 스토어 전체). kind별·level별 건수, 오류율(`error` / 전체), `latencyMs`가 있는 kind의 건수·평균·p95(nearest-rank)·최대. 초당 이벤트 수(최근 60초) 스파크라인은 `<canvas>`에 `requestAnimationFrame`으로 직접 그리고, 초나 데이터가 바뀔 때만 다시 그립니다.
- **Run**(`runs-panel.tsx`): 열린 Run(label, runId, 시작 시각, 연 주체, 경과 시간, seed)과 종료 버튼, 시작 폼(label, seed, "열린 Run을 닫고 시작"; 폼 폭은 24rem까지), 지난 Run 목록(`GET /runs`). "열린 Run을 닫고 시작"은 열린 Run이 있을 때만 보이고, 체크는 체크할 때 열려 있던 그 Run에만 걸립니다(다른 Run으로 바뀌면 풀림). 시작에 성공하면 label·seed·체크를 비웁니다. 고르면 요약(기간, kind·level별 건수, 오류 상위, check 결과)과 내보내기 링크. `openedBy`와 `endedBy`가 다르면 "다른 주체가 닫음", `endReason`이 `replaced`·`restart`면 그 사유를 배지로 보여 줍니다.
- **에이전트 타임라인**(`agent-timeline.tsx`): actor가 `agent`인 이벤트와 `testbed.control.*`, `testbed.lease.*`만 시간순(최근 500건). 대시보드에서 사람이 한 조작(actor `human`)은 넣지 않습니다(이벤트 로그에 있음). 사람의 클릭이 쌓여 에이전트 항목이 묻히지 않게 하기 위해서입니다. 항목마다 caller 이름과 세션(또는 lease id) 앞 4자를 붙입니다. caller는 봉투의 `caller`([events.md](events.md) §2, 조작·check·Run·액션 이벤트), 없으면 `payload.caller`(거절된 조작), 그것도 없으면 `payload.lease`(보유자)에서 읽습니다. 이벤트 로그처럼 맨 아래에 있으면 새 항목을 따라가고, 위로 스크롤하면 멈추고 "새 이벤트 n건 · 맨 아래로" 버튼을 띄웁니다. 누르면 상세 패널에 보이고, 상세 패널의 봉투에도 `caller`가 나옵니다.

### 1.6 연결 패널 조각

모든 주소는 매니페스트의 `publicUrl`(`TESTBED_PUBLIC_URL`)로 만듭니다. 데이터면 주소는 실시간 상태의 것을 씁니다(포트 `0`으로 다시 연 코어는 주소가 바뀜).

- 제어면 MCP URL: `<publicUrl>/testbed/mcp`
- `.mcp.json` 조각. 서버 이름은 `tb-<name에서 앞의 'testbed-'를 뺀 것>`입니다. 매니페스트 `auth.control`이 `bearer`면 `headers`를 넣습니다.

  ```json
  {
    "mcpServers": {
      "tb-llm": {
        "type": "http",
        "url": "http://host:40020/testbed/mcp",
        "headers": { "Authorization": "Bearer ${TESTBED_CONTROL_TOKEN}" }
      }
    }
  }
  ```

- 제품 레포 CLAUDE.md 스니펫(틀): 테스트베드 이름과 용도 한 줄, MCP 서버 이름과 URL, 기본 흐름(`testbed_info` → `start_run` → 제품 작업 → `check` → `end_run` → `release_control`), 데이터면 주소 목록. 테스트베드마다 덧붙일 문장은 매니페스트에 아직 없습니다.

### 1.7 오류 문장

서버의 오류 문장은 에이전트가 읽도록 쓴 것이고(도구 이름, UTC 시각), 검증 문장은 검증 라이브러리의 영어입니다. 화면은 이를 그대로 보이지 않고 `code`와 `details`로 화면의 언어(ko/en) 문장을 만듭니다(`src/client/testbed/editing/errors.ts`).

- **검증 오류**(`VALIDATION_ERROR`): 문제마다 `경로: 문장` 한 줄. 경로가 비면 "(전체)", `unrecognized_keys`는 키마다 `키: 알 수 없는 키`. 문장은 `code`와 `params`([control-plane.md](control-plane.md) §3)로 만듭니다. 예: `too_small`(숫자) "1 이상이어야 함", 문자열 최소 1 "비워 둘 수 없음", `invalid_type`에 빠진 필드 "필수", `invalid_value` "debug, info 중 하나여야 함", `unknown_key` "설정에 없는 키". 모르는 `code`(코어가 직접 만든 `custom` 등)만 서버 문장을 씁니다.
- **제어면 오류**([control-plane.md](control-plane.md) §3): `details`로 만들고, 도구·입력 이름 대신 화면의 컨트롤 이름을, UTC 대신 브라우저 시각을 씁니다.

  | 코드                    | 화면 문장(ko)                                                                                                                   |
  | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
  | `RUN_ACTIVE`            | "Run 'label'이(가) 이미 열려 있음(human이(가) 10:45:12에 엶). 닫고 새로 시작하려면 '열린 Run을 닫고 시작'을 체크하고 다시 시작" |
  | `CORE_NOT_RUNNING`      | "코어 sample가 running이 아니라 stopped 상태임. 코어 카드에서 '시작'을 누른 뒤 다시 시도"(외부 코어는 `py-echo r1`처럼 복제)    |
  | `LOCKED` · `LEASE_HELD` | 락 배너와 같은 보유자·세션·남은 시간: "claude-code가 제어 중이라 조작할 수 없음 · 세션 ab12 · 남은 시간 08:41. …"               |
  | `RESTART_REQUIRED`      | "이 Run의 sample 설정은 재시작해야 적용됨. 설정에 저장하고 '정지' → '시작'을 누른 뒤 Run을 시작"                                |
  | `NOT_FOUND`             | 열린 Run이 없으면 "열린 Run이 없음", 그 밖에는 "action 'sample.x'을(를) 찾을 수 없음"                                           |
  | `CORE_ERROR`            | "코어 py-echo r0가 오류 BUSY로 답함: <코어의 문장>". `coreCode: 'EXITED'`면 프로세스가 끝났다고                                 |
  | `CORE_TIMEOUT`          | "코어 py-echo r0가 5000ms 안에 답하지 않음. 로그를 보고 다시 시도"                                                              |

  보일러플레이트 코드(`UNAUTHORIZED`, `INTERNAL_ERROR` 등)는 서버가 이미 화면 언어로 보내므로 그대로 씁니다. 필요한 `details`가 없으면 서버 문장을 씁니다.

## 2. 제어 락 표시

- 락이 걸리면 모든 조작 컨트롤을 비활성화합니다(`aria-disabled="true"`, `<html data-lease="agent">` 또는 `data-lease="ci"`). 락이 없으면 `data-lease="none"`입니다. 조작 컨트롤은 모두 `useCanOperate()`(락이 없을 때만 `true`) 하나로 비활성 여부를 정합니다.
- 상단 배너: "<보유자 이름 또는 actor>가 제어 중 · 세션 ab12 · 남은 시간 08:41". 이름은 보유자의 표시 이름(MCP `clientInfo.name`)을 쓰고, 남은 시간은 1초마다 줄어듭니다(받은 `remainingMs`에서 받은 뒤 흐른 시간을 뺌).
- 대시보드에는 강제 해제 버튼을 두지 않습니다.

### 2.1 편집하던 중에 잠길 때

- 편집 컴포넌트(설정 편집기, 액션 폼, 결함 규칙 편집기)는 락이 걸려도 **입력을 지우지 않고** 읽기 전용으로 바뀝니다.
- 옆에 "Claude Code가 제어를 시작해 저장할 수 없음 · 입력 복사" 안내를 띄웁니다.
- 저장을 누른 순간 잠겨 `423 LOCKED`를 받은 경우도 같은 안내를 띄우고 입력을 보존합니다.
- 락이 풀리면 편집을 다시 이어 갈 수 있습니다. 그 사이 서버 값이 바뀌었으면 "서버 값이 바뀜 · 다시 불러오기 / 내 입력 유지"를 고르게 합니다.
- 이 동작은 공통 편집 래퍼 `LockAwareEditor`(`src/client/testbed/editing/lock-aware-editor.tsx`, 훅 `useLockAwareEditor`)가 제공합니다. 설정 편집기, 액션 폼, 결함 규칙 편집기, 코어 전용 폼이 모두 이 래퍼를 씁니다.
  - 편집을 시작한 시점의 서버 값(`base`)을 기억합니다.
  - 상태: `idle`(서버 값 표시) → `editing` → `locked`(락 또는 423, 입력 보존·읽기 전용) → 해제 시 서버 값을 다시 읽어 `base`와 같으면 `editing`, 다르면 `server-changed`. "다시 불러오기"는 서버 값으로(`idle`), "내 입력 유지"는 입력을 두고 새 서버 값을 `base`로 삼아 `editing`. 저장이 성공하면 `idle`.
  - 상태 전이는 React와 분리된 순수 함수(`lock-editor.ts`)라 단위 테스트로 확인합니다.
  - 서버 값을 다시 읽지 못하면 1초 뒤 한 번 더 읽고, 그래도 안 되면 마지막으로 알던 값과 비교합니다.
- 조작 버튼(start/stop/reset, 저장, 액션 실행)은 `OperateButton`이며, 락이 걸리면 포커스는 받되 `aria-disabled="true"`이고 눌러도 아무 일도 하지 않습니다. 락과 별개로, 상태에 맞지 않는 조작(§1.2)은 `disabled` prop으로 진짜 `disabled`가 됩니다(락 여부와 상관없이).

## 3. 규칙

- **스토어**(`src/client/testbed/store/`): React state 밖에 둡니다.
  - `/testbed/ws`의 `snapshot`으로 상태·이벤트를 채우고 `event`·`status`·`lease` 증분을 반영합니다.
  - 이벤트는 최근 5000건만 둡니다. `event` 묶음의 `omitted`(서버 표본화로 빠진 건수)는 누적합니다.
  - 끊기면 1초부터 2배씩 최대 10초 간격으로 다시 연결합니다. 다시 연결되면 새 `snapshot`으로 통째로 바꾸고, `instanceId`가 바뀌었으면 "테스트베드가 재시작됨" 알림을 한 번 띄웁니다.
  - 구독자에게는 최대 10Hz(100ms 묶음)로 알립니다. 컴포넌트는 `useSyncExternalStore`로 구독합니다.
  - 훅: `useTestbed()`(스냅샷 전체), `useTestbedStatus()`, `useLease()`, `useCanOperate()`, `useTestbedEvents(filter)`(`runId: 'current'`는 열린 Run).
- **REST 호출**: `src/client/api/endpoints.ts`의 `testbedApi`로만 부릅니다. 대시보드의 호출자는 사람입니다(`X-Testbed-Actor`를 보내지 않음). 락 획득·해제 엔드포인트는 목록에 두지 않습니다(사람은 락을 잡지 않음).

- **고빈도 렌더링**: 이벤트 상태는 React state 밖의 스토어에 두고 `useSyncExternalStore`로 약 10Hz 스냅샷을 구독합니다. 초당 수천 건의 이벤트를 React state로 다루면 렌더링이 따라가지 못하기 때문입니다. 차트는 자기 애니메이션 프레임으로 그립니다.
- **testid**: 보일러플레이트의 `TESTID` 레지스트리(`src/client/testing/testids.ts`, [../ui-automation.md](../ui-automation.md))를 씁니다. 공통 컴포넌트는 `TESTID.testbed.*`, 코어 고유 화면은 `TESTID.<core>.*`입니다. 락 상태는 `data-lease`와 `aria-disabled`로 관찰합니다.
- **디자인**: 보일러플레이트 디자인 시스템(스킨, 토큰, `src/client/ui/*`)을 그대로 씁니다.
- **코어는 브라우저에 두지 않습니다.** 화면은 보여 주고 REST로 명령을 보내기만 합니다.

## 4. 패널 슬롯 (기본 배치를 쓸 때)

기본 배치를 쓰는 테스트베드는 프레임을 고치지 않고 `src/client/testbed/cores/<core id>/index.ts`에서 모듈을 내보내고, `src/client/testbed/cores/index.ts`의 `CLIENT_CORES`에 올립니다(서버의 `cores/index.ts`와 같은 방식).

```ts
interface ClientCoreModule {
  core: string;
  panels?: { id: string; title: MessageKey; component: ComponentType }[]; // 주 영역 탭
  configForm?: ComponentType<ConfigFormProps>; // 설정 전용 폼(P3 M8). 없으면 JSON 편집기
}

interface ConfigFormProps {
  core: string;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  readOnly: boolean; // 락이 걸림
}
```

- 패널 탭의 id는 `<core>.<panel id>`이고 공통 탭 뒤에 붙습니다. 제목은 i18n 키(`src/shared/i18n/messages/*`)입니다.
- 고유 패널은 스토어 훅(`useTestbedEvents(filter)`, `useTestbedStatus()`, `useLease()`)과 `testbedApi`만 씁니다.
