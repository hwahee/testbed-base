# testbed-base

모든 테스트베드가 이어받는 **공통 런타임 저장소**입니다. 테스트베드는 제품(SUT)을 검증하고 동작시키는 상대
시스템으로, 사람(대시보드)과 AI 에이전트(MCP)·CI(REST)가 함께 씁니다.

- 이 저장소는 [hwahee/boilerplate](https://github.com/hwahee/boilerplate)의 이력을 이어받은 중간 레포입니다.
  보일러플레이트의 다운스트림이면서, 각 테스트베드 레포(`testbed-<이름>`)의 업스트림입니다.
- 공통 런타임(코어 호스트, 이벤트 버스, Run 저장소, 제어 서비스, 제어 락, REST/MCP/WS 어댑터, 매니페스트)을
  한 번만 만들고, 각 테스트베드는 `cores/<코어 id>/`만 더합니다.
- 공통 런타임이 쓸 만한지 확인하기 위해 샘플 코어(TCP echo)를 함께 둡니다.

## 문서

| 문서                                                  | 내용                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| [docs/testbed/](docs/testbed/README.md)               | 공통 규약의 원본. 용어, 구조, 코어 계약, 이벤트, 제어면, 검증 절차 |
| [docs/spec.md](docs/spec.md)                          | 이 저장소를 만드는 단계별 스펙(마일스톤과 수용 기준)               |
| [docs/upgrade-guides/](docs/upgrade-guides/README.md) | 업스트림을 머지한 뒤 다운스트림이 따를 가이드                      |
| [CLAUDE.md](CLAUDE.md)                                | AI 에이전트용 고정 전제                                            |

에이전트는 [docs/testbed/README.md](docs/testbed/README.md)에서 시작합니다.

## 기동

| 런타임 | 버전        |
| ------ | ----------- |
| Bun    | **1.4.2**   |
| Node   | **24.19.0** |

```bash
bun install
bun run dev        # http://localhost:40000
```

`.env` 없이 뜹니다. 기본값은 `DB_DRIVER=memory`(DB 없음), `AUTH_DRIVER=none`(로그인 없음),
`PORT=40000`(이 저장소의 포트 블록 +0, [docs/testbed/ports.md](docs/testbed/ports.md))입니다. 바꿀 값이 있으면
`cp .env.example .env` 후 고칩니다. 공통 환경 변수는
[docs/testbed/architecture.md §7](docs/testbed/architecture.md#7-공통-환경-변수)에 있습니다.

| 명령                    | 설명                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`           | 개발 모드. 서버 자동 재시작 + 클라이언트 HMR                                                                                                                                                 |
| `bun test`              | 단위 + 통합 테스트. 외부 환경 불필요                                                                                                                                                         |
| `bun run check`         | prettier → eslint → tsc → knip → test (CI·pre-push와 동일)                                                                                                                                   |
| `bun run testbed:smoke` | MCP 스모크: 서버를 띄워 공통 점검·시나리오·액션 커버리지 실행(`--url <base>`로 떠 있는 인스턴스 대상). [verification.md §4](docs/testbed/verification.md#4-mcp-스모크--bun-run-testbedsmoke) |
| `bun run build`         | 프로덕션 빌드 → `dist/` (서버가 클라이언트를 포함하는 단일 산출물)                                                                                                                           |
| `bun run start`         | 빌드 산출물 실행                                                                                                                                                                             |

제어면(REST, MCP `/testbed/mcp`)으로 조작하고 관찰합니다. 자세한 규약은 [docs/testbed/control-plane.md](docs/testbed/control-plane.md)에 있습니다.

```bash
curl -s localhost:40000/testbed/api/manifest                     # 코어, 데이터면 주소, 제어면 경로
curl -s -X POST -H 'X-Testbed-Actor: ci' localhost:40000/testbed/api/lease   # → { leaseId }
curl -s 'localhost:40000/testbed/api/events?kind=sample.data&limit=20'
bun run testbed:release                                           # 비상시: 제어 락 강제 해제(이 머신에서만)
```

Docker 이미지:

```bash
docker build -t testbed-base .
docker run --rm -p 40000-40009:40000-40009 testbed-base   # http://localhost:40000, 데이터면 40001–40009
```

`main`에 push되면 GitHub Actions가 `check`를 통과한 뒤 이미지를 빌드해
`ghcr.io/hwahee/testbed-base`에 `:<git sha>`와 `:latest`로 push합니다(`.github/workflows/ci.yml`의 `image` job).
이미지는 공개 패키지라 토큰 없이 받을 수 있습니다.

```bash
docker run --rm -p 40000-40009:40000-40009 ghcr.io/hwahee/testbed-base:latest
```

## 코드 배치

```
src/
├── server/testbed/   # 공통 런타임 (서버). 테스트베드별 코드는 cores/<코어 id>/
├── client/testbed/   # 공통 런타임 (대시보드). 테스트베드별 코드는 cores/<코어 id>/
├── shared/testbed/   # 공통 런타임 (공유 타입). 테스트베드별 코드는 cores/<코어 id>/
└── …                 # 보일러플레이트에서 이어받은 것 (아래)
```

테스트베드 레포에서는 공통 런타임(`src/*/testbed/` 중 `cores/` 밖)을 고치지 않습니다. 필요하면 이 저장소에
제안합니다.

보일러플레이트에서 이어받은 것은 그대로 씁니다: 설정 검증(`src/server/config.ts`), HTTP 미들웨어(에러 봉투,
CORS, 버전 핸드셰이크, i18n), 회원 로그인(OIDC — 공용 서버에서 사람 로그인에 씀), pub/sub, 디자인 시스템
(`/design-system`), testid 레지스트리([docs/ui-automation.md](docs/ui-automation.md)). 자세한 설명은
[보일러플레이트 README](https://github.com/hwahee/boilerplate#readme)에 있습니다. 보일러플레이트의 데모(Todos·채팅)는
지웠습니다([docs/upgrade-guides/2026-11-testbed-demo-removal.md](docs/upgrade-guides/2026-11-testbed-demo-removal.md)).

## 새 테스트베드 레포 만들기

GitHub에서는 자기 레포를 같은 계정으로 fork할 수 없으므로, 빈 레포를 만들고 이 저장소의 `main` 이력을
push합니다(이력 이어받기).

1. GitHub에서 빈 레포 `hwahee/testbed-<이름>`을 만듭니다(README·.gitignore 없이).
2. 이 저장소의 이력을 가져와 새 레포에 push합니다.

   ```bash
   git clone https://github.com/hwahee/testbed-base testbed-<이름>
   cd testbed-<이름>
   git remote rename origin upstream
   git remote add origin https://github.com/hwahee/testbed-<이름>
   git push -u origin main
   ```

3. [docs/testbed/ports.md](docs/testbed/ports.md)에 포트 블록을 등록합니다(첫 작업). 블록의 +0을
   `src/server/testbed/cores/port-block.ts`의 `PORT_BLOCK`에 쓰고, `Dockerfile`·`.env.example`·CI 이미지 job의
   포트를 같은 블록으로 맞춥니다.
4. `docs/spec.md`를 [스펙 템플릿](docs/testbed/spec-template.md)으로 다시 쓰고, `package.json`의 `name`과
   워크플로의 `IMAGE`를 새 레포 이름으로 바꿉니다.
5. 코어는 `src/*/testbed/cores/<코어 id>/`에 만들고 서버 `src/server/testbed/cores/index.ts`의 `CORES`에 넣습니다.
   샘플 코어는 그 파일의 `import { sampleCore } from '../testing/sample-core';` 한 줄과 목록의 `sampleCore`만
   빼면 됩니다. `src/server/testbed/testing/`(샘플 코어 등 공통 시험의 재료)은 지우거나 고치지 않습니다.
6. UI 시험 서버에 env나 사전 준비(고정 데이터 등)가 필요하면 `e2e/testbed.ts`에 적습니다.

이후 이 저장소의 변경은 `upstream`에서 수동으로 머지합니다.

```bash
git fetch upstream
git merge upstream/main
```

머지한 뒤에는 [docs/upgrade-guides/](docs/upgrade-guides/README.md)에서 아직 적용하지 않은 가이드를 오래된
것부터 따릅니다. 이 저장소도 같은 방법으로 보일러플레이트의 변경을 받습니다(`upstream` =
`https://github.com/hwahee/boilerplate`).
