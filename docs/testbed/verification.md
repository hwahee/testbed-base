# 검증

마일스톤은 그 마일스톤의 수용 기준을 모두 확인한 뒤에 끝냅니다.

## 1. 단계

| 단계       | 도구                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| 정적·단위  | `bun run check` (prettier → eslint → tsc → knip → test. CI와 같음)                                                        |
| 통합       | `bun test` — 코어를 in-memory 인스턴스로 띄워 실제 소켓으로 데이터면을 시험                                               |
| MCP 스모크 | `bun run testbed:smoke` — 인스턴스를 띄우고 MCP 클라이언트로 공통 점검, 스펙 수용 기준 시나리오, 액션 커버리지를 실행(§4) |
| UI 자동화  | `bun run test:ui` — Playwright + `TESTID`. 핵심 흐름과 락 상태(조작 비활성)(§5)                                           |
| 자기 사용  | 구현한 에이전트가 자기 `.mcp.json`에 테스트베드를 붙여 수용 기준을 직접 호출해 봄(권장)                                   |

## 2. 마일스톤별 완료 판정

| M   | 판정                                                                            |
| --- | ------------------------------------------------------------------------------- |
| M1  | 코어 단위·통합 테스트 통과, `bun run check` 통과                                |
| M2  | `bun run testbed:smoke` 통과(커버리지 포함)                                     |
| M3  | `bun run test:ui` 통과(핵심 흐름과 락 상태)                                     |
| M4  | 이미지를 띄운 뒤 `bun run testbed:smoke --url` 통과, `docs/agent-usage.md` 존재 |

## 3. 통합 테스트 규칙

- 데이터면 시험은 실제 소켓을 씁니다. 포트는 `0`(임의 포트)으로 열고, `status().endpoints`에서 실제 주소를 읽습니다. 고정 포트에 기대지 않습니다.
- 무작위가 끼는 시험은 seed를 고정합니다.
- 시간에 기대는 시험은 이벤트를 기다립니다(`waitFor`). `sleep`으로 기다리지 않습니다.
- 결함 주입은 종류마다 하나 이상의 시험을 둡니다.

### 3.1 Python이 필요한 시험

- 외부 코어의 Python 참조 구현(`examples/python-core/`)은 Python 3.11 이상이 있어야 시험할 수 있습니다.
  - `bun run test:python`: 어댑터와 py-echo의 Python 단위 시험(`examples/python-core/tests/`, `unittest`).
  - `bun test` 중 Python이 필요한 것(언어 간 재현성, py-echo 통합)은 `examples/python-core/python.ts`의 `describePython`으로 묶습니다. `python3`(3.11 이상)이 없으면 이유를 출력하고 건너뜁니다.
  - `TESTBED_REQUIRE_PYTHON=1`이면 건너뛰지 않고 실패합니다. CI는 이 값으로 `bun test`를 돌립니다.

## 4. MCP 스모크 — `bun run testbed:smoke`

구현은 `src/server/testbed/smoke/`(실행기), `scripts/testbed-smoke.ts`(명령)입니다.

### 4.1 실행 방식

