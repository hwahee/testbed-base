/** Whether `python3` (3.11 or newer) can run the Python reference core here. */

const MIN = [3, 11] as const;

/** Why Python cannot be used here, or `undefined` when it can. */
export function missingPython(): string | undefined {
  // The downstream simulation (scripts/test-downstream.ts) runs without the Python tests.
  if (process.env.TESTBED_SKIP_PYTHON === '1') return 'TESTBED_SKIP_PYTHON=1';
  try {
    const probe = Bun.spawnSync([
      'python3',
      '-c',
      'import sys; print("%d.%d" % sys.version_info[:2])',
    ]);
    if (probe.exitCode !== 0) return `python3 exited with ${probe.exitCode}`;
    const version = probe.stdout.toString().trim();
    const [major = 0, minor = 0] = version.split('.').map(Number);
    if (major < MIN[0] || (major === MIN[0] && minor < MIN[1])) {
      return `python3 is ${version}, ${MIN.join('.')} or newer is needed`;
    }
    return undefined;
  } catch {
    return 'python3 is not on PATH';
  }
}
