# testbed-base 스펙

`testbed-base` 자체를 만드는 단계별 스펙입니다. 지금은 P0–P6을 다룹니다. P6(M15–M20)을 P5(M21–M23)보다 먼저 합니다(첫 테스트베드가 P6를 기다림). 공통 규약은 [docs/testbed/](testbed/README.md)가 원본이고, 이 문서는 그 규약을 **이 저장소에 처음 구현하는 순서와 수용 기준**을 정합니다.

## 변경 이력

| 날짜       | 바뀐 절                                                                                                                                                                                                                                                                    | 영향받는 마일스톤 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 2026-11-28 | 2절: M15 결과(공통 시험 하드코딩을 첫 테스트베드와 같은 형태로, 샘플 코어 이벤트 타입 이동, `e2e/testbed.ts` env 확인 방법, 다운스트림 흉내 실행 방법)                                                                                                                     | M15               |
| 2026-11-28 | 11절: P5(M21–M23 원격 워커 전송, Python 워커 실행기와 docker compose 예제, 표면 반영) 추가. 12절에서 원격 워커 항목 삭제                                                                                                                                                   | M21–M23           |
| 2026-11-27 | 11절: P6(M15–M20 공통 시험 정리와 샘플 코어 분리, 대시보드 프레임·배치 분리, 공통 위젯 공개, 실시간 값, UI 계약 시험과 배치 시험 분리, UI 설계 하네스) 추가. 머리말, 2절(P6 전제 3건), 10절, 12절 갱신                                                                     | M15–M20           |
| 2026-11-25 | 3절·11절 M13: py-echo의 바인딩·공개 호스트 `PY_ECHO_BIND_HOST`·`PY_ECHO_PUBLIC_HOST` 추가. 11절 M6: 이미지 job의 포트를 포트 블록 전체(`-p 40000-40009:40000-40009`)로. 13절 1번(GHCR 공개 여부)을 공개로 결정해 3절로 옮김                                                | M6, M13           |
| 2026-11-25 | 2절: M11 결과(JSON Schema → 검증기는 zod `fromJSONSchema`, 라이브러리 추가 없음)                                                                                                                                                                                           | M11               |
| 2026-11-25 | 11절: P4(M11–M14 외부 프로세스 코어, 감시·복제, Python 참조 구현, 표면 반영) 추가. 3절(예제 코어), 12절 갱신. `testbed/external-core-protocol.md` 개정(initialize에서 설정 분리, 설정 필드, 오류 변환, 감시 이벤트, 언어 간 재현성), `testbed/ports.md`에 40002–40008 등록 | M11–M14           |
| 2026-11-24 | 11절: P2(M5–M6 MCP 어댑터, 스모크)와 P3(M7–M10 대시보드, UI 자동화) 추가. 10절, 12절, 13절 갱신(13절 1번은 M1 성공으로 삭제)                                                                                                                                               | M5–M10            |
| 2026-11-24 | 2절: M1 결과(MCP SDK 1.32.2, 웹 표준 전송을 `Bun.serve`에 바로 붙임)                                                                                                                                                                                                       | M1, P2            |
| 2026-11-24 | 11절 M0: 데모 제거 업그레이드 가이드(보일러플레이트 머지 때 충돌 해결 원칙) 추가                                                                                                                                                                                           | M0                |
| 2026-11-24 | 최초 작성(P0–P1)                                                                                                                                                                                                                                                           | M0–M4             |

## 1. 목적

- 모든 테스트베드가 공유하는 공통 런타임(코어 호스트, 이벤트, Run, 제어 서비스, 제어 락, REST/WS, 매니페스트)을 한 번만 만듭니다.
- 각 테스트베드 레포는 이 저장소의 이력을 이어받아 `cores/<id>/`만 추가하면 되게 합니다.
- 공통 런타임이 실제로 쓸 만한지 확인하기 위해 샘플 코어(TCP echo)를 함께 만듭니다.

## 2. 확정된 전제

- [docs/testbed/architecture.md](testbed/architecture.md)의 결정을 모두 따릅니다.
- 보일러플레이트의 `main` 이력을 이어받았습니다(완료). 보일러플레이트 쪽 파일은 업스트림 머지 충돌을 줄이기 위해 **필요한 만큼만** 고칩니다.
- `migrations/`는 그대로 둡니다. 새 마이그레이션을 만들지 않습니다. 기본값이 `DB_DRIVER=memory`이므로 테스트베드는 DB 없이 뜹니다.
- 보일러플레이트의 회원 로그인(OIDC) 코드와 디자인 시스템 페이지는 유지합니다. 공용 서버에서 사람 로그인에 씁니다.
- `pubsub/`는 유지합니다(데모가 아님).
- P1에는 MCP 어댑터, 대시보드 화면, 외부 코어를 넣지 않습니다(12절).
- **MCP SDK (M1 결과)**: `@modelcontextprotocol/sdk` 1.32.2를 씁니다. SDK의
  `WebStandardStreamableHTTPServerTransport`(`server/webStandardStreamableHttp.js`)가 웹 표준 `Request`를 받아
  `Response`를 돌려주므로 `Bun.serve` 라우트 핸들러에 그대로 붙습니다. Node `http` 객체를 흉내 내지 않습니다.
  MCP 세션마다 전송과 `McpServer`를 하나씩 만들고 `Mcp-Session-Id`로 고릅니다(`onsessioninitialized`에서 등록,
  `onsessionclosed`에서 제거). 세션 없는 요청은 `initialize`만 받고, 끝난 세션의 요청은 404입니다. 도구 입력
  스키마는 `@shared/validation`의 `s`(zod/mini)를 그대로 씁니다. JSON 응답(`enableJsonResponse`)과 기본 SSE 응답
  모두 확인했습니다(`src/server/testbed/mcp/mcp-sdk.integration.test.ts`).
- **JSON Schema → 검증기 (M11 결과)**: 라이브러리를 추가하지 않고 zod 4.6.5의 `fromJSONSchema`를 씁니다.
  `@shared/validation`의 `fromJsonSchema(schema)`가 이를 감싸고, zod가 거르지 않는 모양 오류(`properties`가 객체가
  아님, JSON Schema 키워드가 없음 등)는 앞에서 얕게 검사합니다. 범위(`minimum`·`maximum`), `enum`, `required`,
  `integer`, `anyOf`, `additionalProperties: false`가 검증되는 것을 확인했습니다
  (`src/shared/validation/validation.test.ts`). `toJsonSchema`는 받은 스키마를 그대로 돌려줍니다(매니페스트 노출용).
- **P6 — 첫 테스트베드의 요청에서 사람이 정한 것** (2026-11-27)
  - 이벤트 필터의 `kind`는 접두사 하나 또는 **여러 개(any-of)**를 받습니다. 제어 서비스 필터부터 넓히므로 REST, MCP(`query_events`·`wait_for`·`check`), 대시보드 위젯이 모두 같은 조건을 씁니다(M17).
  - 이벤트 없이 바뀌는 코어 상태(`status().counters`, `status().summary`)는 **서버가 WS로 주기적으로 밀어 줍니다**(최대 1초 간격, 바뀐 코어만). 읽기 전용 액션을 폴링하는 훅은 두지 않습니다(M18).
  - 샘플 코어는 **시험 전용 위치** `src/server/testbed/testing/sample-core/`로 옮깁니다. 공통 시험은 그곳에서 직접 가져오고, 서버 `cores/index.ts`(`CORES`)에는 기대지 않습니다. 이 저장소는 `CORES`에 샘플 코어를 계속 등록하고, 테스트베드는 그 한 줄만 빼면 됩니다(M15).
- **M15 결과**
  - 공통 시험의 하드코딩은 첫 테스트베드(`slack-agent-org-dash`)가 고쳐 둔 것과 같은 형태로 받았습니다: 매니페스트 이름은 `package.json`의 `name`과 비교, 출하 스모크 시험은 `loadScenarios()` 목록과 "FAIL 없음·공통 점검 PASS", 시나리오 목록 시험은 공통 런타임의 시나리오(`testing/sample-core/`, `examples/`)만 걸러서 봄.
  - 샘플 코어의 이벤트 타입도 `src/shared/testbed/testing/sample-core/events.ts`로 옮겼습니다(테스트베드가 `cores/`를 정리하다 지우지 않게).
  - `e2e/testbed.ts`의 env가 서버에 닿는지는 시작한 서버 프로세스의 `/proc/<pid>/environ`을 읽어 확인합니다(`e2e/support/testbed-setup.test.ts`, Linux에서만 돎). 서버에 시험 전용 경로를 두지 않았습니다.
  - 다운스트림 흉내는 `bun run test:downstream`(`src/server/testbed/downstream.integration.test.ts`, `TESTBED_DOWNSTREAM=1`일 때만)이고 CI가 돌립니다. Python 시험은 `TESTBED_SKIP_PYTHON=1`로 뺍니다.

## 3. 구성

| 코어 id               | 유형      | 실행         | 복제                     | 데이터면                                 |
| --------------------- | --------- | ------------ | ------------------------ | ---------------------------------------- |
| `sample`              | `passive` | in-proc      | 1                        | TCP `40001` (`SAMPLE_PORT`)              |
| `py-echo` (예제, M13) | `passive` | 외부(Python) | 1–7 (`PY_ECHO_REPLICAS`) | TCP `40002` + 복제 번호 (`PY_ECHO_PORT`) |

- `py-echo`는 외부 코어 참조 구현의 예제입니다. 외부 프로세스를 쓰는 이유는 "다른 언어 SDK"의 자리 표시(Python 어댑터 시연)입니다. `TESTBED_EXAMPLE_CORES=py-echo`일 때만 등록됩니다.
- 포트 블록: `40000–40009`([testbed/ports.md](testbed/ports.md)에 등록됨). `PORT` 기본값은 `40000`.
- 이미지: `ghcr.io/hwahee/testbed-base`는 **공개 패키지**입니다(저장소와 같음). pull에 토큰이 필요 없습니다.

## 4. 상호작용 프로토콜 (샘플 코어)

- 평문 TCP입니다. 제품(또는 시험 클라이언트)이 `40001`에 연결해 바이트를 보내면, 받은 데이터 조각(chunk)을 **그대로** 돌려보냅니다.
- 메시지 경계는 없습니다. 받은 조각 하나에 응답 하나입니다.
- 연결마다 `c-<순번>` id를 붙입니다(부팅마다 1부터).

## 5. 코어 동작 명세 (샘플 코어)

| 상황                                           | 동작                                                                        | 이벤트                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| 연결 수락                                      | 연결 id 부여                                                                | `sample.connection.opened`                          |
| 열린 연결이 `maxConnections`와 같을 때 새 연결 | 수락한 뒤 바로 닫음                                                         | `sample.connection.rejected`                        |
| 데이터 수신                                    | 결함 판정 → 그대로 돌려보냄                                                 | `sample.data.received`, `sample.data.echoed`        |
| 수신 조각이 `maxChunkBytes`보다 큼             | 돌려보내지 않고 연결을 닫음(`reason: 'too-large'`)                          | `sample.data.too-large`, `sample.connection.closed` |
| `idleTimeoutMs` 동안 수신 없음(0이면 끔)       | 연결을 닫음(`reason: 'idle'`)                                               | `sample.connection.closed`                          |
| 클라이언트가 닫음                              | 정리                                                                        | `sample.connection.closed`(`client`)                |
| `stop`                                         | 열린 연결을 모두 닫고(`reason: 'stop'`) 리스너를 닫음                       | `sample.connection.closed` × n                      |
| `reset`                                        | 열린 연결을 모두 닫고 카운터·연결 순번·결함 `times`를 초기화. 리스너는 유지 | `sample.connection.closed` × n                      |
| 포트를 열 수 없음                              | `error` 상태로 감. `detail`에 OS 오류 코드(`EADDRINUSE`, `EACCES` 등)       | `testbed.core.state`                                |
| `broadcast` 액션                               | 열린 연결 모두에 `text`(UTF-8)를 보냄. 결함은 적용하지 않음                 | `sample.broadcast.sent`                             |

- `status().counters`: `connectionsOpen`, `connectionsTotal`, `bytesIn`, `bytesOut`.
- `status().endpoints`: `[{ name: 'echo', protocol: 'tcp', url: 'tcp://<TESTBED_PUBLIC_URL의 호스트>:<port>' }]`.

## 6. 이벤트 (샘플 코어)

| kind                         | level | 언제             | summary 형식                                             | payload 필드                                                                     |
| ---------------------------- | ----- | ---------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `sample.connection.opened`   | info  | 연결 수락        | `conn c-3 opened from 127.0.0.1:51234`                   | `connId`, `remote`                                                               |
| `sample.connection.rejected` | warn  | 연결 수 초과     | `conn rejected from 127.0.0.1:51240 (max 100)`           | `remote`, `max`                                                                  |
| `sample.data.received`       | debug | 조각 수신        | `c-3 received 32B`                                       | `connId`, `bytes`                                                                |
| `sample.data.echoed`         | info  | 조각을 돌려보냄  | `c-3 echoed 32B in 4ms` (결함이면 끝에 ` [fault f1]`)    | `connId`, `bytes`, `preview`(앞 64바이트, UTF-8 손실 허용), `sha256`, `faultId?` |
| `sample.data.too-large`      | warn  | 조각이 상한 초과 | `c-3 chunk 70000B > max 65536B, closing`                 | `connId`, `bytes`, `max`                                                         |
| `sample.connection.closed`   | info  | 연결 닫힘        | `conn c-3 closed (client) after 12.3s, in 320B out 320B` | `connId`, `reason`, `durationMs`, `bytesIn`, `bytesOut`                          |
| `sample.broadcast.sent`      | info  | `broadcast` 실행 | `broadcast 5B to 2 conns`                                | `bytes`, `connections`                                                           |

- `actor`: 데이터면 이벤트는 `product`, `broadcast`는 호출한 쪽의 actor입니다.
- `correlationId`: 연결 단위로 `connId`를 씁니다.
- `latencyMs`: `sample.data.echoed`에만 둡니다. 수신부터 쓰기 완료까지(결함 지연 포함).
- `reason` 값: `client` | `server` | `idle` | `too-large` | `fault` | `stop`.

## 7. 설정 (샘플 코어)

| 이름             | 타입          | 기본    | 범위              | env                      | 런타임 변경 | 재시작 필요 |
| ---------------- | ------------- | ------- | ----------------- | ------------------------ | ----------- | ----------- |
| `port`           | int           | `40001` | 0–65535 (0=임의)  | `SAMPLE_PORT`            | 가능        | 예          |
| `autoStart`      | boolean       | `true`  | –                 | `SAMPLE_AUTO_START`      | 불가        | –           |
| `maxConnections` | int           | `100`   | 1–10000           | `SAMPLE_MAX_CONNECTIONS` | 가능        | 아니오      |
| `maxChunkBytes`  | int           | `65536` | 1–1048576         | `SAMPLE_MAX_CHUNK_BYTES` | 가능        | 아니오      |
| `idleTimeoutMs`  | int           | `0`     | 0–3600000         | `SAMPLE_IDLE_TIMEOUT_MS` | 가능        | 아니오      |
| `eventLevel`     | enum          | `info`  | `debug` \| `info` | –                        | 가능        | 아니오      |
| `faults`         | `FaultRule[]` | `[]`    | 8절               | –                        | 가능        | 아니오      |

- `maxConnections`를 현재 열린 수보다 작게 바꾸면 이미 열린 연결은 닫지 않습니다. 새 연결부터 적용합니다.

## 8. 결함 주입 (샘플 코어)

| 지원 종류    | 선택자(match 키)          | 적용 방식                                          |
| ------------ | ------------------------- | -------------------------------------------------- |
| `delay`      | `connId`, `remoteAddress` | `delayMs`만큼 기다린 뒤 돌려보냄                   |
| `disconnect` | `connId`, `remoteAddress` | 돌려보내지 않고 연결을 닫음(`reason: 'fault'`)     |
| `corrupt`    | `connId`, `remoteAddress` | 각 바이트를 `0xFF`와 XOR해서 돌려보냄. 길이는 같음 |

- `error`는 지원하지 않습니다(TCP echo에는 오류 응답이 없음). 지정하면 설정 검증에서 거절합니다.
- 판정은 받은 조각마다 한 번입니다.

## 9. 제어 표면

| 액션        | 입력                         | 출력               | 부작용                       | 락  | REST | MCP | UI  |
| ----------- | ---------------------------- | ------------------ | ---------------------------- | --- | ---- | --- | --- |
| `broadcast` | `{ text: string(1–4096자) }` | `{ sent: number }` | 열린 연결 모두에 데이터 전송 | ●   | ●    | P2  | P3  |

- MCP와 UI 노출은 자동 노출로 생깁니다. MCP 도구 `sample_broadcast`는 M5·M6, 대시보드 액션 폼은 M8·M10에서 확인합니다.
- 공통 도구 중 한쪽에만 있는 것: 제어 락의 획득·해제는 MCP(`acquire_control`·`release_control`)와 REST(`/lease`)에만 있고 대시보드에는 없습니다. 사람은 락을 잡지 않기 때문입니다(설계상 확정).

## 10. 대시보드

- P3(M7–M10)에서 만들었고, P6(M16–M19)에서 **프레임**(공통 런타임)과 **배치**(테스트베드 소유)로 나눕니다([testbed/dashboard.md](testbed/dashboard.md)).
- 이 저장소의 배치는 기본 배치(`defaultLayout`)이며 P3에서 만든 화면과 같습니다. 기본 배치는 교체할 수 있는 기본값이고, 테스트베드가 따라 할 출발점이 아닙니다.
- 이 저장소는 장면 설계(테스트베드 스펙의 M3a)를 하지 않습니다. 샘플 코어는 고유 패널을 두지 않습니다(공통 위젯만으로 확인).
- 영역, 패널 슬롯, 편집 잠김 래퍼, testid는 11절의 M7–M10과 "대시보드 testid" 표, 프레임·배치·공통 위젯은 M16–M19를 따릅니다.

## 11. 마일스톤과 수용 기준

마일스톤 하나가 PR 하나입니다. 순서대로 진행합니다.

### M0 — P0: 보일러플레이트 정리

**범위**

1. 데모 제거: Todos와 채팅에 속한 클라이언트 페이지·훅·테스트, 서버 라우트·서비스·리포지토리 구현·실시간 게이트웨이·presence, 공유 도메인 타입, i18n 메시지, testid, `scripts/chat-load.ts`와 `chat:load` 스크립트. `/`는 빈 자리 페이지로 바꿉니다.
2. 기본값: `DB_DRIVER` 기본 `memory`(`config.ts`와 `.env.example`), `AUTH_DRIVER` 기본 `none`, `PORT` 기본 `40000`(`.env.example`, Dockerfile의 `ENV`·`EXPOSE`).
3. `package.json`의 `name`을 `testbed-base`로 바꿉니다.
4. GitHub Actions: 기존 `ci.yml`은 그대로 두고, `main` push일 때만 도는 이미지 job을 추가합니다. `check`가 통과한 뒤 Docker 이미지를 빌드해 `ghcr.io/hwahee/testbed-base`에 `:<git sha>`와 `:latest`로 push합니다(`permissions: packages: write`, `GITHUB_TOKEN` 사용).
5. `README.md`를 테스트베드 기준으로 다시 씁니다: 이 저장소가 무엇인지, 기동 방법, [docs/testbed/](testbed/README.md)와 이 스펙으로 가는 링크, 새 테스트베드 레포를 만드는 법(이력 이어받기).
6. `docs/upgrade-guides/README.md` 목록에 "출처" 열(`boilerplate` / `testbed-base`)을 추가합니다. 기존 항목은 `boilerplate`입니다.
7. 업그레이드 가이드 `docs/upgrade-guides/2026-11-testbed-demo-removal.md`를 추가하고 목록에 올립니다(출처 `testbed-base`). 가이드 규칙(같은 폴더 README의 "담을 것")을 따르고, 특히 다음을 담습니다.
   - 지운 경로 목록(폴더·파일 단위).
   - **충돌 해결 원칙**: 보일러플레이트를 머지할 때 지운 데모 파일에서 "한쪽은 수정, 한쪽은 삭제" 충돌이 나면 **삭제를 유지**합니다(`git rm <경로>`). 보일러플레이트가 데모와 공통 코드를 함께 고친 경우에는 공통 코드 쪽 변경만 받고, 데모를 되살리지 않습니다.
   - 보일러플레이트가 새 데모(예시 기능)를 추가했으면 머지 후 같은 원칙으로 지우고, 지운 경로를 이 가이드의 목록에 더합니다.
   - 적용 여부 확인 방법: 아래 수용 기준의 `git grep` 명령과 폴더 부재 확인.

**수용 기준**

- `bun run check` 통과.
- `git grep -n -i -E 'todo-service|todos-page|chat-gateway|chat-service|home-chat|chat-room|presence' -- src scripts` 결과가 비어 있음. `src/client/chat/`, `src/server/presence/`, `src/server/realtime/` 폴더가 없음.
- `.env` 없이 `bun run dev` → `curl -s localhost:40000/` 가 200이고, 빈 자리 페이지의 testid가 들어 있음.
- `docker build` 성공, 컨테이너를 띄우면 `40000`에서 200.
- 워크플로 파일에 이미지 job이 있고 `if: github.ref == 'refs/heads/main'` 조건이 붙어 있음.
- `docs/upgrade-guides/2026-11-testbed-demo-removal.md`가 있고, 목록에 출처 `testbed-base`로 올라 있으며, 지운 경로 목록이 실제로 지운 경로와 일치함.

