import { spawnSync } from 'node:child_process';

import { CLIPBOARDS, onPath } from './platform.js';

/**
 * Put `cd <dir>` on the clipboard.
 *
 * Whatever the OS already has: `clip.exe` ships with Windows, `wl-copy` comes
 * with a Wayland desktop, `xclip` and `xsel` cover X11. So this costs no
 * dependency anywhere. Piping through PowerShell would prepend a BOM; writing
 * the bytes straight from here doesn't.
 *
 * A machine with none of them gets `false`, and the `→ cd <path>` line prints
 * without `(copied)` — which was always the part that mattered.
 *
 * Synchronous on purpose — it's instant, and by the time this runs the spinner
 * has already stopped, so there's nothing animating for it to freeze.
 *
 * No trailing newline: a paste should land ready for Enter, not run on arrival.
 *
 * stdout/stderr are ignored, not piped. `wl-copy` forks a background process to
 * hold the clipboard and that child keeps the inherited stdout/stderr pipes
 * open, so a piped `spawnSync` never sees EOF on them and hangs forever waiting
 * for output nothing was going to read anyway. Only stdin needs a pipe, to get
 * the text in.
 *
 * @param {string} dir
 * @returns {boolean} whether it took
 */
export function copyCd(dir) {
  const tool = CLIPBOARDS.find((c) => onPath(c.cmd));
  if (!tool) return false;

  const r = spawnSync(tool.cmd, tool.args, {
    input: `cd ${dir}`,
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  return r.status === 0;
}
