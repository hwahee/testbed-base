/**
 * This testbed's UI test environment (docs/testbed/verification.md §5). The
 * file is the testbed's: a testbed repository fills it in and the common
 * runtime never edits it again.
 */
import type { UiTestbedSetup } from './support/testbed-setup';

/** UI 시험(`bun run test:ui`)과 화면 캡처(`bun run testbed:capture`)가 띄우는 서버의 준비. */
export const setup: UiTestbedSetup = {
  // 서버 env에 더할 값. 상대 경로는 저장소 루트 기준
  env: {},
  // 서버를 띄우기 전에 한 번(예: 합성 고정 데이터를 임시 디렉터리에 복사하고 env를 돌려줌)
  // async prepare({ rootDir, tmpDir }) { return { AGENT_DATA_DIR: … }; },
};