### M1 — P1-a: MCP SDK 사전 확인

**범위**

- 공식 MCP TypeScript SDK(`@modelcontextprotocol/sdk`)를 의존성에 추가하고, Bun에서 Streamable HTTP 서버로 쓸 수 있는지 확인하는 통합 테스트를 둡니다.
- 핵심 질문: `Bun.serve`의 `fetch` 핸들러(Request/Response)에 SDK의 서버 전송을 붙일 수 있는가. Node `http` 객체를 흉내 내야 한다면 그 방법도 시험합니다.
- 테스트가 확인할 것: 세션 생성(`initialize` 응답의 `Mcp-Session-Id`), `tools/list`, `tools/call`(도구 하나: 입력 문자열을 그대로 돌려줌), 같은 세션으로 두 번째 호출, `DELETE`로 세션 종료 후 그 세션으로 호출하면 실패.
- 결과를 이 문서 변경 이력과 2절에 적습니다(사용한 SDK 버전, 붙인 방법).

**수용 기준**

- 위 테스트가 `bun test`로 통과하고 `bun run check` 통과.
- **테스트를 통과시킬 수 없으면 M2로 넘어가지 않고 멈춥니다.** 시도한 방법과 실패 내용을 PR에 적고 13절 1번을 사람에게 묻습니다.

### M2 — P1-b: 이벤트, Run, check, 재현성 도구

**범위**

- 이벤트 봉투 타입과 이벤트 버스, 링버퍼, 커서(`<instanceId>:<seq>`)와 `CURSOR_STALE` ([testbed/events.md](testbed/events.md)).
- Run 저장소 드라이버 `memory`, `file` 과 보존 정책, 재시작으로 닫히지 못한 Run 정리.
- Run 시작·종료·요약, `endActive`, Run 메타, check ([testbed/runs-and-checks.md](testbed/runs-and-checks.md)).
- `SeededRng`, 결함 판정 도우미 `FaultDecider` ([testbed/faults-and-seed.md](testbed/faults-and-seed.md)).
- 비밀값 가림 유틸과 payload 크기 상한.
- ESLint 규칙: `src/server/testbed/cores/**`에서 `Math.random` 금지.
- 이 단계에서는 제어 서비스 없이 모듈 함수로 시험합니다.

**수용 기준** (모두 `bun test`)

- 링버퍼: 상한 5건으로 만들고 7건을 넣으면 가장 오래된 2건이 빠지고 `seq`는 계속 증가.
- 커서: `after` 커서 다음 이벤트만 돌려줌. 다른 `instanceId`의 커서 → `CURSOR_STALE`, `details`에 `<현재 instanceId>:0`.
- Run: 열린 Run이 있을 때 다시 시작 → `RUN_ACTIVE`와 열린 Run 정보. `endActive: true` → 앞 Run `endReason: 'replaced'`, 새 Run 열림.
- file 저장소: 임시 디렉터리에 Run 하나를 기록하고 저장소를 새로 만들면(재시작 흉내) 그 Run이 `endReason: 'restart'`로 닫혀 있고 이벤트를 JSONL로 읽을 수 있음. 보존 3으로 Run 4개를 닫으면 가장 오래된 1개가 지워짐.
- check: `count: '==2'`, `'>=1'`, `'<=0'`, `none: true` 각각 pass/fail이 맞고, 판정마다 `testbed.check.evaluated`가 남음.
- rng: 같은 seed로 만든 두 `SeededRng`의 처음 1000개 값이 같음. `FaultDecider`는 같은 seed·같은 요청 순서에서 같은 판정 순서를 냄. `times: 2` 규칙은 두 번 적용 후 비활성.
- 가림: `Authorization: Bearer sk-abcdef…`가 `앞 4자…(len n, sha256:12자)` 형식이 되고, 원문이 링버퍼·file 저장소 어디에도 없음.
- 크기: 20KB payload → 16KB 이하로 잘리고 `truncated: true`.
- `cores/` 아래 파일에서 `Math.random()`을 쓰면 `bun run lint`가 실패함(규칙 테스트 또는 fixture로 확인).

### M3 — P1-c: 코어 호스트와 샘플 코어

**범위**

- in-proc 코어 호스트: 코어 등록, 상태 기계와 `testbed.core.state`, `autoStart`, `applyConfig`/`restart-required`, env 기본값 → 설정 검증 ([testbed/core-contract.md](testbed/core-contract.md)).
- 샘플 코어 `sample`(3–9절)을 `src/server/testbed/cores/sample/`에.
- 서버 부팅에 코어 호스트를 묶고, graceful shutdown 때 모든 코어를 `stop`.

**수용 기준** (모두 `bun test`, 포트는 `0`으로 열고 `endpoints`에서 주소를 읽음)

- 연결 → 32바이트 전송 → 같은 32바이트 수신. 이벤트 `opened`, `echoed`(`latencyMs` 있음) 순서로 남음. `eventLevel: debug`일 때만 `received`가 남음.
- `maxConnections: 1`에서 두 번째 연결 → 바로 닫히고 `rejected`(warn).
- `maxChunkBytes: 16`에서 32바이트 전송 → 응답 없이 닫히고 `too-large`, `closed(reason: 'too-large')`.
- `idleTimeoutMs: 100` → 아무것도 안 보내면 닫히고 `closed(reason: 'idle')`.
- 결함: `delay`(`delayMs: 200`) → `latencyMs ≥ 200`. `disconnect` → 응답 없이 닫힘, `closed(reason: 'fault')`, `testbed.fault.injected`가 같은 `correlationId`로 남음. `corrupt` → 각 바이트가 `0xFF` XOR. `error` 지정 → 설정 검증 실패.
- 이미 쓰는 포트로 시작 → `error` 상태, `detail`에 `EADDRINUSE`.
- `port` 변경 → `restart-required`, `stop`→`start` 후 새 포트에서 동작.
- `reset` → 열린 연결이 닫히고 `counters`가 0, 리스너는 그대로.
- `broadcast({ text: 'hello' })` → 열린 연결 2개 모두 `hello` 수신, 결과 `{ sent: 2 }`.

### M4 — P1-d: 제어 서비스, 제어 락, REST, WS, 매니페스트

**범위**

- 제어 서비스 함수 전부와 `testbed.control.invoked` ([testbed/control-plane.md](testbed/control-plane.md) §1).
- 제어 락: MCP 세션용 보유 로직(자동 획득·TTL 연장·만료)은 세션 id를 받는 함수로 만들어 두고, P2의 MCP 어댑터가 부릅니다. REST `leaseId` 방식은 이 단계에서 완성합니다(§2).
- REST 어댑터 `/testbed/api/*` 전부(§3)와 오류 코드·HTTP 상태.
- WS `/testbed/ws`: `snapshot`, `event`, `status`, `lease` (§5). 표본화는 초당 200건을 넘으면 시작하고, 생략 건수를 `event` 묶음에 담습니다.
- 매니페스트(§6), 인증과 actor 판별(§7), `TESTBED_CONTROL_TOKEN`.
- `bun run testbed:release`: 서버 쪽에서 락을 강제로 푸는 명령. 실행 중인 인스턴스에 로컬(127.0.0.1) 전용 경로로 요청하고, `testbed.lease.released`에 `actor: 'system'`, `reason: 'forced'`를 남깁니다.

**수용 기준** (`bun test`의 HTTP 통합 테스트로 자동화하고, 아래 curl 흐름이 수동으로도 재현됨)

- `GET /testbed/api/manifest` → `cores[0].id == 'sample'`, `endpoints[0].protocol == 'tcp'`, `control.rest == '/testbed/api'`, `instanceId` 있음.
- `POST /testbed/api/lease`(`X-Testbed-Actor: ci`) → `leaseId`. 같은 헤더로 `POST /runs {label:'t1'}` → 201. 헤더 없이(`X-Testbed-Actor: human`) `POST /cores/sample/stop` → 423 `LOCKED`, 본문에 보유자와 남은 시간. 다른 `leaseId`로 `X-Testbed-Actor: ci` 호출 → 409 `LEASE_HELD`. 거절마다 `testbed.lease.denied`.
- 락 보유 중 `GET /status`, `GET /events` 는 누구나 200.
- `TESTBED_LEASE_TTL_SEC=1`로 띄우고 락을 잡은 뒤 2초 기다리면 `testbed.lease.expired`, 이후 사람 조작이 200.
- `POST /cores/sample/actions/broadcast {text:'hi'}`(락 보유자) → 200 `{ sent: n }`, `testbed.control.invoked` 남음.
- `PATCH /cores/sample/config {port: 0}` → 200 `result: 'restart-required'`. `{faults:[{id:'f1', error:'x'}]}` → 400 `VALIDATION_ERROR`.
- `POST /runs`를 두 번 → 두 번째 409 `RUN_ACTIVE`. `{endActive:true}` → 201, `GET /runs/<앞 Run>`의 `endReason == 'replaced'`.
- `GET /events?after=<다른 instanceId>:0` → 410 `CURSOR_STALE`.
- `POST /wait {filter:{kind:'sample.data.echoed'}, count:1, timeoutMs:5000}` 대기 중 TCP로 데이터 전송 → 대기가 1건으로 끝남. 시간이 지나면 지금까지의 결과(0건)를 돌려줌.
- `GET /runs/:id/export` → `Content-Type: application/x-ndjson`, 줄마다 이벤트 하나.
- WS 연결 → 첫 메시지 `snapshot`, TCP 데이터 전송 → `event` 증분, 락 획득 → `lease` 증분.
- `TESTBED_CONTROL_TOKEN=x`로 띄우면 Bearer 없는 에이전트·CI 호출 → 401 `UNAUTHORIZED`, `Authorization: Bearer x` → 정상.
- `bun run testbed:release` → 락 해제, `testbed.lease.released`(`reason: 'forced'`).
- `bun run check` 통과.

### P2·P3 공통 규칙

- P2(M5–M6)와 P3(M7–M10)는 P1이 만든 제어 서비스(`src/server/testbed/control/service.ts`)를 부르는 어댑터와 화면만 추가합니다. **제어 서비스에 없는 동작이 필요하면 먼저 제어 서비스 함수로 추가**하고, 그 함수를 REST·MCP·UI가 함께 씁니다.
- 각 마일스톤의 "같은 PR에서 고칠 문서"는 그 마일스톤이 끝났을 때 `docs/testbed/`가 실제 구현과 일치하도록 고치는 목록입니다.

### M5 — P2-a: 제어면 MCP 어댑터

**범위**

- `/testbed/mcp`에 Streamable HTTP MCP 서버를 붙입니다. 붙이는 방법은 2절 "MCP SDK (M1 결과)"를 따르고, `src/server/testbed/mcp/mcp-sdk.integration.test.ts`를 참조 구현으로 씁니다. 응답은 기본 SSE 방식입니다.
- **세션과 caller**
  - 세션마다 전송과 `McpServer`를 하나씩 만듭니다. caller는 `{ actor: 'agent', sessionId: <Mcp-Session-Id>, name: <clientInfo.name> }`입니다.
  - `DELETE`로 세션이 끝나면 `lease.releaseSession(sessionId)`를 부릅니다.
  - 세션 상한 `TESTBED_MCP_MAX_SESSIONS`(기본 32): 넘으면 새 `initialize`를 HTTP 503과 JSON-RPC 오류로 거절합니다. 오류 문장: "MCP 세션이 상한(32)에 도달함. 쓰지 않는 세션을 닫거나(`DELETE`) 잠시 뒤 다시 시도".
  - 유휴 세션 정리 `TESTBED_MCP_SESSION_IDLE_SEC`(기본 3600): 그 시간 동안 요청이 없는 세션은 서버가 닫습니다. 락을 쥔 세션이면 락도 함께 풀립니다(`reason: 'session-closed'`).
- **인증**
  - `TESTBED_CONTROL_TOKEN`이 있으면 모든 MCP 요청에 `Authorization: Bearer <token>`이 필요합니다. 없거나 틀리면 401입니다.
  - 토큰이 없으면(로컬) 인증 없이 받습니다. MCP 호출자는 언제나 `agent`이고, `X-Testbed-Actor`는 보지 않습니다.
- **`initialize`의 `instructions`** (그대로 씀):
  > 테스트베드 제어면입니다. 처음엔 `testbed_info`로 코어·데이터면 주소·락 상태를 봅니다. 시험은 `start_run` → 제품 작업 → `query_events`/`wait_for`/`check` → `end_run` 순서로 합니다. 조작 도구는 첫 호출 때 제어 락을 잡고, 그동안 사람은 대시보드에서 조작할 수 없습니다. 끝나면 `release_control`을 부릅니다.
- **공통 도구**(아래 표)와 코어 액션 도구를 등록합니다. 모든 도구는 제어 서비스 함수를 부르기만 합니다.
- **액션 자동 노출**: `surfaces`에 `mcp`가 있는 액션마다 `<core>_<action>` 도구를 만듭니다. 코어 id의 `-`는 `_`로 바꿉니다. 설명은 액션의 `description`에 "(제어 락 필요)" 또는 "(읽기 전용)"을 덧붙이고, 입력 스키마는 액션의 `input` 검증기를 씁니다.
- **도구 주석**: 읽기 도구는 `annotations.readOnlyHint: true`를 답니다. 조작 도구는 `false`입니다.
- **결과 형식**
  - 성공: `content`에 사람이 읽는 짧은 텍스트(여러 줄 가능), `structuredContent`에 기계용 객체를 담습니다.
  - 실패: 제어 서비스가 던진 `TestbedError`와 검증 오류는 JSON-RPC 오류가 아니라 도구 결과 `isError: true`로 돌려줍니다. `content`에는 오류 문장(다음 행동을 알려 주는 문장)을, `structuredContent`에는 `{ error: { code, message, details } }`를 담습니다. 예상하지 못한 예외만 JSON-RPC 내부 오류로 둡니다.
- **이벤트 한 줄 형식**(`query_events`, `wait_for`, `check`의 `content`): `<id> <HH:MM:SS.mmm> <level> <kind> <summary>`. 시각은 UTC입니다.

**공통 도구의 입력과 출력**

| 도구                       | 입력                                                                                                   | `structuredContent`                                                                                          | 락  |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --- |
| `testbed_info`             | `{}`                                                                                                   | `{ name, version, instanceId, cores:[{id, kind, state, endpoints, actions:[name]}], run, lease }`            | –   |
| `get_config`               | `{ core }`                                                                                             | 설정 객체                                                                                                    | –   |
| `set_config`               | `{ core, patch }`                                                                                      | `{ result: 'applied' \| 'restart-required', config }`                                                        | ●   |
| `start` / `stop` / `reset` | `{ core?: string }` (생략하면 `_all`)                                                                  | `{ cores: CoreStatus[] }`                                                                                    | ●   |
| `start_run`                | `{ label, seed?, configOverrides?, endActive? }`                                                       | `RunMeta`                                                                                                    | ●   |
| `end_run`                  | `{}`                                                                                                   | `RunMeta`(요약 포함)                                                                                         | ●   |
| `query_events`             | 이벤트 필터 전체(`runId`, `core`, `kind`, `level`, `actor`, `correlationId`, `text`, `after`, `limit`) | `{ events: EventLine[], nextCursor, total }` — payload 없음                                                  | –   |
| `get_event`                | `{ id }`                                                                                               | 이벤트 전체                                                                                                  | –   |
| `wait_for`                 | `{ filter, count?: 1, timeoutMs?: 30000 }` (상한 120000)                                               | `{ matched, timedOut, events: EventLine[] }`                                                                 | –   |
| `check`                    | `{ filter, expect, label? }`                                                                           | `{ pass, matched, sample: EventLine[] }`                                                                     | –   |
| `export_run`               | `{ runId?: string }` (생략하면 열린 Run, 없으면 가장 최근에 닫힌 Run)                                  | `{ runId, url, path? }` — `url`은 `TESTBED_PUBLIC_URL` 기준 export 주소, `path`는 file 저장소일 때 파일 경로 | –   |
| `acquire_control`          | `{}`                                                                                                   | `{ expiresAt }`                                                                                              | –   |
| `release_control`          | `{}`                                                                                                   | `{ released }`                                                                                               | –   |

