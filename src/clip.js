import { spawnSync } from 'node:child_process';

/**
 * Put `cd <dir>` on the clipboard.
 *
 * `clip.exe` ships with Windows, so this costs no dependency. Piping through
 * PowerShell would prepend a BOM; writing the bytes straight from here doesn't.
 *
 * Synchronous on purpose — it's instant, and by the time this runs the spinner
 * has already stopped, so there's nothing animating for it to freeze.
 *
 * No trailing newline: a paste should land ready for Enter, not run on arrival.
 *
 * @param {string} dir
 * @returns {boolean} whether it took
 */
export function copyCd(dir) {
  const r = spawnSync('clip.exe', { input: `cd ${dir}`, encoding: 'utf8' });
  return r.status === 0;
}
