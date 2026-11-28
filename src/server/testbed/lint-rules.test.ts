/**
 * The ESLint rule that keeps cores reproducible: `Math.random()` fails lint
 * under `src/server/testbed/cores/**` and the common runtime's test cores
 * `src/server/testbed/testing/*-core/**` (docs/testbed/faults-and-seed.md §2).
 * Lints source text against the repository's own config; type-aware rules
 * are off because the text is not a file in the TypeScript project.
 */
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

const root = join(import.meta.dir, '../../..');
const eslint = new ESLint({ cwd: root, overrideConfig: [tseslint.configs.disableTypeChecked] });

async function ruleIds(code: string, file: string): Promise<(string | null)[]> {
  const [result] = await eslint.lintText(code, { filePath: join(root, file) });
  return result?.messages.map((message) => message.ruleId) ?? [];
}

describe('no Math.random in cores', () => {
  test('a core using Math.random() fails lint', async () => {
    expect(
      await ruleIds(
        'export const roll = Math.random();\n',
        'src/server/testbed/cores/sample/roll.ts',
      ),
    ).toEqual(['no-restricted-properties']);
  });

  test('the common runtime’s test cores (testing/*-core) are cores too', async () => {
    expect(
      await ruleIds(
        'export const roll = Math.random();\n',
        'src/server/testbed/testing/sample-core/roll.ts',
      ),
    ).toEqual(['no-restricted-properties']);
  });

  test('outside cores it is not this rule’s business', async () => {
    expect(
      await ruleIds('export const roll = Math.random();\n', 'src/server/testbed/events/roll.ts'),
    ).toEqual([]);
  });
});