- `EventLine`은 `{ id, ts, level, kind, summary, correlationId? }`입니다.
- `testbed_info`의 `content`는 코어마다 한 줄(`sample running tcp://127.0.0.1:40001 actions: broadcast`)과 열린 Run, 락 보유자를 줄로 씁니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/control-plane.md` §4: 위 표, 결과·오류 형식, 이벤트 한 줄 형식, 세션 상한·유휴 정리, 인증.
- `docs/testbed/architecture.md` §7: `TESTBED_MCP_MAX_SESSIONS`, `TESTBED_MCP_SESSION_IDLE_SEC`.
- `.env.example`: 위 두 변수(주석 포함).

**수용 기준** (`bun test`의 MCP 통합 테스트. SDK 클라이언트로 실제 서버에 붙음)

- `initialize` → `instructions`가 위 문장과 같음. `tools/list`에 공통 도구 15개와 `sample_broadcast`가 있고, 읽기 도구에만 `readOnlyHint: true`.
- `testbed_info` → `structuredContent.cores[0].id == 'sample'`, `endpoints[0].protocol == 'tcp'`.
- `start_run {label:'m5'}` → 락이 이 세션으로 잡힘(`testbed.lease.acquired`, `actor: 'agent'`, `name`이 클라이언트 이름). TCP로 데이터 전송 → `wait_for {filter:{kind:'sample.data.echoed'}}` → `matched: 1`. `check {filter:{kind:'sample.data.echoed'}, expect:{count:'==1'}}` → `pass: true`. `end_run` → 요약에 `sample.data.echoed` 1건.
- 두 번째 세션의 `stop {core:'sample'}` → `isError: true`, `code: 'LEASE_HELD'`, 문장에 보유자와 남은 시간. 두 번째 세션의 `query_events`는 성공.
- 락 보유 중 REST `POST /testbed/api/cores/sample/stop`(사람) → 423.
- 첫 세션 `release_control` → 두 번째 세션의 `stop`이 성공하고 락이 두 번째 세션으로 넘어감.
- 락을 쥔 세션을 `DELETE`로 닫으면 `testbed.lease.released`(`reason: 'session-closed'`).
- `start_run`을 두 번 → 두 번째 `RUN_ACTIVE`, 문장에 `endActive` 안내. `endActive: true` → 성공.
- `query_events {limit: 2}` → 2건과 `nextCursor`. 그 커서로 다시 부르면 이어지는 이벤트. 다른 인스턴스 커서 → `CURSOR_STALE`.
- `get_event {id}` → payload 포함 전체. `query_events` 결과에는 payload가 없음.
- `wait_for {timeoutMs: 200}`(맞는 이벤트 없음) → `timedOut: true`, `matched: 0`. `timeoutMs: 999999` → 120000으로 잘림(검증 오류 아님).
- `export_run` → `url`이 `/testbed/api/runs/<id>/export`로 끝남. `TESTBED_RUN_STORE=file`이면 `path`가 실제 파일을 가리킴.
- `sample_broadcast {text:'hi'}` → `{ sent: n }`. `text: ''` → `isError: true`, `VALIDATION_ERROR`.
- `set_config {core:'sample', patch:{faults:[{id:'f1', error:'x'}]}}` → `isError: true`, `VALIDATION_ERROR`.
- `TESTBED_CONTROL_TOKEN=x` → 토큰 없는 `initialize`는 401, `Authorization: Bearer x`면 성공.
- `TESTBED_MCP_MAX_SESSIONS=1` → 두 번째 `initialize`가 503. `TESTBED_MCP_SESSION_IDLE_SEC=1` → 2초 뒤 그 세션의 호출이 404, 락을 쥐고 있었다면 풀림.
- `bun run check` 통과.

### M6 — P2-b: `bun run testbed:smoke`와 스모크 시나리오

**범위**

- **실행 방식**
  - `bun run testbed:smoke`: 빈 포트로 이 저장소의 서버를 자식 프로세스로 띄우고(`TESTBED_RUN_STORE=memory`, 코어 포트는 모두 `0`), `/api/health/ready`가 200이 되면 시작합니다. 끝나면 서버를 종료합니다.
  - `bun run testbed:smoke --url <base>`: 이미 떠 있는 인스턴스(로컬 또는 Docker 이미지)를 대상으로 합니다. `TESTBED_CONTROL_TOKEN` 환경 변수가 있으면 Bearer로 보냅니다.
  - `--only <이름>`: 시나리오 하나만 실행. `--json <경로>`: 결과를 JSON으로 저장.
  - 종료 코드: 모두 통과(건너뜀 포함) 0, 하나라도 실패 1, 서버를 띄우지 못하거나 연결하지 못함 2.
- **순서**
  1. **공통 점검**(공통 런타임이 제공. 모든 테스트베드에서 같음): 공통 도구 15개를 모두 한 번 이상 부르고, 두 세션 사이의 락 배타성(`LEASE_HELD`), 락 보유 중 사람 REST 조작의 423, `release_control` 뒤 해제를 확인합니다. 끝나면 열린 Run을 닫고 락을 풉니다.
  2. **시나리오**: 아래 위치의 시나리오 파일을 이름순으로 실행합니다. 시나리오마다 새 MCP 세션을 쓰고, 끝나면(실패해도) 열린 Run을 닫고 `release_control` 후 세션을 닫습니다.
  3. **액션 커버리지**: 매니페스트에서 MCP에 노출된 액션이 건너뛰지 않은 시나리오에서 한 번 이상 불렸는지 확인합니다. 안 불린 액션이 있으면 실패입니다.
- **시나리오 파일**
  - 위치: `src/server/testbed/cores/<core id>/smoke/*.smoke.ts`. 테스트베드 레포는 `cores/` 아래에만 추가하므로 공통 런타임을 고치지 않습니다. 여러 코어에 걸친 시나리오는 그 테스트베드의 주 코어 폴더에 둡니다.
  - 형식:

    ```ts
    import { defineSmoke } from '@server/testbed/smoke';

    export default defineSmoke({
      name: 'sample-echo', // 파일 안에서 유일, 결과 보고에 씀
      title: '보낸 바이트가 그대로 돌아오고 이벤트가 남음',
      spec: 'docs/spec.md §11 M3', // 근거가 된 수용 기준
      requires: { cores: ['sample'] }, // 매니페스트에 없으면 건너뜀
      async run(t) {
        await t.call('start_run', { label: 'smoke:sample-echo' });
        const echo = t.tcp(t.endpoint('sample', 'echo'));
        await echo.send('hello');
        t.equal(await echo.receive(5), 'hello');
        await t.expectCheck({ kind: 'sample.data.echoed' }, { count: '==1' });
        await t.call('end_run', {});
      },
    });
    ```

  - 실행 도구 `t`가 주는 것

    | 이름                                              | 하는 일                                                                     |
    | ------------------------------------------------- | --------------------------------------------------------------------------- |
    | `t.call(tool, input)`                             | MCP 도구 호출. `structuredContent`를 돌려줌. `isError`면 시나리오 실패      |
    | `t.callError(tool, input, code)`                  | 오류가 나야 하는 호출. `code`가 다르거나 성공하면 실패                      |
    | `t.newSession()`                                  | 다른 MCP 세션(다른 에이전트 흉내). 같은 `call`·`callError`를 가짐           |
    | `t.rest(method, path, { body?, actor? })`         | REST 호출(사람·CI 흉내). `{ status, body }`를 돌려줌                        |
    | `t.manifest`, `t.endpoint(core, name)`            | 매니페스트와 데이터면 주소                                                  |
    | `t.tcp(url)`                                      | TCP 클라이언트: `send(data)`, `receive(bytes, timeoutMs?)`, `close()`       |
    | `t.expectCheck(filter, expect)`                   | `check` 호출 후 `pass`가 아니면 실패(일치한 이벤트 줄을 실패 메시지에 담음) |
    | `t.waitFor(filter, count?, timeoutMs?)`           | `wait_for` 호출 후 `timedOut`이면 실패                                      |
    | `t.equal(a, b, message?)`, `t.ok(cond, message?)` | 단언                                                                        |

  - 시나리오 하나의 제한 시간은 기본 60초(`timeoutMs`로 바꿈)입니다. 넘으면 실패로 보고 정리 단계로 갑니다.
- **보고**: 시나리오마다 `PASS`/`FAIL`/`SKIP`, 걸린 시간, 실패면 실패한 단계와 메시지를 한 줄씩 씁니다. 마지막에 합계와 커버리지 결과를 씁니다.
- **testbed-base의 시나리오**(샘플 코어, `src/server/testbed/cores/sample/smoke/`)
  - `sample-echo`: 위 예시.
  - `sample-faults`: `set_config`로 `disconnect` 규칙 → 전송하면 연결이 닫힘, `testbed.fault.injected`와 `closed(reason:'fault')` 확인 → `corrupt` 규칙 → 받은 바이트가 XOR `0xFF` → 규칙 비움.
  - `sample-broadcast`: TCP 연결 2개 → `sample_broadcast {text:'hi'}` → 둘 다 `hi` 수신, `sent: 2`.
  - `sample-run-replace`: `start_run` 두 번째 `RUN_ACTIVE` → `endActive: true`로 성공 → 앞 Run의 `endReason == 'replaced'`(REST `GET /runs/:id`).
- **CI**
  - `ci.yml`의 테스트 단계 뒤에 `bun run testbed:smoke`를 추가합니다.
  - 이미지 job: 이미지를 빌드한 뒤 push 전에 컨테이너를 띄우고(포트 블록 전체 `-p 40000-40009:40000-40009`. 스모크가 데이터면 포트에도 붙으므로) `bun run testbed:smoke --url http://localhost:40000`이 통과해야 push합니다.
- `knip.json`의 `entry`에 `src/server/testbed/cores/*/smoke/*.smoke.ts`를 추가합니다(동적으로 불러오므로).

**같은 PR에서 고칠 문서**

- `docs/testbed/verification.md`: MCP 스모크 절을 실제 실행 방식·순서·시나리오 형식·보고·종료 코드로 바꿈.
- `docs/testbed/spec-template.md`: 11절 주석에 "M2부터의 수용 기준은 스모크 시나리오(`cores/<id>/smoke/`)로 옮겨 실행할 수 있게 쓴다"를 넣고, 마일스톤 표의 M2·M4 완료 판정을 `bun run testbed:smoke` 기준으로 고침.
- `docs/testbed/core-contract.md` §2 코드 위치: 스모크 시나리오 위치 추가.

**수용 기준**

- `bun run testbed:smoke` → 공통 점검과 시나리오 4개 `PASS`, 커버리지 통과, 종료 코드 0.
- `sample-echo`의 기대값을 일부러 틀리게 바꾸면(시험용 임시 수정) 해당 시나리오 `FAIL`, 실패 단계와 메시지가 보이고 종료 코드 1, 다른 시나리오는 계속 실행됨. 실패한 시나리오가 연 Run과 락은 정리되어 있음.
- `requires: { cores: ['nope'] }`인 시나리오 → `SKIP`, 종료 코드 0.
- `sample-broadcast`를 빼고 실행 → 커버리지 실패(`sample_broadcast`가 안 불림), 종료 코드 1.
- `bun run dev`로 띄운 인스턴스에 `--url` → 같은 결과. 서버가 없는 주소 → 종료 코드 2.
- `--json out.json` → 시나리오별 결과가 담긴 JSON.
- CI 워크플로에 스모크 단계가 있고, 이미지 job에서 컨테이너 대상 스모크가 push보다 먼저 실행됨.
- `bun run check` 통과.

### M7 — P3-a: 대시보드 데이터 계층, 셸, 상태 바, 연결 패널

**범위**

- **스토어**(`src/client/testbed/store/`): React state 밖에 둡니다.
  - `/testbed/ws`에 연결해 `snapshot`으로 상태·이벤트를 채우고, `event`·`status`·`lease` 증분을 반영합니다.
  - 이벤트는 최근 5000건만 둡니다. `event` 묶음의 `omitted`는 누적해서 보여 줄 수 있게 둡니다.
  - 끊기면 1초부터 2배씩 최대 10초 간격으로 다시 연결합니다. 다시 연결되면 새 `snapshot`으로 통째로 바꿉니다. `instanceId`가 바뀌었으면 "테스트베드가 재시작됨" 알림을 한 번 띄웁니다.
  - 컴포넌트는 `useSyncExternalStore`로 구독하고, 스토어는 스냅샷을 최대 10Hz로 내보냅니다(100ms 묶음).
- **REST 호출**: 보일러플레이트 규칙대로 `src/client/api/endpoints.ts`에 모든 `/testbed/api` 엔드포인트를 적고 `http.ts`로 부릅니다. 대시보드의 호출자는 사람입니다(`X-Testbed-Actor`를 보내지 않음).
- **셸**(`/`): 빈 자리 페이지를 없애고 대시보드 셸로 바꿉니다.
  - 영역: 위 상태 바 / 왼쪽 코어 열(코어 카드, M8) / 가운데 주 영역(탭) / 오른쪽 상세 패널(M9).
  - 주 영역 탭: 이벤트 로그, 통계, Run, 에이전트 타임라인(M9), 그리고 코어가 등록한 고유 패널. 선택한 탭은 주소(`?tab=`)에 남깁니다.
  - 화면 폭 1024px 미만에서는 코어 열과 상세 패널을 보일러플레이트의 오버레이(사이드바·바텀시트)로 엽니다.
- **패널 슬롯**: 테스트베드는 셸을 고치지 않고 `src/client/testbed/cores/<core id>/index.ts`에서 등록합니다. 공통 런타임은 `src/client/testbed/cores/index.ts`에서 목록을 모읍니다(서버의 `cores/index.ts`와 같은 방식).

  ```ts
  interface ClientCoreModule {
    core: string;
    panels?: { id: string; title: MessageKey; component: ComponentType }[]; // 주 영역 탭
    configForm?: ComponentType<ConfigFormProps>; // 설정 전용 폼(M8). 없으면 JSON 편집기
  }
  ```

  고유 패널은 스토어 훅(`useTestbedEvents(filter)`, `useTestbedStatus()`, `useLease()`)과 REST 함수만 씁니다.

- **상태 바**: 이름·버전·`instanceId` 앞 8자, 코어별 상태 점(색과 함께 상태 글자를 `aria-label`로), 열린 Run(label과 경과 시간), 연결 상태(연결됨/다시 연결 중).
- **락 표시**: [testbed/dashboard.md](testbed/dashboard.md) §2. `<html data-lease="none|agent|ci">`, 배너 문구 "<이름 또는 actor>가 제어 중 · 세션 <앞 4자> · 남은 시간 mm:ss"(1초마다 갱신). 모든 조작 컨트롤은 `useCanOperate()` 하나로 비활성 여부를 정하고 `aria-disabled="true"`를 답니다.
- **연결 패널**: 데이터면 주소(복사 버튼), 제어면 MCP URL, `.mcp.json` 조각, 제품 레포 CLAUDE.md 스니펫(아래 틀)의 복사 버튼.
  - 매니페스트에 `publicUrl`(`TESTBED_PUBLIC_URL`)을 추가합니다. 주소는 모두 이 값으로 만듭니다.
  - `.mcp.json` 조각: `{ "mcpServers": { "tb-<name에서 'testbed-' 뺀 것>": { "type": "http", "url": "<publicUrl>/testbed/mcp" } } }`. `auth.control == 'bearer'`면 `"headers": { "Authorization": "Bearer ${TESTBED_CONTROL_TOKEN}" }`를 넣습니다.
  - CLAUDE.md 스니펫 틀: 테스트베드 이름·용도 한 줄, MCP 서버 이름, 기본 흐름(`testbed_info` → `start_run` → 작업 → `check` → `end_run` → `release_control`), 데이터면 주소 목록. 테스트베드마다 덧붙일 문장은 매니페스트에 없으므로 이 단계에서는 틀만 둡니다.
- **로그인**: `AUTH_DRIVER=oidc`인데 로그인하지 않았으면(WS 401) 대시보드 대신 "로그인 필요" 안내와 보일러플레이트의 로그인 컨트롤을 보여 줍니다.
- 문구는 모두 i18n(ko/en)에 둡니다. testid는 아래 "대시보드 testid" 표를 따릅니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/dashboard.md`: 스토어, 영역, 패널 슬롯 인터페이스, 연결 패널 조각 형식.
- `docs/testbed/control-plane.md` §6: 매니페스트의 `publicUrl`.
- `docs/ui-automation.md`: 테스트베드 testid 표.

**수용 기준**

- 스토어 단위 테스트(`bun test`, 가짜 WS): `snapshot` 후 `event` 증분이 순서대로 쌓임 / 5000건 초과 시 오래된 것부터 빠짐 / 끊김 후 다시 연결하면 `snapshot`으로 바뀌고 `instanceId`가 다르면 재시작 알림 / 구독자 알림이 100ms에 한 번 이하.
- 클라이언트 코어 등록 테스트: 가짜 모듈 하나를 등록하면 탭 목록에 그 패널이 나옴.
- `.mcp.json` 조각 생성 함수 테스트: `auth.control`이 `none`일 때와 `bearer`일 때.
- 수동: `bun run dev` → `/`에 상태 바(`sample` running), 연결 패널의 주소가 `TESTBED_PUBLIC_URL` 기준. REST로 락을 잡으면(`X-Testbed-Actor: agent`) 배너가 뜨고 `<html data-lease="agent">`. PR에 라이트·다크 화면 캡처를 붙입니다.
- `bun run check` 통과.

### M8 — P3-b: 코어 카드, 편집 잠김 래퍼, 액션 폼, 결함 규칙 편집기

**범위**

- **코어 카드**(코어 열에 코어마다 하나): 제목·유형·상태, 카운터(`status().counters`), start/stop/reset 버튼, 설정 편집, 액션, 결함 규칙. 접었다 펼 수 있습니다.
- **편집 잠김 래퍼**(`LockAwareEditor`): 설정 편집기·액션 폼·결함 규칙 편집기가 모두 이 래퍼를 씁니다. 코어 전용 폼도 같습니다.
  - 편집을 시작한 시점의 서버 값을 기억합니다.
  - 락이 걸리면 입력을 지우지 않고 읽기 전용으로 바꾸고, "<보유자>가 제어를 시작해 저장할 수 없음 · 입력 복사" 안내를 띄웁니다. 복사는 클립보드에 입력 그대로를 넣습니다.
  - 저장이 `423 LOCKED`로 거절돼도 같은 안내를 띄우고 입력을 보존합니다.
  - 락이 풀렸을 때 서버 값이 편집 시작 시점과 다르면 "서버 값이 바뀜 · 다시 불러오기 / 내 입력 유지"를 고르게 합니다. 같으면 바로 편집을 이어 갑니다.
- **설정 편집**: 코어가 `configForm`을 등록하지 않았으면 JSON 편집기(TextArea, 들여쓰기 2칸)를 씁니다. 저장은 `PATCH /cores/:core/config`이고, `VALIDATION_ERROR`의 `details`를 필드 경로와 함께 편집기 아래에 보여 줍니다. 결과가 `restart-required`면 "재시작해야 적용됨 · 지금 재시작" 안내와 버튼(stop → start)을 띄웁니다.
- **액션 폼**: `surfaces`에 `ui`가 있는 액션마다 버튼 하나. 누르면 `inputSchema`로 만든 폼을 엽니다.
  - 지원하는 스키마: `string`(minLength·maxLength·enum), `number`·`integer`(minimum·maximum), `boolean`, 이 셋으로 된 1단계 `object`. 그 밖의 스키마는 JSON 편집기로 대신합니다.
  - 실행 결과(출력 JSON 또는 오류 문장)를 폼 아래에 보여 줍니다. `mutating: false` 액션은 락이 걸려도 실행할 수 있습니다.
- **결함 규칙 편집기**: 코어 설정의 `faults`를 표로 편집합니다. 열: id, match(키=값 목록), probability, delayMs(고정 또는 min–max), 효과(매니페스트의 `faults`에 있는 종류만 고를 수 있음), times. 행 추가·삭제·순서 바꾸기. 저장은 설정 패치(`{ faults: [...] }`)입니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/dashboard.md` §1 코어 카드, §2.1 편집 잠김(래퍼 이름과 동작), 액션 폼이 지원하는 스키마.

**수용 기준**

- 단위 테스트: 스키마 → 폼 필드 변환(지원 타입마다, 미지원 스키마는 JSON 편집기로) / `LockAwareEditor` 상태 전이(편집 중 잠김 → 입력 보존·읽기 전용 → 해제 시 서버 값 같음: 바로 편집 / 다름: 선택 표시 → "다시 불러오기"는 서버 값으로, "내 입력 유지"는 입력 유지) / 결함 규칙 표 ↔ `FaultRule[]` 왕복 변환.
- 수동: 샘플 코어 카드에서 `maxConnections` 변경 저장 → `applied`, `port` 변경 → 재시작 안내. `broadcast` 폼 실행 → `{ sent: n }` 표시. `disconnect` 규칙 추가 저장 → TCP 전송 시 연결이 닫힘.
- `bun run check` 통과.

### M9 — P3-c: 이벤트 로그, 상세 패널, 통계, Run 패널, 에이전트 타임라인

**범위**

- **이벤트 로그**(탭)
  - 가상 스크롤(행 높이 고정, 보이는 행 + 위아래 20행만 그림). 한 행: 시각(로컬 시간 `HH:MM:SS.mmm`), level, actor, kind, summary.
  - 필터: core, kind 접두사, level 이상, actor, Run(현재 / 특정 Run / 전체), summary 검색. 필터는 주소에 남깁니다.
  - 맨 아래에 있으면 새 이벤트를 따라가고, 위로 스크롤하면 따라가기를 멈추고 "새 이벤트 n건 · 맨 아래로" 버튼을 띄웁니다.
  - 생략 건수(`omitted` 누적)를 로그 위에 표시합니다.
  - 지난 Run을 고르면 스토어 대신 REST(`GET /events?runId=…`, 커서로 이어 받기)로 가져옵니다.
- **상세 패널**(오른쪽): 행을 고르면 `GET /events/:id`로 전체를 가져와 봉투 필드와 payload JSON 뷰어(접기·펴기, 경로 복사)를 보여 줍니다. 가린 값(`…(len n, sha256:…)` 형식)은 따로 강조하고 "가린 값" 표시를 붙입니다. `correlationId`가 있으면 같은 묶음의 이벤트 목록(REST로 조회)을 아래에 보여 주고, 누르면 그 이벤트로 이동합니다.
- **통계**(탭): 대상은 현재 Run의 이벤트(없으면 스토어 전체). kind별 건수, level별 건수, 오류율(`error` 건수 / 전체), `latencyMs`가 있는 kind의 평균·p95·최대. 초당 이벤트 수 스파크라인(최근 60초)은 `<canvas>`에 `requestAnimationFrame`으로 직접 그립니다.
- **Run**(탭): 열린 Run(label, 시작 시각, 연 주체, 경과 시간)과 시작·종료 버튼(시작 폼: label, seed, `endActive` 체크), 지난 Run 목록(`GET /runs`), 고르면 요약(기간, kind·level별 건수, 오류 상위, check 결과)과 내보내기 링크. `openedBy`와 `endedBy`가 다르면 "다른 주체가 닫음", `endReason`이 `replaced`·`restart`면 그 사유를 표시합니다.
- **에이전트 타임라인**(탭): actor가 `agent`인 이벤트와 `testbed.control.*`, `testbed.lease.*`만 시간순으로 보여 줍니다. 각 항목에 caller 이름과 세션 앞 4자를 붙입니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/dashboard.md` §1 표의 각 컴포넌트 설명을 실제 동작으로 갱신.

**수용 기준**

- 단위 테스트: 가상 스크롤 범위 계산 / 필터 ↔ 주소 왕복 / 따라가기 멈춤 조건 / 통계 계산(p95를 포함해 고정 입력에 대한 기대값) / 가린 값 감지 / 에이전트 타임라인 필터.
- 성능: 스토어에 초당 2000건을 10초 동안 넣는 테스트(`bun test`, DOM 없이 스토어와 행 계산만)에서 스냅샷 알림이 초당 10회 이하이고, 보이는 행 계산이 한 번에 5ms 이하.
- 수동: TCP 데이터 → 로그에 행 추가, 누르면 상세에 payload, 같은 `connId` 묶음 표시. Run 시작 → 상태 바와 Run 탭에 표시, 종료 → 목록에 요약.
- `bun run check` 통과.

### M10 — P3-d: Playwright UI 자동화

**범위**

- `@playwright/test`를 개발 의존성에 추가하고, 시험은 `e2e/`에 둡니다(`bun test` 대상이 아님). Chromium만 씁니다.
- `bun run test:ui`: 빈 포트로 서버를 띄우고(`TESTBED_RUN_STORE=memory`, 코어 포트 `0`) 시험을 돌린 뒤 종료합니다. 서버를 띄우는 코드는 M6의 스모크와 같은 모듈을 씁니다.
- 시험에서 데이터면·락 조작은 REST와 TCP로 직접 합니다(제품·에이전트 흉내). 선택자는 ARIA 우선, 그다음 `TESTID`([ui-automation.md](ui-automation.md)).
- CI: `ci.yml`에 `bunx playwright install --with-deps chromium`과 `bun run test:ui` 단계를 추가합니다. 실패하면 Playwright 보고서를 아티팩트로 올립니다.
- `knip.json`과 `tsconfig.json`의 `include`에 `e2e`를 추가합니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/verification.md`: UI 자동화 실행 방법과 위치.
- `docs/testbed/spec-template.md`: M3 완료 판정을 `bun run test:ui` 기준으로.

**수용 기준** (`bun run test:ui`의 시험들)

1. **기본 표시**: `/` → 상태 바에 `sample` 상태 `running`, 연결 패널에 TCP 주소.
2. **이벤트 흐름**: TCP로 `hello` 전송 → 이벤트 로그에 `sample.data.echoed` 행 → 누르면 상세 패널에 payload의 `bytes: 5`.
3. **Run**: Run 탭에서 label 입력 후 시작 → 상태 바에 Run 표시 → TCP 전송 → 종료 → 지난 Run 목록에 그 Run, 요약에 `sample.data.echoed` 1건.
4. **락**: 설정 편집기에 입력 중 REST로 락 획득(`X-Testbed-Actor: agent`) → `<html data-lease="agent">`, 배너 표시, start/stop/reset·저장·액션 버튼이 `aria-disabled="true"`, 입력이 그대로이고 읽기 전용. 락 보유자가 REST로 같은 설정을 바꾼 뒤 해제 → "서버 값이 바뀜" 선택이 뜸 → "내 입력 유지" → 입력 유지, 저장 성공.
5. **잠김 중 저장**: 편집 → 저장 직전에 락 획득 → 저장 → 423 안내, 입력 보존.
6. **액션**: `broadcast` 폼에 `hi` → 실행 → 연결해 둔 TCP 클라이언트가 `hi` 수신, 결과 `{ sent: 1 }` 표시.
7. **결함 규칙**: `disconnect` 규칙 추가 → 저장 → TCP 전송 시 연결이 닫히고 로그에 `testbed.fault.injected`.
8. **에이전트 타임라인**: REST로 락 획득·해제(agent) → 타임라인에 `testbed.lease.acquired`·`released`.

- `bun run check`와 `bun run test:ui` 통과.

### 대시보드 testid (M7–M10)

공통 컴포넌트는 `TESTID.testbed.*`입니다. 아래는 시험이 기대는 최소 목록이며, 더 필요하면 같은 규칙(`testbed.<영역>.<요소>`)으로 추가합니다.

| testid                                                                    | 요소                  |
| ------------------------------------------------------------------------- | --------------------- |
| `testbed.status-bar`                                                      | 상태 바               |
| `testbed.status-bar.core(id)`                                             | 코어 상태 점          |
| `testbed.status-bar.run`                                                  | 열린 Run 표시         |
| `testbed.lease-banner`                                                    | 락 배너               |
| `testbed.connection.endpoint(core, name)`                                 | 데이터면 주소         |
| `testbed.connection.copy-mcp-json`                                        | `.mcp.json` 조각 복사 |
| `testbed.tabs.tab(id)`                                                    | 주 영역 탭            |
| `testbed.core-card(id)`                                                   | 코어 카드             |
| `testbed.core-card.start(id)` / `.stop(id)` / `.reset(id)`                | 코어 조작 버튼        |
| `testbed.config-editor(id)` / `.save(id)`                                 | 설정 편집기와 저장    |
| `testbed.editor.locked-notice`                                            | 편집 중 잠김 안내     |
| `testbed.editor.server-changed`                                           | "서버 값이 바뀜" 선택 |
| `testbed.action(core, name)` / `.run(core, name)` / `.result(core, name)` | 액션 버튼·실행·결과   |
| `testbed.faults(id)` / `.add(id)` / `.save(id)`                           | 결함 규칙 편집기      |
| `testbed.event-log` / `.row(eventId)` / `.jump-latest`                    | 이벤트 로그           |
| `testbed.detail` / `.payload`                                             | 상세 패널             |
| `testbed.runs.start` / `.end` / `.item(runId)` / `.summary`               | Run 탭                |
| `testbed.agent-timeline` / `.item(eventId)`                               | 에이전트 타임라인     |

### P4 공통 규칙

- 프로토콜, 감시, 복제, 재현성의 원본은 [testbed/external-core-protocol.md](testbed/external-core-protocol.md)입니다. 이 절은 그 규약을 구현하는 순서와 수용 기준을 정합니다.
- 외부 코어도 제어 서비스에서는 in-proc 코어와 똑같이 보입니다. REST·MCP·대시보드는 외부 코어를 위해 따로 분기하지 않습니다. 복제 지정(`replica`)과 프로세스 정보만 추가로 다룹니다.
- 시험용 외부 코어는 두 가지입니다.
  - **가짜 코어**(M11–M12): `bun`으로 실행하는 TypeScript 스크립트. 환경 변수 `FAKE_MODE`로 일부러 잘못 동작합니다(아래 표). 공통 런타임 시험 전용이며 Python이 없어도 돕니다.
  - **py-echo**(M13–M14): Python 참조 구현의 예제 코어.

  | `FAKE_MODE`         | 동작                                                    |
  | ------------------- | ------------------------------------------------------- |
  | `normal`            | 규약대로 동작. 액션 `echo {text}` → `{ text, replica }` |
  | `crash-after-start` | `start`에 응답한 뒤 종료 코드 3으로 끝남                |
  | `hang-status`       | `status`에 응답하지 않음                                |
  | `bad-stdout`        | 프로토콜이 아닌 줄과 1 MiB를 넘는 줄을 stdout에 씀      |
  | `wrong-kind`        | `initialize`에서 선언과 다른 `kind`를 돌려줌            |
  | `reserved-field`    | 설정 스키마에 `replicas` 필드를 둠                      |
  | `slow-action`       | 액션 응답을 `requestTimeoutMs`보다 늦게 줌              |
  | `ignore-shutdown`   | `shutdown`에 응답하고도 끝나지 않음(SIGTERM도 무시)     |
  | `print-env`         | 받은 환경 변수 이름 목록을 `event` payload로 보냄       |

### M11 — P4-a: 외부 코어 기반(복제 1개)

**범위**

- `defineExternalCore`(protocol §2)와 코어 호스트 연결. 외부 코어는 부팅 때 프로세스를 띄워 `initialize` → 설정 검증 → `applyConfig` → `autoStart`면 `start`.
- JSON Schema → 검증기 변환을 `@shared/validation` 파사드에 추가합니다(`fromJsonSchema`). zod의 기능으로 되면 그것을 쓰고, 안 되면 검증 라이브러리 하나를 추가합니다. 어느 쪽인지 2절에 기록합니다.
- stdio 전송: NDJSON, 한 줄 1 MiB, stdout·stderr 처리, stderr 최근 50줄 보관.
- 요청 전부(`initialize` … `shutdown`)와 알림 전부(`event`, `fault`, `state`, `log`)의 처리.
- 오류 변환(`CORE_ERROR` 502, `CORE_TIMEOUT` 504), `requestTimeoutMs`.
- 환경 변수 전달 규칙(넘기는 것만 넘김).
- 서버 종료 흐름: `stop` → `shutdown` → `shutdownGraceMs` 뒤 SIGTERM → SIGKILL.
- `testbed.core.process.spawned` 이벤트.
- `initialize`가 실패한 코어도 매니페스트에는 나옵니다(선언의 `id`·`kind`·`title`, `state: 'error'`, `detail`에 이유, 액션 없음). `start`를 부르면 프로세스를 다시 띄워 시도합니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/control-plane.md` §3 오류 코드 표: `CORE_ERROR`, `CORE_TIMEOUT`.
- `docs/testbed/events.md` §2.1 예약 kind 표: `testbed.core.process.*`.
- `docs/testbed/core-contract.md`: 외부 코어 선언으로 가는 안내 한 줄.

**수용 기준** (모두 `bun test`, 가짜 코어 사용)

- `normal`: 부팅 후 상태 `running`, `testbed.core.process.spawned`(pid). 매니페스트의 `configSchema`·`actions`가 `initialize` 응답과 같음. `echo {text:'hi'}` → `{ text: 'hi', replica: 'r0' }`. 가짜 코어가 보낸 `event`가 `core`·`replica: 'r0'`가 채워진 봉투로 남음. `fault` 알림 → `testbed.fault.injected`.
- 설정 패치가 `initialize`의 스키마로 검증됨(범위 밖 값 → `VALIDATION_ERROR`).
- `stop` → 상태 `stopped`, 프로세스는 살아 있음(pid 같음). `start` → 다시 `running`, 같은 pid.
- Run을 열고 닫을 때마다 가짜 코어가 `runChanged`를 받고, `seed`가 `<Run seed>:r0`.
- `wrong-kind`·`reserved-field` → 그 코어는 `error`, `detail`에 이유, 다른 코어(`sample`)는 정상.
- `bad-stdout` → 두 줄 모두 버려지고 `warn` 로그, 코어는 계속 `running`.
- `slow-action` → 액션 호출이 `CORE_TIMEOUT`(504), 코어는 계속 `running`.
- 가짜 코어가 `error.data.code: 'OOPS'`로 실패 → `CORE_ERROR`(502), `details.coreCode: 'OOPS'`. `code: 'VALIDATION_ERROR'`면 400 그대로.
- `print-env` → 받은 변수에 `PATH`와 `FAKE_*`가 있고 `TESTBED_CONTROL_TOKEN`이 없음(시험에서 값을 설정해 둔 상태).
- 존재하지 않는 명령 → `error`, `detail`에 `ENOENT`. 매니페스트에 그 코어가 나옴.
- 서버 종료 → 가짜 코어 프로세스가 남지 않음. `ignore-shutdown`이어도 `shutdownGraceMs`×2 안에 SIGKILL로 끝남.
- `bun run check` 통과.

### M12 — P4-b: 감시, 재시작, 복제

**범위**

- 감시 전부(protocol §8): 응답 확인과 `unresponsive`, 비정상 종료와 `exited`(stderr 마지막 20줄), 재시작 백오프, 60초 안정 후 횟수 초기화, `maxRestarts`, `restart: 'never'`, `start`로 다시 띄우기.
- 복제(protocol §6): `replicas` N개, 복제별 seed, 전체 상태·카운터·엔드포인트(`replica` 표시) 합치기, 복제 수 변경은 `restart-required`이고 다음 `stop` → `start`에서 늘리거나 줄임.
- 액션 복제 지정: 제어 서비스 `invokeAction`이 `replica`를 받습니다. REST는 `POST /cores/:core/actions/:name?replica=r1`, MCP는 외부 코어의 액션 도구 입력에 선택 속성 `replica`(문자열)를 덧붙입니다. 모두 보낼 때의 결과 모양은 protocol §6.
- 공유 타입: `CoreStatus`에 `external?: true`와 `replicas?: ReplicaStatus[]`(`{ id, state, detail?, pid?, restarts, lastPingMs?, counters, endpoints }`), `CoreEndpoint`에 `replica?`. 매니페스트의 `replicas`는 설정값, 코어마다 `external` 표시.
- 재시작 백오프의 시작 간격과 안정 시간(60초)은 시험에서 줄일 수 있게 코어 호스트 옵션으로 받습니다. 설정 필드로는 노출하지 않습니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/control-plane.md`: `invokeAction`의 `replica`, REST `?replica`, MCP 액션 도구의 `replica` 속성, 매니페스트의 `external`·`replicas`.
- `docs/testbed/core-contract.md` §3: `CoreStatus.replicas`.

**수용 기준** (모두 `bun test`, 가짜 코어 사용. 시험용으로 `pingIntervalMs: 1000`, `pingTimeoutMs: 200`, 백오프 시작 100ms, 안정 시간 1초)

- `hang-status` → 약 3초 안에 `unresponsive` → `exited` → `restarting`(시도 1, 대기 100ms) → 다시 띄움. `maxRestarts: 2`면 세 번째 실패 후 `error`, `detail: 'restart limit reached'`, 더 띄우지 않음. 그 뒤 `start` → 횟수 0으로 다시 띄움.
- `crash-after-start` → `exited`(종료 코드 3, stderr 마지막 줄 포함) → 재시작 후 다시 `running`이 되었다가 다시 끝남. 백오프 대기가 100 → 200 → 400ms로 늘어남.
- `normal`로 띄운 프로세스를 시험이 직접 kill → 재시작되고, 종료 전 `running`이었으므로 `start`까지 되어 `running`. 1초 안정 후 재시작 횟수가 0.
- `restart: 'never'` + `crash-after-start` → `error`로 남고 다시 띄우지 않음.
- `replicas: 3` → pid가 다른 프로세스 3개, `replicaId` `r0`–`r2`, seed가 `<seed>:r0`…`<seed>:r2`. `status`의 전체 카운터가 복제 합. 하나를 kill하면 그동안 전체 상태가 `running`이 아님(재시작 중 상태), 돌아오면 `running`.
- `echo {text:'a'}`(복제 지정 없음, 3개) → `{ r0: {...}, r1: {...}, r2: {...} }`. `?replica=r1`(REST)·`replica: 'r1'`(MCP) → r1의 출력만. `replica: 'r9'` → `VALIDATION_ERROR`. 복제 하나가 `slow-action`이면 그 자리만 `{ error: { code: 'CORE_TIMEOUT' } }`, 전체는 성공.
- `replicas`를 3 → 1로 패치 → `restart-required`. `stop` → `start` 후 프로세스 1개(r1·r2는 `shutdown`으로 끝남).
- `bun run check` 통과.

### M13 — P4-c: Python 참조 구현과 py-echo

**범위**

- **어댑터** `examples/python-core/testbed_core/`(Python 3.11 이상, 표준 라이브러리만, `asyncio`):
  - stdio NDJSON JSON-RPC 처리, 요청 메서드 전부, 알림 보내기(`emit`, `fault`, `state`, `log`).
  - 코어 작성 틀: 코어가 `kind`, `title`, 설정 스키마(JSON Schema), `default_config(env)`, `faults`, 액션(이름·설명·입출력 스키마·`mutating`·처리 함수), `start`/`stop`/`reset`/`apply_config`/`status`를 정의하면 나머지를 어댑터가 합니다. 공통 필드(`autoStart`, `eventLevel`, `faults`)는 어댑터가 스키마에 넣습니다.
  - `SeededRng`과 `FaultDecider`를 protocol §9 그대로 구현합니다.
  - 처리하지 못한 예외는 JSON-RPC 오류(`data.code: 'INTERNAL'`)로 돌려주고 stderr에 traceback을 씁니다. 프로세스는 끝내지 않습니다.
- **py-echo** `examples/python-core/echo_core.py`와 선언 `examples/python-core/index.ts`(`defineExternalCore`):
  - `passive`. 샘플 코어의 TCP echo와 같은 동작을 줄인 것입니다: 받은 조각을 그대로 돌려보냄, `maxChunkBytes` 초과 시 닫음, 결함 `delay`·`disconnect`·`corrupt`(XOR `0xFF`), 액션 `broadcast {text}` → `{ sent }`.
  - 포트: `port`(env `PY_ECHO_PORT`, 기본 `40002`) + `replicaIndex`. `port`가 `0`이면 모든 복제가 임의 포트. 엔드포인트 이름은 `echo`.
  - 호스트: 외부 코어에는 `TESTBED_BIND_HOST`가 전달되지 않으므로(protocol §2) 바인딩 주소는 `PY_ECHO_BIND_HOST`(기본 `127.0.0.1`, 컨테이너에서는 `0.0.0.0`), 엔드포인트 주소의 호스트는 `PY_ECHO_PUBLIC_HOST`(기본 `localhost`)로 받습니다.
  - 이벤트: `py-echo.connection.opened`, `py-echo.data.echoed`(`latencyMs` 포함), `py-echo.connection.closed`, `py-echo.broadcast.sent`. summary 형식은 샘플 코어(6절)와 같습니다.
  - 설정: `port`(0–65535), `maxChunkBytes`(1–1048576, 기본 65536), 공통 필드. `port` 변경은 `restart-required`.
- **켜는 방법**: 공통 환경 변수 `TESTBED_EXAMPLE_CORES`(쉼표 목록, 기본 빈 값)에 `py-echo`를 넣으면 코어 호스트가 등록합니다. 예제 코어 목록은 공통 런타임이 `examples/`에서 모읍니다. 기본 이미지와 기본 실행에는 들어가지 않습니다.
- **스모크**: 러너가 `examples/*/smoke/*.smoke.ts`도 읽습니다. `examples/python-core/smoke/py-echo.smoke.ts`(`requires: { cores: ['py-echo'] }`): 각 복제 엔드포인트에 echo → `py-echo.data.echoed`가 복제 수만큼(`replica`별 1건) → `py_echo_broadcast` → 결함 `disconnect` 한 번.
- **시험 환경**
  - Python 시험: `examples/python-core/tests/`(`unittest`), `bun run test:python`으로 실행.
  - Bun 통합 시험 중 Python이 필요한 것은 `python3`(3.11 이상)이 없으면 건너뛰고 이유를 출력합니다. `TESTBED_REQUIRE_PYTHON=1`이면 건너뛰지 않고 실패합니다.
  - CI: `actions/setup-python`(3.11) → `bun run test:python` → `TESTBED_REQUIRE_PYTHON=1 bun test` → 기존 스모크에 더해 `TESTBED_EXAMPLE_CORES=py-echo PY_ECHO_REPLICAS=2 bun run testbed:smoke`.
- `tsconfig.json`의 `include`와 `knip.json`의 `entry`·`project`에 `examples/**/*.ts`를 추가합니다.
- `examples/python-core/README.md`: Python으로 외부 코어를 만드는 법(파일 구성, 코어 작성 틀, 선언, 켜는 법, 시험), 테스트베드 이미지에 Python을 넣는 Dockerfile 예시(런타임 단계에 `python3` 설치와 `examples/` 복사).

**같은 PR에서 고칠 문서**

- `docs/testbed/architecture.md` §7: `TESTBED_EXAMPLE_CORES`.
- `docs/testbed/verification.md`: Python 시험과 `TESTBED_REQUIRE_PYTHON`, 예제 코어 스모크.
- `docs/testbed/external-core-protocol.md` §10: 어댑터 사용법 요약과 README 링크.

**수용 기준**

- `bun run test:python` 통과: 어댑터의 메시지 처리, 예외 → `INTERNAL` 오류, 결함 판정, py-echo 단위 동작.
- **언어 간 재현성** (`bun test`, Python 필요): seed 5개(빈 문자열, ASCII, 한글 포함, 64자, `abc:r1`)마다 Bun `SeededRng`과 Python 구현의 처음 1000개 `next()`와 `int(0, 999)` 결과가 같음. 같은 규칙·selector 순서 100개에서 Bun `FaultDecider`와 Python 결정 순서(규칙 id, `delayMs`)가 같음(`probability`·`times`·`delayMs` 범위를 섞은 규칙으로).
- `TESTBED_EXAMPLE_CORES=py-echo PY_ECHO_PORT=0 PY_ECHO_REPLICAS=2`로 띄운 통합 시험: 복제 2개 `running`, 엔드포인트 2개(`replica` 표시). 각 엔드포인트로 보낸 바이트가 그대로 돌아옴. 이벤트에 `replica` `r0`·`r1`. `disconnect` 규칙 → 연결이 닫히고 `testbed.fault.injected`. `py-echo` 프로세스를 kill → 재시작되어 다시 echo 됨.
- 같은 Run seed로 `probability: 0.5` 규칙을 둔 채 py-echo에 같은 순서로 20번 보내기를 두 번 하면 두 번의 결함 적용 순서가 같음.
- `TESTBED_EXAMPLE_CORES`가 비어 있으면 매니페스트에 `py-echo`가 없고 py-echo 스모크는 `SKIP`.
- CI 워크플로에 Python 단계와 예제 코어 스모크가 있음.
- `bun run check` 통과.

### M14 — P4-d: 표면 반영(MCP, REST, 대시보드)

**범위**

- **이벤트 필터 `replica`**: 제어 서비스 필터에 추가하고 REST `GET /events?replica=`, MCP `query_events`·`wait_for`·`check`, 대시보드 이벤트 로그 필터에 반영합니다.
- **코어 로그**: 제어 서비스 `getCoreLog(core, replica?)` → 복제마다 stderr 최근 50줄(가림 적용). REST `GET /testbed/api/cores/:core/log?replica=`, MCP 공통 도구 `get_core_log {core, replica?}`(읽기 전용). in-proc 코어는 빈 목록과 "in-proc 코어는 프로세스 로그가 없음" 문장을 돌려줍니다.
- **`testbed_info`**: 외부 코어 줄에 복제 수와 복제별 상태를 덧붙입니다(`py-echo running x2 (r0 running pid 123, r1 running pid 124)`).
- **대시보드**
  - 코어 카드: 외부 코어면 "외부 프로세스" 표시와 복제 표(id, 상태, pid, 재시작 횟수, 마지막 응답 ms, 엔드포인트). 행을 펼치면 stderr 최근 50줄(`get_core_log`와 같은 REST).
  - 액션 폼: 외부 코어면 대상 선택(전체 / r0 / r1 …). 결과가 복제별이면 복제별로 나눠 보여 줌.
  - 이벤트 로그: `replica` 열(값이 있을 때만)과 필터.
  - 상태 바의 코어 점은 전체 상태를 쓰고, `aria-label`에 복제 수를 덧붙임.
- **testid**: `testbed.core-card.replicas(id)`, `testbed.core-card.replica(id, replicaId)`, `testbed.core-card.replica-log(id, replicaId)`, `testbed.action.target(core, name)`, `testbed.event-log.filter.replica`.
- **UI 자동화 9번**(Python 필요, CI에서는 필수): `TESTBED_EXAMPLE_CORES=py-echo PY_ECHO_REPLICAS=2`로 띄운 대시보드 → 코어 카드에 복제 2행 `running` → 시험이 r1 프로세스를 kill → r1 행이 `running`이 아닌 상태를 거쳐 다시 `running`, 재시작 횟수 1 → r1 행을 펼치면 로그가 보임 → 액션 폼 대상 `r0`로 `broadcast` → 결과에 r0만.
- `bun run test:ui`는 Python이 없으면 9번을 건너뛰고, `TESTBED_REQUIRE_PYTHON=1`이면 실패합니다. CI의 UI 자동화 단계는 `TESTBED_REQUIRE_PYTHON=1`로 돌립니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/control-plane.md`: 필터 `replica`, `getCoreLog`, REST 경로, 공통 도구 16개 표.
- `docs/testbed/dashboard.md`: 코어 카드의 복제 표와 로그, 액션 대상 선택.
- `docs/ui-automation.md`: 위 testid.
- `docs/testbed/verification.md`: 공통 점검이 부르는 도구 수(16개).

