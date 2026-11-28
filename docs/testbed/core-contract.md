# 코어 계약

코어는 테스트베드의 실제 기능입니다. 기본은 Bun 프로세스 안에서 도는 **in-proc 코어**이고, 그 밖의 경우는 [external-core-protocol.md](external-core-protocol.md)를 따릅니다.

> 외부 프로세스 코어는 `defineExternalCore`(`src/server/testbed/external/define.ts`)로 선언해 같은 `CORES` 목록에 넣습니다. 설정 스키마·액션·결함 종류는 프로세스가 `initialize`로 알립니다([external-core-protocol.md](external-core-protocol.md) §2, §4.1).

## 1. 정의

정의는 `src/server/testbed/core.ts`에 있고, 상태·엔드포인트처럼 대시보드도 보는 타입은 `src/shared/testbed/core.ts`에 있습니다. 코어 호스트는 `src/server/testbed/core-host.ts`, 이 테스트베드의 코어 목록은 `src/server/testbed/cores/index.ts`(`CORES`)입니다.

```ts
// 모든 코어 설정이 갖는 공통 필드 — 호스트가 읽음
interface BaseCoreConfig {
  autoStart: boolean; // 부팅 때 시작. passive 기본 true, active·scenario 기본 false
  eventLevel: 'debug' | 'info'; // info면 그 코어의 debug 이벤트를 버림
  faults: FaultRule[]; // faultRuleSchema(@shared/testbed/faults)로 검증
}

interface CoreDefinition<C extends BaseCoreConfig, I extends CoreInstance> {
  id: string; // 'echo', 'llm' — 이벤트 kind 접두사, env 접두사, MCP 도구 접두사로 쓰임
  kind: 'passive' | 'active' | 'scenario';
  title: string;
  configSchema: Validator<C>; // @shared/validation 파사드. 매니페스트에는 JSON Schema로 노출
  defaultConfig(env): unknown; // env는 기본값만 줌. 호스트가 configSchema로 검증(잘못된 env는 부팅 실패)
  actions?: Record<string, ActionDefinition<I>>; // 고유 동작 (§4)
  faults?: FaultKind[]; // 지원하는 결함 종류. 다른 종류를 쓰는 규칙은 설정 검증에서 거절
  create(ctx: CoreContext<C>): I;
}

interface CoreContext<C> {
  emit(e: CoreEventInput): void; // core·actor(기본 'product')와 봉투의 공통 필드는 런타임이 채움. kind는 '<id>.'로 시작해야 함. 액션 실행 중 그 caller의 actor로 낸 이벤트에는 caller가 붙음(§4)
  log: Logger;
  rng: SeededRng; // 모든 무작위는 이것으로. 열린 Run의 seed, 없으면 부팅 seed
  run(): RunMeta | null; // 열린 Run, 없으면 null
  faults: FaultDecider; // 결함 판정 도우미. 적용하면 testbed.fault.injected가 남음
  signal: AbortSignal; // stop/shutdown 때 abort
  config(): C; // 지금 설정. 쓰는 자리에서 읽어야 런타임 변경이 바로 적용됨
  bindHost: string; // TESTBED_BIND_HOST
  publicHost: string; // TESTBED_PUBLIC_URL의 호스트 — endpoints의 url에 씀
}

interface CoreInstance {
  start(): Promise<void>; // 던지면 error 상태. 오류의 code(예: EADDRINUSE)가 detail이 됨
  stop(): Promise<void>;
  reset?(): Promise<void>; // 내부 상태·카운터 초기화. 포트는 유지. 결함 times는 호스트가 초기화
  applyConfig(next: C): Promise<'applied' | 'restart-required'>; // running일 때만 불림. 설정은 이미 저장됨
  status(): { endpoints; counters }; // id·kind·title·state·detail은 호스트가 붙임(CoreStatus)
}
```

## 2. 규칙

- **id**: 소문자, 숫자, `-`만 씁니다(`^[a-z][a-z0-9-]*$`). MCP 도구 이름에서는 `-`를 `_`로 바꿉니다. `testbed`는 공통 런타임 자신의 자리라 쓰지 않습니다.
- **코드 위치**: 코어 코드는 `src/server/testbed/cores/<id>/`, 이벤트 payload 스키마는 `src/shared/testbed/cores/<id>/events.ts`, 고유 화면은 `src/client/testbed/cores/<id>/`, MCP 스모크 시나리오는 `src/server/testbed/cores/<id>/smoke/*.smoke.ts`([verification.md](verification.md) §4)에 둡니다.
- **시험용 코어**: 공통 런타임의 샘플 코어는 `src/server/testbed/testing/sample-core/`(시나리오는 그 아래 `smoke/`, 이벤트 타입은 `src/shared/testbed/testing/sample-core/events.ts`), 관찰 코어는 `testing/observer-core/`에 있습니다. 코어를 만드는 예로 읽어도 되지만, 테스트베드는 이 파일들을 고치지 않습니다(공통 시험의 재료). `Math.random` 금지 규칙은 `testing/*-core/`에도 적용됩니다.
- **무작위**: `Math.random()`을 쓰지 않습니다. `ctx.rng`만 씁니다(ESLint가 `src/server/testbed/cores/**`에서 막음).
- **관찰 가능한 일은 모두 이벤트로** 남기고 `summary`를 반드시 채웁니다([events.md](events.md)).
- **비밀값**은 이벤트에 담기 전에 공통 가림 유틸을 거칩니다.
- **env**는 `defaultConfig`에서만 읽습니다. 코어 안에서 `process.env`를 직접 읽지 않습니다.

