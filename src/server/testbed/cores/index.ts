/**
 * The cores this testbed runs. A testbed repository lists its own cores here
 * (this file is under `cores/`, so it is the testbed's to edit).
 *
 * The sample core lives with the common runtime's tests
 * (`../testing/sample-core`). A testbed drops the sample line below and adds
 * its own cores; it does not delete or edit `testing/sample-core/`.
 */
import type { AnyCoreDefinition } from '../core-host';
import { sampleCore } from '../testing/sample-core'; // 테스트베드는 이 줄을 빼고 자기 코어를 넣음

export const CORES: readonly AnyCoreDefinition[] = [sampleCore];