**수용 기준**

- MCP 통합 시험: `tools/list`에 공통 도구 16개. `get_core_log {core:'sample'}` → 빈 목록과 안내 문장. 가짜 코어에서 stderr에 쓴 줄이 `get_core_log`에 나오고, 비밀값 형태(`Authorization: Bearer …`)는 가려짐. `query_events {replica:'r1'}` → r1 이벤트만.
- REST 통합 시험: `GET /events?replica=r0`, `GET /cores/:core/log?replica=r0`.
- 스모크 공통 점검이 16개 도구를 모두 부름(`bun run testbed:smoke` 통과).
- `bun run test:ui` 1–9번 통과(CI에서 9번 포함).
- `bun run check` 통과.

### P6 공통 규칙

- 원본은 [testbed/dashboard.md](testbed/dashboard.md)(프레임, 배치, 공통 위젯)와 [testbed/ui-design.md](testbed/ui-design.md)(M20에서 씀)입니다. 이 절은 그 규약을 구현하는 순서와 수용 기준을 정합니다.
- **기본 배치의 화면은 바뀌지 않습니다.** M16–M19는 구조만 바꿉니다. 사람이 보는 화면, 문구, testid, 주소(`?tab=`, 이벤트 로그 필터)는 그대로입니다. 새로 생기는 것은 `<html data-layout>`, 조작 컨트롤의 `data-operate`, 공개 위젯 입구, 코어 상태의 주기적 갱신과 `summary` 표시입니다.
- 시험 파일을 옮기거나 다시 써도 시험하는 동작은 줄지 않습니다. 옮긴 PR에는 옛 시험 → 새 위치 대응표를 붙입니다.
- **테스트베드 소유 파일**: 아래 파일은 이 저장소가 처음 만든 뒤 다시 고치지 않습니다. 다운스트림이 자기 것으로 바꾸므로, 고치면 머지마다 충돌합니다. 꼭 바꿔야 하면 업그레이드 가이드로 알립니다.

  | 파일                                     | 내용                                                                                  | 만드는 곳 |
  | ---------------------------------------- | ------------------------------------------------------------------------------------- | --------- |
  | `src/server/testbed/cores/port-block.ts` | 이 테스트베드 포트 블록의 +0(`PORT_BLOCK`). 기본 `40000`                              | M15       |
  | `e2e/testbed.ts`                         | UI 시험·캡처 서버의 env와 사전 준비. 기본은 빈 설정                                   | M15       |
  | `src/client/testbed/cores/layout.tsx`    | 이 테스트베드의 배치 모듈. 기본은 `defaultLayout`                                     | M16       |
  | `src/client/testbed/cores/layout.css`    | 배치와 고유 화면의 스타일. 기본은 주석만                                              | M17       |
  | `e2e/layout/adapter.ts`                  | 계약 시험이 이 배치에서 기능을 찾아가는 방법. 기본은 기본 배치용 어댑터를 다시 내보냄 | M19       |
  | `e2e/scenes/`                            | 장면 시험. 기본은 비어 있음(`README.md`만)                                            | M19       |

  `src/client/testbed/cores/index.ts`(`CLIENT_CORES`)와 서버 `cores/index.ts`(`CORES`)는 지금처럼 다운스트림이 목록만 고칩니다. `Dockerfile`과 `.env.example`의 포트 값도 테스트베드가 고치는 곳입니다(`PORT_BLOCK`과 맞춤).

