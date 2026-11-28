# 테스트베드 공통 문서

이 저장소(`testbed-base`)와 여기서 출발한 모든 테스트베드 레포가 따르는 공통 규약입니다.
주 독자는 테스트베드를 구현하는 AI 에이전트입니다. **에이전트는 이 파일에서 시작합니다.**

## 읽는 순서

1. [architecture.md](architecture.md) — 용어, 전체 구조, 원칙, 확정된 결정, 공통 환경 변수. 모든 작업 전에 읽습니다.
2. 작업에 해당하는 문서를 읽습니다.

| 문서                                                   | 다루는 것                                                           | 이럴 때 읽음                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------- |
| [core-contract.md](core-contract.md)                   | in-proc 코어 계약, 상태 기계, 액션                                  | 코어를 만들거나 고칠 때                      |
| [external-core-protocol.md](external-core-protocol.md) | 외부 프로세스 코어의 JSON-RPC 메시지, 감시, 복제                    | Bun 밖에서 도는 코어가 필요할 때             |
| [events.md](events.md)                                 | 이벤트 버스, 링버퍼, Run 저장소, 공통 이벤트 봉투, 커서             | 이벤트를 내보내거나 조회할 때                |
| [runs-and-checks.md](runs-and-checks.md)               | Run, check(판정)                                                    | 시험 구간과 판정을 다룰 때                   |
| [control-plane.md](control-plane.md)                   | 제어 서비스, 제어 락, REST, MCP, WS, 매니페스트, 인증               | 제어면(조작·관찰 통로)을 다룰 때             |
| [dashboard.md](dashboard.md)                           | 대시보드 프레임과 배치, 공통 컴포넌트, 기본 배치, 패널 슬롯, testid | 화면을 만들 때                               |
| [faults-and-seed.md](faults-and-seed.md)               | 공통 결함 주입 모델, seed 재현성                                    | 결함 주입이나 무작위 동작을 다룰 때          |
| [ports.md](ports.md)                                   | 포트 블록 대장, WSL2/Windows 주의                                   | 새 테스트베드를 만들 때(블록 등록이 첫 작업) |
| [spec-template.md](spec-template.md)                   | 각 테스트베드 `docs/spec.md`의 틀과 좋은 스펙의 기준                | 스펙을 쓰거나 읽을 때                        |
| [verification.md](verification.md)                     | 검증 단계와 마일스톤 완료 판정                                      | 마일스톤을 끝낼 때                           |

## 원본의 위치

- 이 테스트베드(레포)의 구현 세부사항은 `docs/spec.md`가 원본입니다. `testbed-base` 자신도 `docs/spec.md`에 단계별 스펙을 둡니다.
- 공통 규약은 이 폴더가 원본입니다. 스펙은 공통 규약을 다시 쓰지 않고 참조만 합니다.
- 공통 규약과 스펙이 어긋나 보이면 스스로 정하지 않고 멈춰서 사람에게 묻습니다.

## 문서 갱신 규칙

- 공통 런타임 코드를 바꾸는 PR은 이 폴더의 해당 문서를 같은 PR에서 고칩니다.
- 다운스트림(각 테스트베드 레포)이 머지만으로 끝나지 않는 변경이면 [../upgrade-guides/](../upgrade-guides/README.md)에 가이드를 추가합니다.