## 3. 상태 기계

```
idle → starting → running → stopping → stopped
  └──────────── 어느 상태에서든 → error
```

- 상태가 바뀔 때마다 `testbed.core.state` 이벤트가 나갑니다(`actor: 'system'`, payload `{ core, from, to, detail? }`).
- `error`에서는 `start`로 다시 시작할 수 있습니다. `error`로 갈 때 이벤트의 `level`은 `error`이고, `payload.detail`에 원인을 담습니다.
- `status().endpoints`는 데이터면 주소 목록(`{ name, protocol, url, replica? }`)입니다. 외부 코어는 복제마다 따로 나열하고 `replica`를 붙입니다. 매니페스트, 대시보드 연결 패널, MCP `testbed_info`에 그대로 나타납니다. `url`은 `TESTBED_PUBLIC_URL`의 호스트를 씁니다.
- 부팅 시 자동 시작 여부는 코어 설정 `autoStart`로 정합니다. passive는 기본 `true`, active·scenario는 기본 `false`입니다.
- `applyConfig`가 `restart-required`를 돌려주면 설정은 저장되지만 적용되지 않습니다. 제어 서비스가 `RESTART_REQUIRED`로 알리고, 다음 `stop` → `start` 때 적용됩니다. 코어가 running이 아니면 `applyConfig`를 부르지 않고 저장만 합니다(`applied`).
- 외부 코어의 상태(`CoreStatus`)에는 `external: true`와 `replicas: ReplicaStatus[]`(`{ id, state, detail?, pid?, restarts, lastPingMs?, counters, endpoints }`)가 붙습니다(`src/shared/testbed/core.ts`). 위의 `state`는 복제들의 전체 상태(`error` → `starting` → `stopping` → `stopped` → `idle` → `running` 순으로 앞선 것), `counters`는 복제 카운터의 합입니다([external-core-protocol.md](external-core-protocol.md) §6).
- 액션은 코어가 `running`일 때만 실행됩니다. 아니면 `CORE_NOT_RUNNING`입니다. 입력과 출력은 액션의 `input`·`output` 검증기를 거칩니다.

## 4. 액션

공통 동작(start, stop, config 등)으로 표현되지 않는 기능은 액션으로 등록합니다.

```ts
interface ActionDefinition<I extends CoreInstance> {
  title: string;
  description: string; // 에이전트와 사람이 읽는 설명 — 부작용, 단위, 상한. 한국어 평문(대시보드에 그대로 보이므로 백틱 같은 마크다운 없이). 락 필요 여부는 적지 않음(MCP가 mutating으로 "(제어 락 필요)"·"(읽기 전용)"을 붙임)
  input: Validator<unknown>;
  output: Validator<unknown>;
  mutating: boolean; // true면 제어 락이 필요함
  surfaces?: ('rest' | 'mcp' | 'ui')[]; // 기본: 셋 다
  run(instance: I, input: unknown, caller: Caller): Promise<unknown>; // 검증된 입력으로 불림
  summarize?(output: unknown): string; // MCP content에 쓸 결과 한 문장(한국어). 없으면 출력 JSON
}
```

- 액션이 일으킨 이벤트는 `actor: caller.actor`로 냅니다. 액션을 실행하는 동안(그 비동기 흐름 안에서) 그 actor로 낸 이벤트에는 런타임이 봉투의 `caller`(이름과 세션 앞 4자, [events.md](events.md) §2)를 붙이므로, 에이전트 타임라인이 어느 에이전트의 일인지 보여 줍니다. 그 밖의 때에 낸 이벤트에 붙이려면 `emit({ …, caller })`로 직접 넘깁니다(런타임이 앞 4자로 자름).
- 액션 하나를 등록하면 세 곳에 **자동 노출**됩니다. REST·MCP·UI에 따로 구현하지 않습니다.
  - REST: `POST /testbed/api/cores/:core/actions/:name`
  - MCP 도구: `<core>_<name>`
  - 대시보드 코어 카드: 액션 버튼과 입력 폼
- `surfaces`로 한쪽을 빼면 스펙의 "제어 표면" 표에 이유를 적습니다.
- 액션 이름은 `snake_case`입니다. 예: LLM 대역 `enqueue_response`, 부하 발생기 `fire_once`, 시나리오 `run_scenario`.
- 외부 코어는 같은 정의를 `initialize` 응답으로 알립니다([external-core-protocol.md](external-core-protocol.md)).