- 공통 런타임을 바꾸는 PR은 [testbed/](testbed/README.md)의 해당 문서를 같은 PR에서 고칩니다.
- **첫 테스트베드와 맞추기**: `slack-agent-org-dash`는 PR #2·#3에서 공통 시험을 최소한으로 고쳐 두었습니다(이슈 #19의 1–3). M15 구현자는 그 diff를 먼저 보고, 같은 목적이면 **같은 형태**로 받습니다. 그래야 그 레포가 머지할 때 충돌이 없습니다. 형태가 이 절과 다르면 그 형태를 따르고 2절에 적습니다.

### M15 — P6-a: 공통 시험 정리와 샘플 코어 분리

목표: 테스트베드 레포를 안내 문서대로 준비하기만 해도(이름·포트·코어 목록을 바꿔도) `bun run check`와 `bun run test:ui`가 깨지지 않게 합니다. 첫 테스트베드의 CI를 가장 먼저 풀기 위해 P6의 맨 앞에 둡니다.

**범위**

- **샘플 코어 이동**: `src/server/testbed/cores/sample/` → `src/server/testbed/testing/sample-core/`. 샘플 코어의 스모크 시나리오(`smoke/*.smoke.ts`)도 함께 옮기고, 스모크 러너가 `src/server/testbed/testing/*/smoke/*.smoke.ts`도 읽게 합니다(`requires: { cores: ['sample'] }`이므로 등록하지 않은 테스트베드에서는 `SKIP`).
  - 서버 `cores/index.ts`는 `import { sampleCore } from '../testing/sample-core';`로 바꾸고 주석에 "테스트베드는 이 줄을 빼고 자기 코어를 넣음"을 적습니다.
  - 공통 시험(`core-host.test.ts`, `ws.test.ts`, `control-plane.integration.test.ts`, `mcp.integration.test.ts`, `smoke.integration.test.ts`, `external/*.integration.test.ts`, `lint-rules.test.ts` 등)은 `CORES`가 아니라 `testing/sample-core`에서 직접 가져와 시험용 인스턴스에 등록합니다.
  - `knip.json`과 ESLint의 `cores/**` 규칙(`Math.random` 금지 등)이 새 위치에도 적용되는지 확인합니다.