| 명령                                 | 대상                                                                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run testbed:smoke`              | 빈 포트로 이 저장소의 서버를 자식 프로세스로 띄웁니다(`TESTBED_RUN_STORE=memory`, 코어 포트 `<CORE_ID>_PORT`는 모두 `0`). `/api/health/ready`가 200이 되면 시작하고, 끝나면 종료합니다. |
| `bun run testbed:smoke --url <base>` | 이미 떠 있는 인스턴스(로컬 `bun run dev` 또는 Docker 컨테이너). 시나리오는 이 체크아웃의 파일을 씁니다.                                                                                 |
| `--only <이름>`                      | 시나리오 하나만. 공통 점검은 그대로 돌고, 액션 커버리지는 `SKIP`입니다.                                                                                                                 |
| `--json <경로>`                      | 결과(공통 점검, 시나리오별 결과, 커버리지, `exitCode`)를 JSON으로 저장                                                                                                                  |

- `TESTBED_CONTROL_TOKEN` 환경 변수가 있으면 MCP와 에이전트·CI REST 호출에 Bearer로 보냅니다.
- 종료 코드: 모두 통과(건너뜀 포함) `0`, 하나라도 실패(커버리지 포함) `1`, 서버를 띄우지 못하거나 연결하지 못함 `2`.
- Docker 컨테이너를 대상으로 할 때는 데이터면 포트까지 열어야 합니다. 포트 블록 전체를 엽니다(예: `-p 40000-40009:40000-40009`, [ports.md](ports.md)).

### 4.2 순서

1. **공통 점검**(`common`, 모든 테스트베드에서 같음): 공통 도구 16개를 모두 한 번 이상 부르고, 두 세션 사이의 락 배타성(`LEASE_HELD`), 락 보유 중 사람 REST 조작의 423, `release_control` 뒤 해제를 확인합니다. 코어를 stop → start → reset 하므로 포트 `0`으로 연 데이터면은 새 포트가 됩니다.
2. **시나리오**: `src/server/testbed/cores/*/smoke/*.smoke.ts`와 예제 코어의 `examples/*/smoke/*.smoke.ts`를 시나리오 이름순으로 실행합니다. 예제 코어 시나리오는 `TESTBED_EXAMPLE_CORES`로 그 코어를 켜지 않으면 `requires`로 `SKIP`입니다. 시나리오마다 매니페스트를 새로 읽고(데이터면 주소가 바뀌었을 수 있음) 새 MCP 세션을 씁니다.
3. **액션 커버리지**: 매니페스트에서 MCP에 노출된 액션(`<core>_<action>`)이 건너뛰지 않은 시나리오에서 한 번 이상 불렸는지(`t.call`·`t.callError`) 확인합니다. 안 불린 액션이 있으면 실패입니다.

- 각 시나리오(공통 점검 포함)가 끝나면 통과·실패와 관계없이 정리합니다: 열린 Run이 있으면 그 시나리오의 세션으로 `end_run`, 모든 세션 `release_control` 후 세션 종료(`DELETE`), 연 TCP 연결 닫기.
- 시나리오 하나의 제한 시간은 기본 60초(`timeoutMs`로 바꿈)입니다. 넘으면 그때의 단계로 `FAIL`을 보고하고 정리 단계로 갑니다.

### 4.3 시나리오 형식

```ts
import { defineSmoke } from '@server/testbed/smoke';

export default defineSmoke({
  name: 'sample-echo', // 모든 시나리오에서 유일. 보고와 --only에 씀
  title: '보낸 바이트가 그대로 돌아오고 이벤트가 남음',
  spec: 'docs/spec.md §11 M3', // 근거가 된 수용 기준
  requires: { cores: ['sample'] }, // 매니페스트에 없으면 SKIP
  async run(t) {
    await t.call('start_run', { label: 'smoke:sample-echo' });
    const echo = await t.tcp(t.endpoint('sample', 'echo'));
    echo.send('hello');
    t.equal(await echo.receive(5), 'hello');
    await t.expectCheck({ kind: 'sample.data.echoed' }, { count: '==1' });
    await t.call('end_run', {});
  },
});
```

| `t`의 것                                          | 하는 일                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `t.call(tool, input)`                             | MCP 도구 호출. `structuredContent`를 돌려줌. `isError`면 실패                                                           |
| `t.callError(tool, input, code)`                  | 오류가 나야 하는 호출. 오류 `{ code, message, details }`를 돌려줌. `code`가 다르거나 성공하면 실패                      |
| `await t.newSession(name?)`                       | 다른 MCP 세션(다른 에이전트 흉내). 같은 `call`·`callError`를 가짐                                                       |
| `t.rest(method, path, { body?, actor?, lease? })` | `/testbed/api` 아래 REST 호출. `actor`가 없으면 사람, `agent`·`ci`면 그 actor(토큰이 있으면 Bearer). `{ status, body }` |
| `t.manifest`, `t.endpoint(core, name)`            | 매니페스트와 데이터면 주소                                                                                              |
| `await t.tcp(url)`                                | TCP 클라이언트: `send(data)`, `receive(bytes, timeoutMs?)`(UTF-8), `receiveBytes(...)`, `closed(timeoutMs?)`, `close()` |
| `t.expectCheck(filter, expect)`                   | `check` 후 `pass`가 아니면 실패(일치한 이벤트 줄을 실패 메시지에 담음)                                                  |
| `t.waitFor(filter, count?, timeoutMs?)`           | `wait_for` 후 `timedOut`이면 실패. `after` 없이 부르면 부른 뒤의 이벤트만 셈                                            |
| `t.equal(a, b, message?)`, `t.ok(cond, message?)` | 단언(`equal`은 깊은 비교)                                                                                               |

- 시나리오 파일은 `bun test` 대상이 아니고(`*.smoke.ts`), `knip.json`의 `entry`에 들어 있습니다(동적으로 불러오므로).
- 데이터면 동작이 이벤트를 남긴 뒤 응답하는 경우(예: 샘플 코어의 echo·close)에는 응답을 받은 뒤 바로 `t.expectCheck`로 셀 수 있습니다. 그렇지 않으면 커서(`after`)를 잡아 두고 `t.waitFor`로 기다립니다.

### 4.4 보고

시나리오마다 한 줄, 마지막에 커버리지와 합계를 씁니다.

```
PASS common (216ms)
PASS sample-broadcast (154ms)
FAIL sample-echo (12ms) at equal (echoed bytes): expected "HELLO", got "hello"
SKIP needs-nope (0ms) — requires core nope
PASS coverage (sample_broadcast)
total: 3 pass, 1 fail, 1 skip; coverage PASS
```

### 4.5 CI

- `ci.yml`의 `ci` job: `actions/setup-python`(3.11) → `bun run test:python` → `TESTBED_REQUIRE_PYTHON=1 bun test` → `bun run testbed:smoke` → 예제 코어를 켠 스모크(`TESTBED_EXAMPLE_CORES=py-echo PY_ECHO_REPLICAS=2 bun run testbed:smoke`).
- 이미지 job(`main` push만): 이미지를 빌드하고(`load`), 컨테이너를 띄워(`-p 40000-40009:40000-40009`) `bun run testbed:smoke --url http://localhost:40000`이 통과해야 GHCR에 push합니다. 테스트베드 레포는 `IMAGE`와 포트 블록만 바꿉니다.

## 5. UI 자동화 — `bun run test:ui`

- 위치: 시험은 `e2e/*.e2e.ts`(파일 이름이 `.e2e.ts`라 `bun test` 대상이 아님), 설정은 `playwright.config.ts`, 실행 스크립트는 `scripts/test-ui.ts`. `@playwright/test`는 개발 의존성이고 Chromium만 씁니다.
- 실행: `bun run test:ui`가 MCP 스모크와 같은 모듈(`src/server/testbed/smoke/server.ts`)로 서버를 빈 포트에 띄우고(`TESTBED_RUN_STORE=memory`, 코어 포트 `0`), 주소를 `TESTBED_UI_URL`로 넘겨 `playwright test`를 돌린 뒤 종료합니다. 이 기본 인스턴스에는 테스트베드 소유 파일 `e2e/testbed.ts`의 준비(`setup.env`와, 서버를 띄우기 전에 한 번 부르는 `setup.prepare({ rootDir, tmpDir })`가 돌려준 env)를 더합니다. 상대 경로는 저장소 루트(서버의 작업 디렉터리) 기준이고, `tmpDir`은 서버를 멈출 때 지웁니다. 공통 런타임의 변형 인스턴스(Python 예제 등)에는 더하지 않습니다. 타입과 합치는 함수는 `e2e/support/testbed-setup.ts`(공통 런타임)입니다. 뒤에 붙인 인자는 Playwright로 넘어갑니다(예: `bun run test:ui -g "lease"`). 서버를 띄우지 못하면 종료 코드 2입니다.
- 시험들은 인스턴스 하나를 같이 쓰므로 하나씩(`workers: 1`) 돌고, 시험마다 처음에 상태를 되돌립니다(`e2e/helpers.ts`의 `resetTestbed`: 로컬 전용 경로로 락 강제 해제, 열린 Run 닫기, 결함 규칙 비우기, 코어 시작).
- 제품과 에이전트 흉내는 브라우저 밖에서 합니다. 데이터면은 TCP(`tcp()`), 락과 설정은 REST(`api()`, `takeLease()`, actor `agent`)입니다.
- 선택자는 ARIA 우선(`getByRole`, `getByLabel`), 그다음 `TESTID`([../ui-automation.md](../ui-automation.md))입니다. 화면 언어는 `en-US`로 고정합니다.
- 페이지가 아직 모르는 변화를 만들어야 할 때(예: 저장 직전에 락이 걸림)는 `gateLiveUpdates(page)`로 `/testbed/ws` 메시지를 잠시 붙잡아 둡니다(`page.routeWebSocket`).
- 외부 코어 시험(9번, `e2e/external-core.e2e.ts`)은 Python 예제 코어가 필요합니다. `python3`(3.11 이상)이 있으면 `bun run test:ui`가 두 번째 인스턴스를 `TESTBED_EXAMPLE_CORES=py-echo PY_ECHO_REPLICAS=2`로 띄우고 주소를 `TESTBED_UI_PY_URL`로 넘깁니다. 없으면 9번은 건너뛰고(이유는 `TESTBED_UI_PYTHON_MISSING`), `TESTBED_REQUIRE_PYTHON=1`이면 실패합니다.
- CI(`ci.yml`의 `ci` job): 스모크 뒤에 `bunx playwright install --with-deps chromium`과 `TESTBED_REQUIRE_PYTHON=1 bun run test:ui`. 실패하면 `playwright-report/`와 `test-results/`(실패 화면 캡처)를 아티팩트로 올립니다.
- 샘플 코어를 가정하는 시험(`e2e/dashboard.e2e.ts`)은 매니페스트에 `sample`이 없으면(테스트베드가 `CORES`에서 뺐을 때) 이유를 출력하고 건너뜁니다(M19에서 계약 시험과 샘플 코어 시험으로 다시 씀).
- **다운스트림 흉내**(`bun run test:downstream`, `src/server/testbed/downstream.integration.test.ts`): 이 작업 트리를 임시 사본으로 복사해 `package.json`의 `name`을 `testbed-demo`로, `PORT_BLOCK`을 `40990`으로, `CORES`를 관찰 코어 하나로 바꾼 뒤 `bun test`(Python 시험 제외: `TESTBED_SKIP_PYTHON=1`), `bun run testbed:smoke`, `bun run test:ui`가 통과하는지 봅니다. 몇 분 걸리므로 `TESTBED_DOWNSTREAM=1`일 때만 돌고(UI는 `TESTBED_DOWNSTREAM_UI=1`), CI가 돌립니다.

testbed-base의 시험은 `docs/spec.md` §11 M10의 수용 기준 1–8(`e2e/dashboard.e2e.ts`)과 M14의 9번(`e2e/external-core.e2e.ts`)입니다. 테스트베드 레포는 고유 화면의 시험을 `e2e/` 아래에 더합니다.