- **하드코딩 정리**(이슈 #19)
  - 매니페스트 이름: `'testbed-base'` 비교 → `package.json`의 `name`과 비교.
  - 출하 스모크 시험("boots its own server"): 고정 시나리오 목록·`SKIP` 수 대신 실제 목록(`loadScenarios()`)과 "FAIL 없음, 공통 점검 PASS".
  - 포트: 코드의 기본 포트는 테스트베드 소유 파일 `src/server/testbed/cores/port-block.ts`(`export const PORT_BLOCK = 40000;`) 한 곳에서 읽습니다. `src/server/config.ts`의 기본값, `scripts/testbed-release.ts`, 포트를 보는 시험이 이 값을 씁니다.
- **테스트베드 소유 UI 시험 환경** `e2e/testbed.ts`:

  ```ts
  import type { UiTestbedSetup } from './support/testbed-setup';

  /** UI 시험(`bun run test:ui`)과 화면 캡처(`bun run testbed:capture`)가 띄우는 서버의 준비. */
  export const setup: UiTestbedSetup = {
    // 서버 env에 더할 값. 상대 경로는 저장소 루트 기준
    env: {},
    // 서버를 띄우기 전에 한 번(예: 합성 고정 데이터를 임시 디렉터리에 복사하고 env를 돌려줌)
    // async prepare({ rootDir, tmpDir }) { return { AGENT_DATA_DIR: … }; },
  };
  ```

  - `scripts/test-ui.ts`는 기본 인스턴스를 띄울 때 `prepare()` 결과와 `env`를 합쳐 줍니다. 공통 시험용 변형 인스턴스(Python 예제 등)에는 적용하지 않습니다.
  - 타입과 합치는 함수는 공통 런타임(`e2e/support/testbed-setup.ts`)에 둡니다.

- **임시 조치**: 지금의 `e2e/dashboard.e2e.ts`·`e2e/external-core.e2e.ts` 중 샘플 코어를 가정하는 시험은 매니페스트에 `sample`이 없으면 건너뛰고 이유를 출력합니다. 이 시험들은 M19에서 계약 시험과 샘플 코어 시험으로 다시 씁니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/architecture.md`·`core-contract.md`: 샘플 코어 위치.
- `docs/testbed/ports.md`: "코드의 기본 포트는 `cores/port-block.ts`, 이미지와 예시 env는 `Dockerfile`·`.env.example`"을 새 테스트베드 절차에.
- `docs/testbed/verification.md`: `e2e/testbed.ts`.
- `README.md` "새 테스트베드 레포 만들기": 샘플 코어를 빼는 절차(`cores/index.ts`의 한 줄), `port-block.ts`.
- `CLAUDE.md` 테스트베드 전제: "샘플 코어는 공통 시험의 재료입니다. 테스트베드는 등록만 빼고 `testing/sample-core/`는 지우거나 고치지 않습니다." 한 줄.

**수용 기준**

- `bun run check`, `bun run testbed:smoke`, `bun run test:ui` 통과(이 저장소, 샘플 코어 등록 상태).
- **다운스트림 흉내 시험**(통합 시험 하나, 임시 작업 사본에서): `package.json`의 `name`을 `testbed-demo`로, `PORT_BLOCK`을 `40990`으로, 서버 `CORES`를 샘플 코어 없이 시험용 코어 하나로 바꾼 뒤 `bun test`(Python 시험 제외)와 `bun run testbed:smoke`가 통과(샘플 시나리오는 `SKIP`). 시험용 코어는 M19의 관찰 코어를 미리 만들어 씁니다(`testing/observer-core/`, M19 참고).
- 같은 사본에서 `bun run test:ui` → 샘플 코어를 가정하는 시험은 이유와 함께 건너뛰고 실패 0건.
- `e2e/testbed.ts`의 `env`에 `TESTBED_UI_PROBE=1`을 넣은 시험 실행에서 서버의 env에 그 값이 있음(시험 전용 확인 경로 또는 매니페스트가 아닌 방법으로 — 방법은 구현에서 정하고 2절에 적음).

### M16 — P6-b: 프레임과 배치 분리

**범위**

- **프레임** `TestbedFrame`(`src/client/testbed/dashboard/frame.tsx`): 지금 `dashboard-page.tsx`에서 배치와 관계없는 것만 가집니다.
  - `TestbedStoreProvider`, 로그인 판정(`connection === 'unauthorized'`면 로그인 안내만), 매니페스트 조회와 브라우저 탭 제목, `useLeaseAttribute()`, 상태 바, 락 배너, 재시작 알림, `SelectionProvider`.
  - `<html data-layout="<배치 id>">`를 답니다(락의 `data-lease`와 같은 방식).
  - 그 아래에 배치의 `Dashboard`를 그립니다.
  - 프레임은 주소의 쿼리를 읽거나 지우지 않습니다. 쿼리는 배치의 것입니다(`?tab=`, `?view=`, 이벤트 로그 필터).
- **배치 모듈**: 인터페이스는 `src/client/testbed/registry.ts`에 둡니다.

  ```ts
  /** @public 배치 계약 (docs/testbed/dashboard.md) */
  export interface DashboardLayout {
    /** 'default' 또는 테스트베드가 정한 이름. <html data-layout>과 시험 어댑터가 씀 */
    id: string;
    /** 프레임 안의 화면 전체 */
    Dashboard: ComponentType;
    /** 공통 푸터를 둘지. 기본 true */
    footer?: boolean;
  }
  ```

  - `src/client/testbed/cores/layout.tsx`(테스트베드 소유): `export const layout: DashboardLayout = defaultLayout;` 한 줄과 바꾸는 법을 적은 주석.

- **배치 안의 보기 전환** `useLayoutView(views, defaultView)`(`src/client/testbed/dashboard/layout-view.ts`): 배치가 보기 두 개 이상(예: "실시간"/"지난 기록")을 두고 고른 보기를 주소의 `?view=`에 남깁니다.
  - 돌려주는 것: `[view, setView]`. `setView`는 `history.replaceState`로 `view`만 바꾸고 다른 쿼리는 그대로 둡니다. 기본 보기면 `view`를 주소에서 뺍니다.
  - 주소의 값이 `views`에 없으면 기본 보기를 쓰고 주소를 고치지 않습니다.
  - 새로고침, 주소 공유, 뒤로 가기 후에도 같은 보기가 열립니다. 라우터는 쓰지 않습니다.
  - 보기 전환에 쓰는 탭 버튼은 보일러플레이트 UI의 탭을 쓰고 testid는 `testbed.layout.view(name)`입니다.
- **기본 배치** `defaultLayout`(`src/client/testbed/dashboard/default-layout.tsx`): 지금의 코어 열 · 주 영역 탭 · 상세 패널, 1024px 미만 오버레이(사이드바·바텀시트), 좁은 화면에서 이벤트를 고르면 상세 시트 열기를 옮깁니다. 탭은 지금처럼 공통 탭 + `CLIENT_CORES`의 `panels`입니다(패널 슬롯 유지). 기본 배치는 `?view=`를 쓰지 않습니다.
- **선택 알림**: 상세 시트를 여는 일은 배치가 정하므로, `SelectionProvider`의 `onSelect` 대신 배치가 등록하는 훅 `useSelectListener(listener)`(`views/selection.tsx`)를 둡니다. 등록한 함수는 이벤트를 고를 때마다 불립니다(같은 이벤트를 다시 골라도).
- **매니페스트 훅** `useTestbedManifest()`(`store/hooks.ts`): 프레임과 배치가 같은 쿼리 키(`['testbed', 'manifest', instanceId]`)를 쓰게 합니다.
- **라우트**(`src/client/app.tsx`): `/`는 `TestbedFrame` + 배치입니다. `layout.footer === false`면 푸터 없는 레이아웃 그룹에 둡니다. `App`이 `layout?: DashboardLayout` prop을 받고, 없으면 `cores/layout`의 것을 씁니다(M17의 시험용 배치가 씀).
- `dashboard-page.tsx`는 `TestbedFrame`과 배치를 잇는 얇은 파일로 남기거나 없앱니다. 어느 쪽이든 knip이 통과해야 합니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/dashboard.md`: 맨 앞에 "0. 프레임과 배치" 절(누가 무엇을 소유하는지, 배치 모듈 인터페이스, `data-layout`, 보기 전환, 테스트베드 소유 파일). §1.1 "영역"은 "기본 배치"로 이름을 바꿈. §4 패널 슬롯은 "기본 배치를 쓸 때"로.
- `docs/testbed/architecture.md`: "대시보드 셸"을 "대시보드 프레임·공통 위젯·기본 배치"로.
- `docs/testbed/README.md`: 문서 표의 `dashboard.md` 설명.
- `CLAUDE.md` 테스트베드 전제: "대시보드 배치는 이 테스트베드가 소유합니다(`src/client/testbed/cores/layout.tsx`). 프레임은 고치지 않습니다." 한 줄.
- `docs/ui-automation.md`: `<html data-layout>`, `testbed.layout.view(name)`.

**수용 기준**

- 기존 `bun run test:ui`가 **시험 코드를 고치지 않고** 통과합니다.
- 단위 테스트: `layout.id`가 `default` / 등록한 선택 리스너가 같은 이벤트를 두 번 골라도 두 번 불림 / `dashboardTabs` 기존 테스트 통과 / `useLayoutView`: 주소 → 보기, 보기 바꾸기 → 다른 쿼리는 그대로, 기본 보기면 `view` 없음, 모르는 값이면 기본 보기·주소 그대로.
- `/`에서 `<html data-layout="default">`.
- 화면 확인: 1440·1024·390px, 라이트·다크 화면이 M16 전과 같음(PR에 전후 캡처).
- `bun run check` 통과.

### M17 — P6-c: 공통 위젯 공개, 다중 kind 필터, 시험용 배치

**범위**

- **먼저 확인할 것 — 시험 변형을 띄우는 방법**: 이 저장소의 기본과 다른 **배치**(시험용 배치) 또는 다른 **코어 목록**(M19의 관찰 코어만)으로 서버를 띄워 시험할 방법을 정하고 결과를 2절에 적습니다. 기준: ① 배포 산출물(`dist/`)에 시험용 코드가 들어가지 않음 ② `bun run test:ui` 한 번으로 기본과 변형을 모두 시험 ③ 서버 코드에 시험 전용 분기가 생기면 그 범위를 2절에 적음. 후보:
  1. `startLocalTestbed`(`src/server/testbed/smoke/server.ts`)에 시험 전용 진입점을 주는 옵션. 클라이언트는 `e2e/fixtures/<변형>/index.html`(`<App layout={…} />`을 그리는 `main.tsx`), 서버는 `e2e/fixtures/<변형>/server.ts`(코어 목록을 바꿔 서버를 시작). 지금 서버는 `src/server/index.ts`에서 `../client/index.html`을 정적으로 import하므로, 서버 시작을 함수(`startServer({ cores, clientEntry })`)로 꺼낼 수 있는지와 동적 import한 HTML을 `Bun.serve` 라우트에 쓸 수 있는지 확인합니다.
  2. 시험 때 임시 작업 사본에서 `cores/layout.tsx`·`cores/index.ts`만 바꿔 서버를 띄움.
- **다중 kind 필터**(2절 전제): 제어 서비스의 이벤트 필터 `kind`가 `string | string[]`을 받습니다. 배열이면 접두사 중 하나에 맞으면 통과(any-of)이고, 접두사 규칙(`kind`와 같거나 `kind + '.'`로 시작, 끝의 `.`은 있어도 없어도 같음)은 그대로입니다. 빈 배열은 검증 오류입니다.
  - REST `GET /events`: `kind`를 여러 번 줄 수 있음(`?kind=agent.socket&kind=agent.message`).
  - MCP `query_events`·`wait_for`·`check`: `kind`에 배열 허용. 도구 설명에 "배열이면 그중 하나에 맞는 이벤트"를 적습니다.
  - `check`·`wait_for`의 판정, Run 요약의 check 기록도 같은 필터를 씁니다.
- **공개 위젯 입구** `src/client/testbed/widgets.ts`: 배치와 고유 화면이 가져다 쓰는 공통 UI의 유일한 입구입니다. 내보내는 것마다 `@public`(knip)을 답니다.

  | 내보내는 것                                                                                                                                | 내용                                                                                  |
  | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
  | `defaultLayout`, `useLayoutView`                                                                                                           | 기본 배치(일부만 바꾸고 싶은 배치가 감쌀 수 있음), 보기 전환                          |
  | `ConnectionPanel`                                                                                                                          | 연결 패널                                                                             |
  | `CoreCard`                                                                                                                                 | 코어 카드(아래 위젯의 묶음)                                                           |
  | `CoreOps`                                                                                                                                  | **새로 분리**: 상태 배지, 카운터, `summary`(M18), start/stop/reset, 외부 코어 복제 표 |
  | `ConfigEditor`, `FaultEditor`                                                                                                              | 설정 편집기, 결함 규칙 편집기                                                         |
  | `ActionList`, `CoreAction`                                                                                                                 | 액션 목록, **새로 분리**: 액션 하나(`<CoreAction core name />`)                       |
  | `EventLog`, `DetailPanel`, `StatsPanel`, `RunsPanel`, `AgentTimeline`                                                                      | 주 영역 위젯과 상세 패널                                                              |
  | `Collapsible`                                                                                                                              | **새로**: 접는 영역(아래)                                                             |
  | `JsonViewer`, `Sparkline`                                                                                                                  | 부품                                                                                  |
  | `OperateButton`, `LockAwareEditor`, `useLockAwareEditor`                                                                                   | 조작 버튼, 편집 잠김 래퍼                                                             |
  | `useSelection`, `useSelectListener`                                                                                                        | 선택된 이벤트                                                                         |
  | `useTestbed`, `useTestbedStatus`, `useTestbedManifest`, `useLease`, `useCanOperate`, `useTestbedEvents`, `useCoreStatus`, `useLatestEvent` | 스토어 훅(`useCoreStatus`·`useLatestEvent`는 M18)                                     |
  | `testbedApi`                                                                                                                               | REST 함수(`src/client/api/endpoints.ts`의 제어면 부분)                                |
  | `formatLocalTime`, `formatRelative`, `formatDuration`                                                                                      | 시각 표시 헬퍼(지금 위젯이 쓰는 로컬 시각·경과 시간 표시와 같은 것)                   |

- **`CoreOps`**: `CoreCard`에서 상태·카운터·조작 버튼·복제 표를 떼어 내고, `CoreCard`는 이것을 씁니다. testid는 기존 `testbed.core-card.*` 그대로입니다.
- **`CoreAction`**: 매니페스트에서 그 액션을 찾아 버튼과 입력 폼(`LockAwareEditor` 포함)을 그 자리에 둡니다. `ActionList`는 이것으로 다시 만듭니다. testid는 기존 `testbed.action.*` 그대로입니다. 매니페스트에 없는 액션이면 개발 중 콘솔 경고와 함께 아무것도 그리지 않습니다.
- **`EventLog` props**: 지금처럼 props 없이 쓰면 동작이 같습니다.

  ```ts
  interface EventLogProps {
    /** 고정 조건. 이 조건의 필터 칸은 숨기고, 화면의 필터와 함께 적용함 */
    fixed?: Partial<LogFilter>; // kind: string | string[], level: 이 수준 이상, core, actor, runId
    /** 필터를 어디에 둘지. 'url'(기본): 지금처럼 주소에. 'local': 컴포넌트 안에만 */
    state?: 'url' | 'local';
    /** 영역 이름(aria-label). 한 화면에 로그가 둘 이상이면 필수 */
    title?: MessageKey;
  }
  ```

  - 고정 조건과 화면 필터를 합치는 일은 `log-filter.ts`의 순수 함수로 둡니다. 같은 필드면 고정 조건이 이깁니다. 고정 `kind`가 배열이면 화면의 kind 칸은 그 접두사들 안에서만 좁힐 수 있습니다(교집합).
  - 스토어의 이벤트와 지난 Run의 REST 조회 모두 합친 필터를 씁니다(REST는 다중 `kind` 그대로 보냄).
  - `state: 'url'`인 로그가 한 화면에 둘 이상이면 개발 중 콘솔 경고를 냅니다.

- **`DetailPanel`**: 배치가 어디에 두든(오른쪽 열, 목록 아래, 시트 안) 같은 동작입니다. 선택된 이벤트는 프레임의 `SelectionProvider`에서 받고, 같은 `correlationId` 묶음 보기를 유지합니다. 자기 크기는 부모를 따르고, 스크롤은 자기 안에서 합니다.
- **`RunsPanel` 작은 형태** `variant: 'full' | 'compact'`(기본 `full`): `compact`는 열린 Run(label, 경과 시간, 연 주체)과 시작·종료 버튼만 보여 줍니다(시작 폼은 label 하나, seed·`endActive`는 펼치기 뒤). 지난 Run 목록과 요약은 없습니다. testid는 `full`과 같은 이름을 씁니다(`testbed.runs.start`·`.end`).
- **`Collapsible`** `({ title, defaultOpen = false, id, children })`: 접혀 있어도 **자식을 언마운트하지 않고** 숨깁니다(`hidden`). 그래서 처음에 접혀 있다가 열려도, 열었다 접어도 스토어 구독과 편집 중 입력(결정 38)이 유지됩니다. 열림 상태는 컴포넌트 안에만 둡니다. testid는 `testbed.collapsible(id)`, 머리 버튼은 `testbed.collapsible.toggle(id)`입니다.
  - 공통 위젯은 처음부터 숨겨진 곳에 그려져도 동작해야 합니다. 가상 스크롤처럼 크기를 재는 위젯은 보일 때(크기가 0에서 바뀔 때) 다시 잽니다.
- **`data-operate`**: `OperateButton`이 그리는 버튼에 `data-operate`를 답니다(`lockable={false}`면 `data-operate="unlocked"`).
- **배치·고유 화면의 import 제한**(ESLint): `src/client/testbed/cores/**`와 `e2e/fixtures/**`의 클라이언트 코드는 `src/client/testbed/`에서 `widgets.ts`와 `registry.ts`만 가져올 수 있습니다. 그 밖의 공통 런타임 파일(`dashboard/`, `views/`, `editing/`, `store/`)을 직접 가져오면 오류입니다. `src/client/ui/`(오버레이 규칙은 그대로), `src/client/i18n/`, `src/client/testing/testids.ts`, `@shared/*`는 허용합니다. `src/client/api/`는 `testbedApi`를 `widgets.ts`로 받으므로 막습니다(보일러플레이트의 다른 API를 쓸 일이 생기면 그때 허용을 정함).
  - 지금 클라이언트 경계 규칙은 `@typescript-eslint/no-restricted-imports` 한 항목에 모여 있고, flat config는 규칙 옵션을 통째로 바꿉니다. `cores/**`용 블록을 따로 두면 기존 패턴(서버 코드, 오버레이 내부, 선언형 오버레이)을 그 블록에 모두 다시 적어야 합니다. 빠뜨리면 경계가 조용히 사라집니다(`eslint.config.js` 머리 주석).
  - React hooks 규칙과 `.tsx` 논리 할당 금지 규칙을 `e2e/fixtures/**`에도 적용합니다.
- **배치 스타일** `src/client/testbed/cores/layout.css`(테스트베드 소유, 이 저장소는 주석만): `src/client/index.html`에서 `main.css` 다음 줄에 `<link rel="stylesheet" href="./testbed/cores/layout.css" />`로 읽습니다. `main.css`의 `@import`는 규칙보다 앞에만 올 수 있어 배치 스타일이 공통 스타일에 덮이므로 쓰지 않습니다. 토큰(`tokens.css`의 변수)을 쓰라는 주석을 둡니다.
- **시험용 배치** `e2e/fixtures/alt-layout/`: 기본 배치와 구조가 전혀 다른 배치(id `alt`). 계약 시험이 기본 배치의 구조에 기대지 않는지 확인하는 데 씁니다. 실제 테스트베드의 본보기가 아니며, 문서에서 예시로 가리키지 않습니다.
  - 보기 둘(`useLayoutView(['live', 'history'], 'live')`), 탭 없는 한 열 화면, 푸터 없음(`footer: false`).
  - **live**: 위에서부터 코어마다 `CoreOps`와 그 코어의 `CoreAction`들을 한 줄로, `RunsPanel variant="compact"`, 그 아래 이벤트 로그 둘을 나란히(`fixed={{ kind: ['sample.data', 'sample.connection'] }}`와 `fixed={{ level: 'warn' }}`, 둘 다 `state: 'local'`), 고른 이벤트의 `DetailPanel`은 로그 아래.
  - **history**: `RunsPanel`(full), `StatsPanel`, 필터 없는 전체 `EventLog`(`state: 'local'`), 그 아래 `DetailPanel`.
  - 두 보기 공통으로 화면 아래에 `Collapsible` 영역 넷(처음엔 모두 접힘): 연결(`ConnectionPanel`), 설정·결함(`ConfigEditor`, `FaultEditor`), 에이전트 타임라인(`AgentTimeline`), 코어 카드(`CoreCard`).

**같은 PR에서 고칠 문서**

- `docs/testbed/dashboard.md` §4를 "배치와 고유 화면이 쓰는 것"으로: 공개 위젯 표, `EventLog` props, `RunsPanel` 형태, `Collapsible`, `DetailPanel` 배치, import 제한, `layout.css`, `data-operate`.
- `docs/testbed/control-plane.md`: 이벤트 필터 `kind`의 배열, REST 반복 쿼리, MCP 도구 입력.
- `docs/testbed/events.md` 또는 `runs-and-checks.md`의 필터 설명.
- `docs/ui-automation.md`: `data-operate`, `testbed.collapsible(id)`.
- 2절: 시험 변형을 띄우는 방법(M17 결과).

**수용 기준**

- 단위 테스트: 다중 `kind` 매칭(배열 any-of, 끝의 `.`, 빈 배열 거절) / 고정 조건과 화면 필터 합성(같은 필드는 고정 조건이 이김, 고정 `kind` 배열과 화면 kind의 교집합, 고정 조건의 필드는 주소에서 읽지 않음) / `state: 'local'`이면 주소를 바꾸지 않음(순수 함수 수준).
- 통합 테스트: REST `GET /events?kind=a&kind=b`, MCP `query_events {kind:['a','b']}`·`check {filter:{kind:[…]}}`가 any-of로 거름. 기존 단일 `kind` 호출은 그대로.
- 시험용 배치 UI 시험(`e2e/fixtures/alt-layout/*.e2e.ts`)
  - TCP `hello` → `sample.data`·`sample.connection` 로그에 `sample.data.echoed`와 `sample.connection.opened` 행, `warn` 로그에는 없음 → `disconnect` 결함 규칙을 접힌 영역을 열어 저장한 뒤 전송 → `warn` 로그에 `testbed.fault.injected`. 두 로그의 필터를 바꿔도 주소는 `?view=`만 남음.
  - `CoreAction` 단독 버튼으로 `broadcast` 실행 → 결과 표시, 락을 잡으면 `aria-disabled="true"`.
  - 보기 전환: `history`로 바꾸면 주소에 `?view=history` → 새로고침 → `history` 보기 → `live`로 바꾸면 `view`가 주소에서 빠짐.
  - 접힌 영역: 설정 편집기를 열어 입력 → 접기 → 펴기 → 입력 그대로. 접힌 채 락 획득 → 펴면 조작 컨트롤이 `aria-disabled="true"`, 입력 그대로 읽기 전용.
  - `RunsPanel compact`로 Run 시작·종료.
- ESLint: `src/client/testbed/cores/` 아래 시험용 파일이 `../views/event-log`를 import하면 `bun run lint`가 실패함을 확인한 뒤 그 파일을 지웁니다(PR 설명에 적음). 기존 경계(예: 클라이언트에서 서버 런타임 import)가 `cores/**`에서도 여전히 오류인지도 같은 방법으로 확인합니다.
- `bun run build` 산출물에 `layout.css`가 들어가고, 시험용 코드는 들어가지 않습니다(`dist/`에서 `alt-layout`·`observer` 문자열 검색 0건).
- 기존 `bun run test:ui` 통과, `bun run check` 통과.

### M18 — P6-d: 실시간 값(주기적 status, `summary`, 마지막 이벤트)

**범위**

- **주기적 status 푸시**(2절 전제): WS `/testbed/ws`에 연결이 하나라도 있는 동안 서버가 1초마다 모든 코어의 `status()`를 보고, 직전에 보낸 것과 `state`·`detail`·`counters`·`summary`·복제 상태 중 하나라도 다르면 그 코어의 `status` 증분을 보냅니다. 지금의 이벤트 기반 푸시(`STATUS_KINDS`)는 그대로 두고, 둘이 겹치면 한 번만 보냅니다(묶음 간격 안에서 합침).
  - 연결이 없으면 돌지 않습니다. 코어 `status()`가 던지면 그 코어는 건너뛰고 `warn` 로그(같은 코어는 1분에 한 번만).
  - 외부 코어의 `status()`는 마지막 응답 확인 결과를 돌려주므로, 그 값은 `pingIntervalMs`(기본 5초)마다만 바뀝니다. 문서에 적습니다.
  - MCP `testbed_info`와 REST `GET /status`는 원래부터 부를 때의 값을 줍니다(바뀌지 않음).
- **`status().summary`**: 코어 상태에 선택 필드 `summary?: Record<string, string | number | boolean | null>`을 더합니다(in-proc `CoreInstance.status()`, 공유 `CoreStatus`, 외부 코어 프로토콜의 `status` 응답). 카운터처럼 숫자가 아닌 현재 값(상태 이름, "언제부터" 시각 등)을 담습니다. 시각은 UTC ISO 문자열로 둡니다.
  - `CoreOps`가 카운터 아래에 키–값으로 보여 줍니다(ISO 시각은 `formatLocalTime`으로). 배치는 `useCoreStatus(core)`로 직접 읽습니다.
  - 매니페스트와 `testbed_info`의 코어 상태에도 그대로 나옵니다.
  - 원칙(문서에 적음): **"지금 상태"와 "언제부터"는 코어 status에 둡니다.** 이벤트는 기록이므로 링버퍼에서 밀려날 수 있습니다.
- **`useCoreStatus(core)`**: 그 코어의 `CoreStatus`(없으면 `undefined`). 주기적 푸시로 갱신됩니다.
- **`useLatestEvent(filter)`**: 스토어의 이벤트 중 필터(`core`, `kind`(다중 가능), `level`, `actor`)에 맞는 가장 최근 하나를 돌려줍니다. 스토어(최근 5000건)에 없으면 `null`입니다. REST로 더 찾지 않습니다(밀려난 이벤트는 위 원칙대로 status에서 읽음). 맞는 이벤트가 새로 오면 갱신됩니다.
- **샘플 코어**: `summary`에 `lastConnectionAt`(마지막 연결 시각, 없으면 `null`)을 넣습니다. 관찰 코어(M19)는 이벤트 없이 매초 바뀌는 값을 냅니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/core-contract.md` §3: `status().summary`와 "지금 상태는 status에" 원칙.
- `docs/testbed/external-core-protocol.md` §4: `status` 응답의 `summary`. Python 어댑터와 `py-echo`도 `summary`를 낼 수 있게(빈 객체 허용).
- `docs/testbed/control-plane.md` §5 WS: 주기적 status 증분.
- `docs/testbed/dashboard.md`: `useCoreStatus`, `useLatestEvent`와 밀려난 경우.

**수용 기준**

- WS 통합 테스트(관찰 코어 사용, M19에서 만들 코어를 이 단계에서 먼저 만들어도 됨): 이벤트 없이 `counters.ageSec`가 매초 바뀌는 코어 → 연결한 클라이언트가 1.5초 안에 바뀐 값의 `status` 증분을 받음. 값이 그대로인 코어의 증분은 오지 않음. 연결이 없을 때는 `status()`가 불리지 않음(호출 횟수로 확인).
- 스토어 단위 테스트: `useLatestEvent`가 필터에 맞는 최신 이벤트로 바뀜, 5000건 밖으로 밀리면 `null`.
- `summary`가 매니페스트·`testbed_info`·`CoreOps`에 나옴(샘플 코어의 `lastConnectionAt`: 연결 전 `null` → 연결 후 시각).
- UI 시험(시험용 배치 또는 기본 배치): 관찰 코어의 `ageSec`가 화면에서 1초 안에 바뀜.
- `bun run check`, `bun run test:python` 통과.

### M19 — P6-e: UI 계약 시험과 배치 시험 분리

**범위**

- **관찰 코어** `src/server/testbed/testing/observer-core/`(시험 전용): 데이터면 없음, 액션은 읽기 전용 하나(`peek` → 지금 카운터, `mutating: false`), 결함 종류 없음, 설정은 공통 필드와 `tickMs`(기본 1000)뿐. 시작하면 `counters.ageSec`를 `tickMs`마다 올리고(이벤트 없음), `summary.sinceAt`에 시작 시각을 둡니다. 첫 테스트베드의 `agent` 코어와 같은 성격(데이터면 없음·읽기 전용 액션만·결함 없음)을 흉내 냅니다.
- **계약 시험 인스턴스**: `bun run test:ui`는 세 가지 서버를 띄웁니다(방법은 M17 결과).

  | 인스턴스   | 코어                                      | 배치                  | 돌리는 시험                                                        |
  | ---------- | ----------------------------------------- | --------------------- | ------------------------------------------------------------------ |
  | `main`     | 이 레포의 `CORES` + `e2e/testbed.ts` 준비 | 이 레포의 배치        | 계약 시험, 기본 배치 시험, 장면 시험, 샘플 코어 시험(샘플 등록 시) |
  | `observer` | 관찰 코어만                               | 기본 배치·시험용 배치 | 계약 시험(공통 런타임의 자기 확인)                                 |
  | `alt`      | 샘플 코어                                 | 시험용 배치           | 계약 시험, 시험용 배치 시험                                        |
  | (`py`)     | 샘플 코어 + `py-echo` 복제 2              | 기본 배치             | 외부 코어 시험(Python 필요)                                        |

  테스트베드 레포에서는 `main`이 그 테스트베드의 코어·배치·어댑터이므로, 계약 시험이 그 테스트베드에서 그대로 돕니다. `observer`·`alt`·`py`는 공통 런타임의 자기 확인이라 다운스트림에서도 돌지만 테스트베드 코어와 무관합니다.

- **배치 어댑터**: 계약 시험은 배치의 구조를 모르고, 어댑터를 통해 기능을 찾아갑니다.

  ```ts
  // e2e/layout/types.ts (공통 런타임)
  export type RevealTarget =
    | { area: 'connection' }
    | { area: 'core'; core: string } // 코어 조작(상태, start/stop/reset, 카운터·summary, 복제 표)
    | { area: 'config'; core: string }
    | { area: 'faults'; core: string } // 매니페스트에 결함 종류가 있는 코어만
    | { area: 'action'; core: string; action: string } // UI에 노출된 액션만
    | { area: 'runs' }
    | { area: 'events' } // 고정 조건이 없는 이벤트 로그(현재 Run, 없으면 전체). 배치는 이런 로그를 어딘가에 하나 둬야 함
    | { area: 'detail' } // 고른 이벤트의 상세
    | { area: 'agent-timeline' };

  export interface LayoutAdapter {
    /** 배치 모듈의 id와 같아야 함 */
    id: string;
    /** `/`를 열고 첫 화면이 준비될 때까지 기다림 */
    open(page: Page): Promise<void>;
    /** 그 기능을 화면에 보이게 하고(보기 전환, 탭 전환, 접힌 영역 펴기, 오버레이 열기 등) 그 영역을 돌려줌 */
    reveal(page: Page, target: RevealTarget): Promise<Locator>;
  }
  ```

  - 기본 배치용 어댑터 `e2e/layout/default-adapter.ts`(공통 런타임), 시험용 배치용 어댑터 `e2e/fixtures/alt-layout/adapter.ts`.
  - `e2e/layout/adapter.ts`(테스트베드 소유)는 `export { defaultAdapter as adapter } from './default-adapter';` 한 줄입니다.

- **계약 시험** `e2e/contract/*.e2e.ts`(공통 런타임): **코어와 무관한 공통 수단**만으로 데이터를 만듭니다. Run 시작·종료, 락 획득·해제(REST, `X-Testbed-Actor: agent`), `POST /check`(→ `testbed.check.evaluated`), 설정 패치(→ `testbed.control.invoked`). 코어별 확인은 매니페스트를 읽어 그 코어에 있는 것만 합니다(데이터면, UI 액션, 결함 종류).

  | #   | 계약                                                                                                                                                                                                                          |
  | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | 0   | 배치 확인: `<html data-layout>`이 `adapter.id`와 같음. 어댑터를 바꾸지 않고 배치만 바꾼 경우를 잡음                                                                                                                           |
  | 1   | 상태 바에 모든 코어의 상태. `connection` 영역에 제어면 MCP URL, 데이터면 엔드포인트가 있는 코어면 그 주소                                                                                                                     |
  | 2   | REST로 Run 시작 → `POST /check` → `events` 영역에 `testbed.run.started`와 `testbed.check.evaluated` 행 → 고르면 `detail` 영역에 payload. 필터 입력칸에 빠르게 쳐도 글자가 사라지지 않음                                       |
  | 3   | `runs` 영역에서 Run 시작 → 상태 바에 표시 → 종료 → 지난 Run 요약(배치가 `compact`만 두면 지난 Run 요약은 `events` 영역의 `testbed.run.ended`로 대신 확인)                                                                     |
  | 4   | 락: 모든 영역을 차례로 열어, 보이는 `[data-operate]`(값이 `unlocked`가 아닌 것)가 하나 이상이고 모두 `aria-disabled="true"`. 각 코어의 `config` 영역에서 편집 중 입력 보존 → 해제 후 "서버 값이 바뀜" → "내 입력 유지" → 저장 |
  | 4b  | 락 중 조작 요청 없음: 락을 잡은 채 모든 영역을 열고 보이는 버튼을 모두 누름(복사, 펼치기 포함). 그동안 페이지가 보낸 `/testbed/api` 요청 중 GET이 아니고 `mutating: false` 액션도 아닌 것이 0건                               |
  | 5   | 잠김 중 저장 → 423 안내, 입력 보존                                                                                                                                                                                            |
  | 6   | UI 액션이 있는 코어마다: `action` 영역에 닿음. `mutating: false` 액션은 락 중에도 실행되고 결과가 보임. `mutating: true` 액션은 락이 없을 때 실행되고 결과(또는 검증 오류 문장)가 보임                                        |
  | 7   | 결함 종류가 있는 코어마다: `faults` 영역에서 규칙 하나를 추가·저장 → `GET /cores/:core/config`의 `faults`에 그 규칙 → 지움                                                                                                    |
  | 8   | `agent-timeline` 영역에 에이전트의 락 획득·해제, 사람의 조작은 없음                                                                                                                                                           |
  | 9   | 코어 조작 버튼의 활성 조건, 검증 오류 문장, 화면 언어·로컬 시각의 오류 문장(지금의 이름 없는 시험들 중 코어와 무관한 것)                                                                                                      |
  | 10  | `core` 영역의 카운터·`summary`가 이벤트 없이 바뀌는 값을 1.5초 안에 따라감(`observer` 인스턴스에서만. 다른 인스턴스는 바뀌는 값이 있는 코어가 없으면 건너뜀)                                                                  |
  - 4b의 판정은 `e2e/contract/lock-violations.ts`의 함수 `collectLockViolations(page, adapter)`(위반 목록을 돌려줌)로 두고, 계약 시험은 목록이 비었는지 봅니다.
  - 매니페스트에 해당 기능이 없어 건너뛴 계약은 시험 이름에 `(skipped: 이유)`로 보고합니다. 실패로 세지 않습니다.

- **샘플 코어 시험** `e2e/sample/*.e2e.ts`(공통 런타임): 지금 시험 중 샘플 코어의 동작에 기대는 것(TCP echo → 로그, `broadcast` 수신, `disconnect`로 연결 끊김과 `testbed.fault.injected`). 어댑터를 씁니다. 매니페스트에 `sample`이 없으면 파일 전체를 건너뜁니다.
- **외부 코어 시험** `e2e/external/*.e2e.ts`(공통 런타임): 지금의 `external-core.e2e.ts`(복제 표, 재시작, 복제 로그, 액션 대상 선택). `py` 인스턴스에서만, Python이 없으면 지금처럼 건너뜀(`TESTBED_REQUIRE_PYTHON=1`이면 실패).
- **기본 배치 시험** `e2e/default-layout/*.e2e.ts`(공통 런타임): 탭과 `?tab=`, 이벤트 로그 필터가 주소에 남는 것, 1024px 이상에서 세 열이 따로 스크롤하고 붙어 있음, 1024px 미만에서 코어 열 사이드바와 상세 바텀시트(이벤트를 고르면 시트가 열림). `adapter.id !== 'default'`면 파일 전체를 건너뜁니다. 그래서 배치를 바꾼 테스트베드도 이 파일을 지우지 않습니다(업스트림이 고쳐도 충돌하지 않음).
- **장면 시험** `e2e/scenes/`(테스트베드 소유): 이 저장소는 `README.md`(형식과 예시)만 둡니다. 비어 있어도 `bun run test:ui`가 실패하지 않게 합니다.
  - 공통 헬퍼 `e2e/support/scene.ts`(공통 런타임):

    | 이름                                             | 하는 일                                                                                                                                                                              |
    | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
    | `atWidth(page, width, height?)`                  | 화면 크기를 정하고(`height` 기본: 1440→900, 1024→768, 390→844, 그 밖에는 너비×0.625) `/`를 다시 엶                                                                                   |
    | `expectInFirstView(locator, { minVisible = 1 })` | 문서와 그 요소의 모든 스크롤 조상이 스크롤되지 않은 상태에서, 요소가 화면 안에 `minVisible` 비율 이상 보이고(`display`·`visibility`·`opacity`·`hidden` 확인) 다른 요소에 가리지 않음 |
    | `runScene(name)`                                 | M20의 장면 정의(`defineScene`)의 `setup`을 실행해 데이터를 만듦. 시험이 끝나면 정리                                                                                                  |
    | `withLease(fn)`                                  | 에이전트 락을 잡은 채 `fn`을 실행하고 해제                                                                                                                                           |

  - 예(README): `test('장면 1: 1440에서 수신 상태가 첫 화면에', async ({ page }) => { await runScene('agent-ok'); await atWidth(page, 1440); await expectInFirstView(page.getByTestId(TESTID.agent.healthCard)); });`
- **Playwright 구성**: 프로젝트를 `contract`(main), `contract-observer`(observer, 기본 배치), `contract-observer-alt`(observer, 시험용 배치), `contract-alt`(alt), `default-layout`(main), `alt-layout`(alt, M17의 시험용 배치 시험), `sample`(main), `external`(py), `scenes`(main)로 나눕니다. `bun run test:ui -- --project contract`처럼 골라 돌릴 수 있습니다. 인스턴스 주소는 지금처럼 환경 변수로 넘깁니다.
- **위반 확인용 변형**: 시험용 배치에 `?variant=unsafe-button`이면 `OperateButton` 대신 일반 `Button`으로 설정을 PATCH하는 버튼 하나를 더 그립니다(`e2e/fixtures/` 안에만 있음).
- M15의 임시 조치(샘플 코어가 없으면 건너뜀)는 이 마일스톤에서 없앱니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/verification.md` §5: 인스턴스 표, 계약 시험·샘플 코어 시험·외부 코어 시험·기본 배치 시험·장면 시험의 위치와 소유, 어댑터, 프로젝트 이름, 4b 판정, 건너뛰기 규칙, 장면 헬퍼.
- `docs/ui-automation.md`: 어댑터와 `RevealTarget`.
- `docs/testbed/spec-template.md` §2 마일스톤 표의 M3 완료 판정: "계약 시험과 장면 시험 통과"(M20에서 M3a·M3b로 나눔).

**수용 기준**

- 계약 시험 0–10번이 `contract`, `contract-observer`, `contract-observer-alt`, `contract-alt`에서 통과합니다. `observer` 인스턴스에서는 6번이 `peek`(읽기 전용)으로, 7번이 건너뜀으로 통과합니다.
- **샘플 코어 없는 다운스트림 흉내**(M15의 임시 사본 방식 재사용): 서버 `CORES`를 관찰 코어만으로 바꾼 사본에서 `bun run test:ui`가 실패 0건(샘플 코어 시험은 건너뜀, 계약 시험은 관찰 코어로 통과).
- `collectLockViolations`가 시험용 배치의 `?variant=unsafe-button`에서 위반 1건(그 버튼의 PATCH)을 보고하는 시험이 통과합니다.
- 기본 배치 시험이 기본 배치에서 통과하고, `contract-alt` 실행에서는 건너뜁니다.
- 장면 헬퍼 시험: `expectInFirstView`가 첫 화면 안 요소에 통과, 스크롤해야 보이는 요소·접힌 영역 안 요소·다른 요소에 가린 요소에 실패(시험용 배치로 확인).
- PR에 옛 `e2e/dashboard.e2e.ts`·`e2e/external-core.e2e.ts`의 확인 항목 → 새 위치 대응표. 빠진 항목이 없어야 합니다.
- CI(`ci.yml`)의 UI 시험 단계가 모든 프로젝트를 돌립니다. `bun run check`, `bun run test:ui` 통과.

### M20 — P6-f: UI 설계 하네스

**범위**

- **`docs/testbed/ui-design.md`**(새 문서): 테스트베드가 대시보드 배치를 정하는 절차. 담을 것:
  1. 언제 읽나: 스펙 대화에서 10.1–10.2를 쓸 때, M3a, M3b, 배치를 고칠 때.
  2. 순서: ① 스펙 10.1 사용 장면·10.2 핵심 질문 확인(스펙 대화에서 씀, 없으면 멈추고 물음) ② **기본 배치 코드(`default-layout.tsx`, `src/client/testbed/dashboard/`)를 열기 전에** 스펙 6·7·9절(이벤트·설정·액션)에서 10.3 데이터와 표현, 10.4 조작을 씀 ③ 배치안 2–3개 ④ 멈추고 사람에게 고르게 함 ⑤ 고른 안으로 10.5·10.6과 2절(새 라이브러리 포함) 갱신 ⑥ M3b 구현 ⑦ 장면 시험·캡처·검토.
  3. 데이터 성격 → 표현 표: 요청·응답 흐름(시간순 목록, 요청과 응답을 한 줄로 묶음), 대기열·예약된 응답(순서 있는 목록, 다음 항목 강조), 처리량·지연(시계열, 현재 값과 추세), 상태 기계(현재 상태와 전이 기록, "언제부터"는 `status().summary`), 여러 대상 비교(표, 같은 그림 반복), 판정 결과(통과·실패 목록, 실패 먼저), 이벤트 없이 바뀌는 값(`useCoreStatus`, 주기적 갱신). 표는 출발점이며 장면이 우선입니다.
  4. 배치 원칙: 핵심 질문의 답은 스펙이 정한 폭의 첫 화면에서 스크롤·클릭 없이 보임 / 자주 쓰고 급한 조작은 그 답 옆, 되돌릴 수 없는 조작은 확인 단계 / 공통 기능 도달성(계약)은 지키되 장면에 없는 기능은 깊숙이 둬도 됨(접힌 영역 `Collapsible`, 다른 보기 `useLayoutView`) / 락이 걸려도 화면이 읽혀야 함 / 에이전트의 행위를 사람이 지켜보는 장면이 있으면 그 위치를 정함 / 좁은 화면 지원 범위.
  5. 배치안의 형식: 이름, 한 줄 요지, 폭별 와이어프레임(텍스트 그림), 장면마다 핵심 질문에 화면의 어디서 답하는지 표, 대가(무엇을 덜 보여 주는지), 필요한 새 부품과 라이브러리, 필요한 공통 런타임 기능(없으면 `testbed-base`에 요청할 것). **안끼리 구조가 달라야 합니다**(같은 3열에 패널 순서만 다르면 한 안).
  6. 기본 배치를 고를 때: 장면에 기본 배치로 충분한 이유를 10.6에 적음. 고유 탭만 더하는 것도 이 경우입니다.
  7. 검토: `bun run testbed:capture`로 캡처 → 구현하지 않은 에이전트(새 세션)에 스펙 10.1–10.2와 캡처만 주고 핵심 질문마다 답과 화면의 위치를 적게 함 → 답하지 못한 질문이 있으면 고침 → 그 기록과 캡처를 PR에 붙이고 사람이 승인.
  8. 피할 것: 기본 배치에 탭 하나를 더하고 끝냄(이유 없이) / 모든 정보를 같은 무게로 한 화면에 / 이벤트 로그를 기본 주 화면으로 둠(장면이 로그를 읽는 일일 때만) / 조작 버튼을 데이터와 떨어진 곳에 모음 / 화면 언어 문장 대신 서버 오류 문장을 그대로 보임.
  9. 예: 첫 테스트베드(`slack-agent-org-dash`) 스펙 10.1–10.6이 이 순서를 실제로 거친 기록입니다(두 보기 "실시간"/"지난 기록", 접힌 공통 영역). 링크로만 가리키고 내용을 옮기지 않습니다.
- **스펙 템플릿**(`docs/testbed/spec-template.md`)
  - §1 틀의 10절을 아래로 바꿉니다.

    ```markdown
    ## 10. 대시보드

    <!-- 절차는 docs/testbed/ui-design.md. 10.1–10.2는 스펙 대화에서, 10.3–10.6은 M3a에서 씀 -->

    ### 10.1 사용 장면

    | #   | 누가 | 언제·상황 | 하려는 일 |
    | --- | ---- | --------- | --------- |

    ### 10.2 핵심 질문

    | 장면 | 화면을 열자마자 답해야 하는 질문 | 답에 필요한 데이터(이벤트 kind, 상태, 설정) |
    | ---- | -------------------------------- | ------------------------------------------- |

    ### 10.3 데이터와 표현

    | 데이터 | 성격(흐름/대기열/시계열/상태/비교/판정) | 표현 | 이유 |
    | ------ | --------------------------------------- | ---- | ---- |

    ### 10.4 조작

    | 조작(공통·액션) | 빈도 | 긴급도 | 실수의 영향 | 위치·확인 단계 |
    | --------------- | ---- | ------ | ----------- | -------------- |

    ### 10.5 배치

    <!-- 고른 안의 폭별 와이어프레임, 보기(있으면 ?view= 이름), 첫 화면에 둘 것과 요청 시 열 것(접힌 영역), 1024px 미만 지원 범위, 새 부품·라이브러리 -->

    ### 10.6 기본 배치와의 차이

    <!-- 유지·제거·교체한 것과 이유. 기본 배치를 그대로 쓰면 그 이유. 고유 화면 testid 접두사 TESTID.<core>.* -->
    ```

  - §1 틀의 11절 주석에 "M3b의 수용 기준은 장면마다 '폭 W에서 `/`를 열면 스크롤·클릭 없이 X가 보임' 형태로 쓰고 `e2e/scenes/`로 옮긴다(헬퍼 `atWidth`, `expectInFirstView`, `runScene`)"를 더합니다.
  - §2 마일스톤 표의 M3을 둘로 나눕니다.

    | M   | 범위                                                                                                           | 완료 판정                                                                                 |
    | --- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
    | M3a | 대시보드 설계: 10.3–10.4, 구조가 다른 배치안 2–3개(코드 없음)                                                  | 사람이 한 안을 고르고 10.5·10.6과 2절에 반영                                              |
    | M3b | 배치(`cores/layout.tsx`), 어댑터(`e2e/layout/adapter.ts`), 장면 데이터(`e2e/testbed.ts`, 장면 정의), 고유 화면 | `bun run test:ui` 통과(계약 시험 + 장면 시험), 캡처와 별도 에이전트 검토 기록을 PR에 첨부 |

  - §3 좋은 스펙의 기준에 "8. 대시보드는 장면으로 쓰기"를, §4 확인 목록의 "사람이 대시보드에서 꼭 눈으로 봐야 하는 것 → 고유 패널"을 "사람이 대시보드를 여는 장면과 그때 가장 먼저 알아야 하는 것 → 10.1, 10.2", "주로 보는 화면 폭과 좁은 화면 사용 여부 → 10.5"로 바꿉니다.
- **장면** `defineScene`(`src/server/testbed/scenes/`): 캡처할 상태를 만드는 정의. 파일은 `src/server/testbed/cores/*/scenes/*.scene.ts`(테스트베드)와 `src/server/testbed/testing/*/scenes/*.scene.ts`(공통 런타임의 샘플·관찰 코어)입니다.

  ```ts
  import { defineScene } from '@server/testbed/scenes';

  export default defineScene({
    name: 'sample-busy', // 모든 장면에서 유일
    title: '연결 3개가 데이터를 주고받고, 결함 규칙이 한 번 적용됨',
    spec: 'docs/spec.md §10.1 장면 1', // 근거
    requires: { cores: ['sample'] }, // 매니페스트에 없으면 건너뜀
    async setup(t) {
      // 스모크 시나리오의 t와 같음. 정리(Run 닫기, 락 해제, 연결 닫기)는 캡처 뒤에 실행기가 함
    },
  });
  ```

  - 장면 데이터가 서버 시작 전에 필요하면(파일 기반 관찰 코어 등) `e2e/testbed.ts`의 `prepare`에서 만들고, 장면의 `setup`은 그 뒤의 상태를 만듭니다.
  - 이 저장소에는 샘플 코어의 장면 하나(`sample-busy`: 열린 Run, TCP 연결 3개, 이벤트 수십 건, `disconnect` 결함 1회)를 둡니다.

- **`bun run testbed:capture`**(`scripts/testbed-capture.ts`): 서버를 `bun run test:ui`의 `main` 인스턴스와 같은 방식(`e2e/testbed.ts`의 준비 포함)으로 띄우고, 장면마다 `setup` → `/` 캡처 → 정리합니다.

  | 옵션               | 기본                        | 내용                                             |
  | ------------------ | --------------------------- | ------------------------------------------------ |
  | `--scene <이름>`   | 모든 장면                   | 장면 하나만                                      |
  | `--widths <목록>`  | `1440x900,1024x768,390x844` | 화면 크기                                        |
  | `--lease`          | 끔                          | 같은 캡처를 에이전트가 락을 잡은 상태로 한 벌 더 |
  | `--views <목록>`   | 배치의 기본 보기            | `?view=` 값마다 한 벌씩(배치가 보기를 둘 때)     |
  | `--full`           | 끔                          | 첫 화면 대신 페이지 전체                         |
  | `--url <base>`     | –                           | 떠 있는 인스턴스 대상(`prepare`는 건너뜀)        |
  | `--out <디렉터리>` | `captures/`                 | 저장 위치                                        |
  - 테마는 라이트·다크 둘 다(`localStorage`의 `app.theme`), 화면 언어는 `ko`입니다. 파일 이름은 `<out>/<scene>/<너비>-<theme>[-<view>][-lease].png`입니다. 장면마다 `<out>/<scene>/index.md`(장면 제목, 근거, 파일 목록)를 함께 남겨 PR에 그대로 붙일 수 있게 합니다.
  - 종료 코드: 성공 `0`, 없는 장면 이름이면 `1`(있는 장면 목록 출력), 서버를 띄우지 못하면 `2`.
  - `.gitignore`에 `captures/`, `knip.json` entry에 장면 파일 경로를 더합니다.

- **CLAUDE.md** 테스트베드 전제에 더할 것:
  - "대시보드 배치는 공개된 공통 위젯(`src/client/testbed/widgets.ts`)만 가져다 씁니다(스토어 훅, `testbedApi`, 시각 표시 헬퍼 포함). 조작 컨트롤은 `OperateButton`·`LockAwareEditor`로 만듭니다."
  - "M3a에서는 기본 배치 코드를 읽기 전에 스펙 10.3–10.4를 쓰고, [docs/testbed/ui-design.md](docs/testbed/ui-design.md)에 따라 구조가 서로 다른 배치안 2–3개를 낸 뒤 멈춰서 사람의 선택을 기다립니다."
- **`docs/testbed/README.md`**: 읽는 순서 표에 `ui-design.md`("대시보드 배치를 정하거나 고칠 때").
- **업그레이드 가이드** `docs/upgrade-guides/<머지한 달>-dashboard-layout.md`(P6 전체):
  - 포함 PR과 머지 순서(M15–M20), 이미 적용됐는지 확인(`src/client/testbed/cores/layout.tsx`와 `src/server/testbed/testing/sample-core/`가 있음).
  - **머지 뒤 할 일**(이미 이어받은 테스트베드)
    1. 서버 `cores/index.ts`: 샘플 코어를 등록하고 있었다면 import 경로가 `../testing/sample-core`로 바뀜. 등록을 뺐다면 남아 있던 `cores/sample/` 폴더를 지움(업스트림에서 이미 옮겨짐).
    2. `src/server/testbed/cores/port-block.ts`를 자기 포트 블록으로(대장의 값). `Dockerfile`·`.env.example`과 맞춤.
    3. `e2e/testbed.ts`에 UI 시험 서버의 env와 사전 준비(장면 데이터)가 필요하면 넣음.
    4. 배치를 바꾸지 않았다면 끝. 배치를 바꾸려면 M3a부터(`docs/testbed/ui-design.md`).
    5. `bun run check`, `bun run testbed:smoke`, `bun run test:ui` 확인.
  - **충돌 해결 원칙**: 공통 시험 파일(이슈 #19의 파일, `e2e/dashboard.e2e.ts`·`e2e/external-core.e2e.ts`)과 `dashboard-page.tsx`·`core-card.tsx`는 업스트림 것을 받음. 다운스트림이 공통 시험을 임시로 고쳐 두었던 곳은 업스트림이 같은 목적으로 고쳤으므로 업스트림 것을 받음. 다운스트림이 그 화면 파일들에 넣었던 변경은 자기 `cores/layout.tsx`의 배치로 옮김(기본 배치를 감싸거나 새로 만듦). 패널 슬롯으로 더한 탭은 그대로 동작함. 다운스트림이 `e2e/`에 더한 시험은 어댑터를 쓰는 장면 시험(`e2e/scenes/`)으로 옮김.
  - **사람에게 확인할 결정**: 이미 고유 패널이 있는 테스트베드가 M3a를 다시 할지. 이 가이드 때문에 새로 정할 것은 이것뿐이고, 나머지는 위 절차대로 합니다.
  - 검증 명령, 완료 조건, 되돌리기.
  - `docs/upgrade-guides/README.md` 목록에 한 줄.

**같은 PR에서 고칠 문서**

- `docs/testbed/verification.md`: 화면 캡처와 검토 절(`testbed:capture`, 장면 형식, `index.md`), 마일스톤별 완료 판정 표의 M3a·M3b.
- `README.md`: 명령 표에 `bun run testbed:capture`.

**수용 기준**

- `bun run testbed:capture --scene sample-busy` → 6장과 `index.md`, `--lease`를 더하면 12장, 종료 코드 0. `--scene none` → 종료 코드 1과 장면 목록.
- 시험용 배치(`alt`) 인스턴스에 `--views live,history`로 캡처 → 보기마다 한 벌(파일 이름에 보기).
- 캡처에서 열린 Run과 연결 3개가 보임(사람이 확인, PR에 붙임). `--lease` 캡처에 락 배너가 보임.
- `e2e/testbed.ts`의 `prepare`가 돌려준 env가 캡처 서버에도 적용됨(M15의 확인 방법 재사용).
- 장면 정의 단위 테스트: 이름이 겹치면 오류, `requires`가 맞지 않으면 건너뜀.
- 문서가 있고 `docs/testbed/README.md`·`CLAUDE.md`에서 링크됨. 스펙 템플릿 10절이 위 틀과 같음.
- `bun run check` 통과.

### P5 공통 규칙

- P5는 외부 코어의 **두 번째 전송**인 원격 워커(WebSocket)를 더합니다. 메시지(요청·알림·오류·seed·결함 판정)는 stdio와 같고, 원본은 [testbed/external-core-protocol.md](testbed/external-core-protocol.md)입니다. 이 절의 결정은 M21에서 그 문서 §7·§8에 옮깁니다.
- **P6 다음에 합니다.** M23은 P6의 공통 위젯(`CoreOps`의 복제 표)과 시험 구조(`e2e/external/`)를 씁니다.
- 원격 워커도 제어 서비스에서는 다른 코어와 똑같이 보입니다. REST·MCP·대시보드는 전송을 위해 따로 분기하지 않고, 복제의 출처(워커 정보)만 더 보여 줍니다.
- **stdio와 다른 점**

  | 항목                    | stdio (P4)                     | 원격 워커 (P5)                                                                   |
  | ----------------------- | ------------------------------ | -------------------------------------------------------------------------------- |
  | 프로세스                | glue가 띄움                    | 워커가 스스로 떠서 glue에 붙음(다른 머신, 컨테이너 포함)                         |
  | `replicas`              | 띄울 프로세스 수               | **기다릴 자리 수**. 자리 `r0`…`rN-1`에 워커가 붙음                               |
  | 비정상 종료             | 재시작(백오프, `maxRestarts`)  | 연결을 닫고 그 자리를 비움. **워커가 다시 붙기를 기다림**(재접속은 워커 쪽 책임) |
  | `restart`·`maxRestarts` | 씀                             | 쓰지 않음(설정에 있어도 무시하고, 매니페스트에 `transport: 'worker'`로 표시)     |
  | 로그                    | stderr 최근 50줄               | `log` 알림 최근 50건                                                             |
  | 종료                    | `shutdown` → SIGTERM → SIGKILL | `shutdown` → `shutdownGraceMs` 뒤 연결 닫기                                      |
  | 데이터면 주소           | 코어가 `replicaIndex`로 정함   | 워커가 자기 주소로 알림(glue는 고치지 않음)                                      |

### M21 — P5-a: 워커 전송과 연결 수명

**범위**

- **선언**: `defineExternalCore`에 `transport?: 'stdio' | 'worker'`(기본 `stdio`)를 더합니다. `worker`면 `command`·`env`를 받지 않습니다(있으면 선언 오류).

  ```ts
  defineExternalCore({
    id: 'py-echo-remote',
    kind: 'passive',
    title: 'Python TCP echo (워커)',
    transport: 'worker',
  });
  ```

- **엔드포인트** `GET /testbed/workers`(WebSocket 업그레이드). 제어면 REST·MCP와 같은 HTTP 서버에 둡니다.
  - **인증**: `TESTBED_CONTROL_TOKEN`이 있으면 업그레이드 요청에 `Authorization: Bearer <token>`이 필요합니다(없거나 틀리면 HTTP 401, 업그레이드하지 않음). 토큰이 없으면 **루프백 주소(127.0.0.0/8, ::1)에서 온 연결만** 받고 나머지는 HTTP 403입니다. 로컬 docker compose처럼 같은 머신 밖에서 붙어야 하면 토큰을 설정합니다.
  - 프레이밍: WebSocket 텍스트 프레임 하나에 JSON-RPC 메시지 하나. 최대 1 MiB(넘으면 닫기 코드 1009).
- **연결 순서**

  ```
  워커 → glue  hello { protocolVersion, coreId, replicaId?, worker: { name, host } }   (알림, 연결 후 5초 안)
  glue        자리 배정: replicaId를 주면 그 자리, 없으면 비어 있는 가장 앞 자리
  glue → 워커  initialize { …, replicaId, replicaIndex, replicas, seed, runId }        (이후는 stdio와 같음)
               applyConfig → [그 코어가 running이면] start
  ```

  - 거절은 WebSocket 닫기 코드와 사유 문장으로 합니다.

    | 코드 | 언제                                                                          |
    | ---- | ----------------------------------------------------------------------------- |
    | 4400 | 첫 메시지가 `hello`가 아님, 5초 안에 `hello`가 없음, `protocolVersion`이 다름 |
    | 4404 | 그런 코어가 없거나 `transport: 'worker'`가 아님                               |
    | 4409 | 지정한 자리에 이미 살아 있는 워커가 있음 / 빈 자리가 없음                     |
    | 4410 | 서버 종료 또는 `replicas`를 줄여 그 자리가 없어짐(재접속하지 말 것)           |

  - 거절마다 `testbed.core.worker.rejected`(warn, `remoteAddress`, 코드, 사유)를 남깁니다.

- **자리와 상태**
  - 부팅 때 자리 `replicas`개를 만들고 모두 `idle`(`detail: 'waiting for worker'`)로 둡니다. 전체 상태 규칙(protocol §6)은 그대로이므로, 자리가 모두 차서 `running`이 되어야 전체가 `running`입니다.
  - 첫 워커의 `initialize` 응답이 그 코어의 스키마·액션·결함 종류가 됩니다. 그 뒤 워커의 응답이 다르면 그 워커를 4400으로 닫습니다(stdio의 "복제 응답이 다름"과 같은 규칙).
  - 워커가 붙기 전에는 설정 스키마를 모르므로, 매니페스트의 `configSchema`는 빈 객체, `actions`는 빈 목록, `state`는 `idle`입니다. 설정 패치는 `CORE_NOT_RUNNING`(문장: "워커가 아직 붙지 않음")입니다.
  - `start`·`stop`·`reset`은 붙어 있는 워커에 보내고, 비어 있는 자리는 그 상태를 기억했다가 워커가 붙으면 맞춥니다(`running`이었으면 붙자마자 `start`).
- **끊김과 재접속**
  - 연결이 끊기거나 응답 확인을 연속 3번 놓치면(`unresponsive`) 연결을 닫고 그 자리를 `error`(`detail: 'disconnected'`)로 둡니다. 걸려 있던 요청은 `CORE_ERROR`(`details.coreCode: 'DISCONNECTED'`)로 실패합니다.
  - 같은 자리로 다시 붙으면 `initialize` → `applyConfig` → 끊기기 전 `running`이었으면 `start`까지 합니다.
  - 자리가 `disconnected`로 `TESTBED_WORKER_GRACE_SEC`(기본 30초)를 넘기면 `testbed.core.worker.missing`(warn)을 한 번 남깁니다. 자리는 그대로 기다립니다.
- **`replicas` 변경**: 늘리면 새 자리를 `idle`로 만듭니다. 줄이면 뒤 번호 자리의 워커에 `shutdown`을 보내고 `shutdownGraceMs` 뒤 4410으로 닫습니다. stdio와 같이 `restart-required`이고 다음 `stop` → `start`에서 적용합니다.
- **서버 종료**: 모든 코어 `stop` → 워커마다 `shutdown` → `shutdownGraceMs` 뒤 4410으로 닫기.
- **로그**: 워커 코어의 `log` 알림을 자리마다 최근 50건 보관합니다(가림 적용). `get_core_log`가 이것을 돌려줍니다.
- **이벤트 시각**: 워커가 보낸 이벤트의 `ts`는 glue가 받은 시각입니다(워커 시계에 기대지 않음). `latencyMs`는 워커가 잰 값 그대로입니다.
- **예약 이벤트**(모두 `actor: 'system'`, `core`·`replica` 채움)

  | kind                               | level | 언제                                                       |
  | ---------------------------------- | ----- | ---------------------------------------------------------- |
  | `testbed.core.worker.connected`    | info  | 자리에 워커가 붙음(`worker.name`, `host`, `remoteAddress`) |
  | `testbed.core.worker.disconnected` | warn  | 연결이 끊김(닫기 코드, 이유)                               |
  | `testbed.core.worker.rejected`     | warn  | 연결을 거절함                                              |
  | `testbed.core.worker.missing`      | warn  | 끊긴 자리가 유예 시간을 넘김                               |

- **시험용 가짜 워커**: P4의 가짜 코어(`fake-core.ts`)에 `--worker <url>` 실행 방식을 더합니다(같은 `FAKE_MODE`). 재접속은 가짜 워커가 직접 합니다(`FAKE_RECONNECT=1`).

**같은 PR에서 고칠 문서**

- `docs/testbed/external-core-protocol.md`: §2 선언의 `transport`, §7 원격 워커 전송 전체(인증, 프레이밍, `hello`, 자리, 닫기 코드, 끊김과 재접속), §8 감시의 워커 쪽 차이, §8.1 예약 이벤트 표.
- `docs/testbed/events.md` §2.1: `testbed.core.worker.*`.
- `docs/testbed/architecture.md` §3 그림의 "원격 워커 ※ 나중 단계"를 지우고, §7에 `TESTBED_WORKER_GRACE_SEC`.
- `docs/testbed/control-plane.md` §7 인증 표에 워커 행.
- `.env.example`: `TESTBED_WORKER_GRACE_SEC`(주석 포함).

**수용 기준** (모두 `bun test`, 가짜 워커 사용)

- `replicas: 2`인 워커 코어 → 부팅 후 자리 둘 `idle`, 매니페스트 `configSchema` 빈 객체. 가짜 워커 둘이 붙음(`replicaId` 생략) → `r0`·`r1` 배정, `testbed.core.worker.connected` 2건, 전체 `running`, 스키마·액션이 `initialize` 응답과 같음. `echo {text:'a'}` → `{ r0: …, r1: … }`.
- 셋째 워커 → 4409, `testbed.core.worker.rejected`. `replicaId: 'r0'`으로 붙는 워커(r0 살아 있음) → 4409.
- 첫 메시지가 `hello`가 아님 → 4400. 5초 동안 아무것도 안 보냄 → 4400. `coreId`가 stdio 코어 → 4404.
- r0 워커를 강제로 끊음 → `disconnected`, r0 `error`, 전체가 `running`이 아님, 걸려 있던 액션은 `CORE_ERROR`(`DISCONNECTED`). `FAKE_RECONNECT=1`이면 다시 붙어 `initialize` → `start`까지 되고 전체 `running`.
- `TESTBED_WORKER_GRACE_SEC=1`에서 다시 붙지 않음 → 1초 뒤 `testbed.core.worker.missing` 1건(더 나오지 않음).
- `hang-status` 워커 → 약 3초 안에 `unresponsive` → 연결 닫힘 → `disconnected`. 프로세스를 재시작하려고 하지 않음(`testbed.core.process.restarting` 없음).
- `TESTBED_CONTROL_TOKEN=x`: 토큰 없는 업그레이드 → 401, `Bearer x` → 붙음. 토큰이 없을 때 루프백이 아닌 주소에서 온 연결 → 403(시험은 원격 주소를 흉내 내는 방법을 구현에서 정함).
- `replicas` 2 → 1 패치 → `restart-required`. `stop` → `start` 후 r1 워커가 `shutdown`을 받고 4410으로 닫힘.
- 워커가 보낸 `log` 알림 → `get_core_log {core, replica:'r0'}`에 나옴(비밀값 가림).
- 서버 종료 → 모든 워커가 `shutdown`을 받고 4410으로 닫힘.
- 기존 stdio 시험이 그대로 통과. `bun run check` 통과.

### M22 — P5-b: Python 워커 실행기, 예제, docker compose

**범위**

- **워커 실행기** `python3 -m testbed_core.worker`(어댑터 `examples/python-core/testbed_core/`에 추가, 표준 라이브러리만):

  ```
  python3 -m testbed_core.worker examples/python-core/echo_core.py \
    --url ws://testbed.example:40000/testbed/workers \
    --core py-echo-remote [--replica r1] [--name worker-a]
  ```

  - 같은 코어 파일(`echo_core.py`)을 stdio와 워커 어느 쪽으로도 실행합니다. 코어 코드는 전송을 모릅니다.
  - WebSocket 클라이언트는 표준 라이브러리로 직접 구현합니다(RFC 6455 클라이언트: 핸드셰이크, 마스킹, 텍스트 프레임, ping/pong, 닫기. `wss://`는 `ssl`). 프레임 조각(continuation)도 받습니다.
  - 토큰은 환경 변수 `TESTBED_CONTROL_TOKEN`에서 읽어 `Authorization`으로 보냅니다(인자로 받지 않음. 프로세스 목록에 남지 않게).
  - **재접속**: 연결이 끊기면 1초부터 2배씩 최대 30초 간격으로 다시 붙습니다. 닫기 코드 4410이면 재접속하지 않고 끝냅니다(종료 코드 0). 4400·4404면 사유를 stderr에 쓰고 종료 코드 2로 끝냅니다. 4409면 재접속 간격으로 다시 시도합니다(자리가 빌 수 있음).
  - `--name` 기본값은 호스트 이름, `hello`의 `worker.host`는 호스트 이름입니다.

- **환경 변수**: 워커는 glue가 띄우지 않으므로 env 전달 규칙(protocol §2)이 적용되지 않고, 워커 프로세스 자신의 env를 씁니다. 코어 설정의 env 접두사는 지금처럼 코어 id에서 나옵니다(`py-echo-remote` → `PY_ECHO_REMOTE_*`). `replicas` 같은 glue 설정 필드는 glue 쪽 env(`PY_ECHO_REMOTE_REPLICAS`)로 정합니다.
- **py-echo의 워커용 주소**: 워커로 돌 때 엔드포인트 주소의 호스트는 `<접두사>_PUBLIC_HOST`(기본: 호스트 이름), 포트는 `<접두사>_PORT` 그대로입니다(`replicaIndex`를 더하는 것은 stdio일 때만). 워커마다 다른 머신·컨테이너라 포트가 겹치지 않기 때문입니다.
- **예제 코어** `py-echo-remote`: `examples/python-core/index.ts`에 `transport: 'worker'` 선언을 더하고, `TESTBED_EXAMPLE_CORES`에 `py-echo-remote`를 넣으면 등록합니다.
- **docker compose 예제** `examples/python-core/compose.yaml`
  - `testbed`: 이 저장소의 이미지(`build: ../..`), `TESTBED_EXAMPLE_CORES=py-echo-remote`, `PY_ECHO_REMOTE_REPLICAS=2`, `TESTBED_CONTROL_TOKEN`(compose의 `.env`에서), 포트 `40000`.
  - `worker`: `examples/python-core/Dockerfile.worker`(`python:3.12-slim`, `examples/python-core/` 복사)로 만든 이미지, `deploy.replicas: 2`, `PY_ECHO_REMOTE_PUBLIC_HOST`는 compose 서비스 이름, 데이터면 포트는 compose 네트워크 안에서만.
  - `examples/python-core/README.md`에 compose 실행법과 "다른 머신의 워커"(토큰 필수, `wss://` 권장) 절을 더합니다.
- **CI**: `TESTBED_REQUIRE_PYTHON=1`인 통합 시험에 Python 워커 시험을 더하고, `docker compose -f examples/python-core/compose.yaml up -d --build` 뒤 `bun run testbed:smoke --url http://localhost:40000`을 돌리는 단계를 더합니다(끝나면 `down`). 이미지 push job과는 따로 둡니다.
- **스모크 시나리오** `examples/python-core/smoke/py-echo-remote.smoke.ts`(`requires: { cores: ['py-echo-remote'] }`): 자리가 모두 `running`이 될 때까지 기다림(최대 30초) → 각 자리의 엔드포인트로 echo → `replica`별 `py-echo-remote.data.echoed` 1건 → `py_echo_remote_broadcast` → 결함 `disconnect` 한 번. 엔드포인트가 시험하는 쪽에서 닿지 않으면(compose 네트워크 안) 데이터면 단계는 건너뛰고 이유를 보고합니다.

**같은 PR에서 고칠 문서**

- `docs/testbed/external-core-protocol.md` §10: 워커 실행기, 재접속 규칙, compose 예제 링크.
- `docs/testbed/verification.md`: Python 워커 시험과 compose 스모크.
- `docs/testbed/architecture.md` §8 배포: "주-워커"를 지금 되는 것으로 바꾸고 compose 예제 링크.

**수용 기준**

- `bun run test:python`: WebSocket 클라이언트(핸드셰이크, 마스킹, 조각 프레임, ping/pong, 닫기 코드 처리), 재접속 간격, 4410·4400 처리.
- 통합 시험(Python 필요): `TESTBED_EXAMPLE_CORES=py-echo-remote PY_ECHO_REMOTE_REPLICAS=2`로 띄운 서버에 워커 실행기 둘을 붙임 → 둘 다 `running`, echo가 각 엔드포인트에서 됨, 이벤트에 `replica` `r0`·`r1`. 한 워커 프로세스를 kill → 그 자리 `disconnected` → 같은 명령으로 다시 띄우면 같은 자리(`--replica` 지정 시) 또는 빈 자리로 붙어 `running`. 서버를 종료 → 워커 실행기가 4410을 받고 종료 코드 0으로 끝남.
- 같은 Run seed로 stdio `py-echo`와 워커 `py-echo-remote`(각 복제 1)에 같은 순서로 보낼 때 결함 적용 순서가 같음(전송과 무관하게 seed가 같음을 확인).
- CI의 compose 스모크 단계가 통과.
- `bun run check` 통과.

### M23 — P5-c: 표면 반영과 합산 보기

**범위**

- **매니페스트·status**: 외부 코어마다 `transport: 'stdio' | 'worker'`. 워커 코어의 복제 상태(`ReplicaStatus`)에 `worker?: { name, host, remoteAddress, connectedAt }`, 비어 있는 자리는 `worker` 없음과 `detail`.
- **MCP `testbed_info`**: 워커 코어 줄에 전송과 자리 상태를 덧붙입니다(`py-echo-remote worker 1/2 (r0 running worker-a@10.0.0.5, r1 waiting)`).
- **대시보드**(P6의 `CoreOps` 복제 표)
  - 워커 코어면 "원격 워커" 표시, 열에 워커 이름·호스트·붙은 시각, 비어 있는 자리는 "워커를 기다리는 중"과 대기 시간.
  - 연결 패널: 워커 코어가 있으면 워커 엔드포인트 주소(`<publicUrl>`을 `ws(s)://`로 바꾼 `/testbed/workers`)와 실행 명령 예시 복사 버튼(토큰은 `${TESTBED_CONTROL_TOKEN}` 참조로만, 값은 넣지 않음).
  - 합산은 지금처럼 복제 표와 공통 통계 패널(`latencyMs`를 복제 전체에서 집계)로 봅니다. 통계 패널에 복제별로 나눠 보기 토글을 더합니다(`replica`가 있는 이벤트일 때만 보임).
- **testid**: `testbed.core-card.replica-worker(id, replicaId)`, `testbed.connection.worker-url`, `testbed.connection.copy-worker-command`, `testbed.stats.by-replica`.
- **UI 시험**(`e2e/external/`, P6 M19의 위치): 가짜 워커 둘을 붙인 인스턴스(`worker` 인스턴스, Python 불필요) → 복제 표에 워커 이름·호스트 → 한 워커를 끊음 → 그 행이 `disconnected`를 거쳐, 다시 붙이면 `running` → 연결 패널의 워커 주소 복사 → 통계 패널 복제별 보기.

**같은 PR에서 고칠 문서**

- `docs/testbed/control-plane.md`: 매니페스트의 `transport`, `ReplicaStatus.worker`, `testbed_info` 형식.
- `docs/testbed/dashboard.md`: 복제 표의 워커 열, 연결 패널의 워커 주소, 통계의 복제별 보기.
- `docs/ui-automation.md`: 위 testid.
- `docs/testbed/verification.md`: `worker` 인스턴스와 그 시험.

**수용 기준**

- 통합 시험: 매니페스트의 `transport`, 워커 정보, 빈 자리의 `detail`. `testbed_info` 줄 형식.
- UI 시험(위)이 `bun run test:ui`의 `external` 프로젝트에서 통과(가짜 워커만 쓰므로 Python 없이도 돎).
- 계약 시험(P6 M19)이 워커 코어가 있는 인스턴스에서도 통과(자리가 비어 있을 때 설정 영역이 "워커가 아직 붙지 않음"을 보여 주고 실패하지 않음).
- `bun run check`, `bun run test:ui` 통과.

## 12. 범위 밖

- 기본 Docker 이미지에 Python을 넣는 것(외부 코어를 쓰는 테스트베드가 자기 Dockerfile에서 넣음. 방법은 M13의 README)
- Python 외 언어의 참조 어댑터
- 복제 하나만 골라 다시 시작하는 조작(감시의 자동 재시작과 코어 단위 `stop`·`start`만 둠)
- `active`·`scenario` 유형의 공통 지원(단계 실행기 등) — 첫 active·scenario 테스트베드가 생길 때
- `docs/agent-usage.md` — 각 테스트베드 레포의 M4 산출물
- 대시보드에서 제어 락을 잡거나 강제로 푸는 기능(설계상 두지 않음)
- 배치가 `/` 밖의 페이지(새 라우트)를 등록하는 것 — 첫 필요가 생길 때. 지금은 보기 전환(`?view=`)으로 함
- 화면 캡처의 자동 비교(픽셀 비교). 캡처는 사람과 에이전트의 검토용
- 다른 테스트베드의 배치를 가져다 쓰는 공유 장치
- 공통 시간축(차트) 위젯과 분할 패널 — 테스트베드가 SVG로 직접 그리거나 라이브러리를 승인받아 씀(결정 45)
- 읽기 전용 액션을 주기적으로 부르는 훅(2절: 실시간 값은 주기적 status 푸시로 함)
- 관찰자(다른 프로그램이 남긴 파일을 읽는) 코어를 위한 새 유형(이슈 #19의 5) — 지금은 `passive`(데이터면 없음)로 둠
- 공용 서버 인증(OIDC) 화면 변경
- 첫 테스트베드의 M3a·M3b 진행(그 테스트베드의 스펙에서)
- 원격 워커의 자동 배포·확장(클라우드 인스턴스를 띄우는 일). 워커는 사람이나 배포 도구가 띄움
- 워커 전용 토큰(지금은 `TESTBED_CONTROL_TOKEN`을 같이 씀)과 워커별 권한
- 여러 테스트베드 인스턴스를 묶는 허브(결정 23)

## 13. 사람에게 확인할 결정

지금은 없습니다. (GHCR 이미지 공개 여부는 공개로 결정되어 3절에 있습니다.)
