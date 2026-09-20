import { spawn, spawnSync } from 'node:child_process';

import { GH_INSTALL, onPath } from './platform.js';

/**
 * Run a command without blocking the event loop. Never rejects.
 *
 * `spawnSync` freezes everything until the child exits, which means a spinner
 * started beforehand never gets to tick — it just sits there on its first frame.
 * Anything run while something is animating has to go through here.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string, shell?: boolean }} [opts]
 * @returns {Promise<{ ok: boolean, out: string, err: string }>}
 */
export function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      // .cmd/.bat shims (like `code`) can't be spawned directly on Windows.
      shell: opts.shell ?? false,
    });

    let out = '';
    let err = '';
    child.stdout?.setEncoding('utf8').on('data', (d) => (out += d));
    child.stderr?.setEncoding('utf8').on('data', (d) => (err += d));

    child.on('error', (e) => resolve({ ok: false, out: out.trim(), err: e.message }));
    child.on('close', (code) =>
      resolve({ ok: code === 0, out: out.trim(), err: err.trim() }),
    );
  });
}

/**
 * Run a command and capture the result. Never throws.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string, shell?: boolean }} [opts]
 * @returns {{ ok: boolean, out: string, err: string }}
 */
export function exec(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: 'utf8',
    // .cmd/.bat shims (like `code`) can't be spawned directly on Windows.
    shell: opts.shell ?? false,
  });
  const out = (r.stdout ?? '').trim();
  const err = (r.stderr ?? '').trim() || (r.error ? r.error.message : '');
  return { ok: r.status === 0, out, err };
}

/** @param {string} cmd */
export function commandExists(cmd) {
  return exec(cmd, ['--version']).ok;
}

/**
 * Start something and walk away.
 *
 * `detached` + `unref` + an ignored stdio so nw exits now instead of sitting
 * attached to an editor for the rest of the day. The cost is that the exit code
 * can never be read — the child is disowned before it could report one — so the
 * only failure worth catching is the one that actually happens: the command
 * isn't there.
 *
 * Args are not quoted for the shell. Every path nw builds is the root plus names
 * matched against `[A-Za-z0-9._-]`, so a space can only come from the root
 * itself — `C:\dev` on Windows, `$HOME/dev` on Linux, neither of which has one.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ shell?: boolean }} [opts]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function launch(cmd, args, opts = {}) {
  if (!onPath(cmd)) return { ok: false, reason: `\`${cmd}\` isn't on your PATH` };
  try {
    const child = spawn(cmd, args, {
      shell: opts.shell ?? false,
      detached: true,
      stdio: 'ignore',
    });
    // A failed spawn arrives as an `error` event, not a throw — the `try` above
    // catches none of it. Unhandled, that event takes the whole process down
    // with a stack trace, which is a spectacular way to report that an editor
    // didn't start. The PATH check above catches the case this can mean in
    // practice; what's left is a name that's there but won't exec (bad shebang,
    // wrong architecture), and the report has already printed by the time we'd
    // hear about it. So: noticed, and dropped on purpose.
    child.on('error', () => {});
    child.unref();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/**
 * Is gh installed and logged in? Both have to be true before we promise a remote.
 * @returns {{ ok: true } | { ok: false, reason: string, fix: string }}
 */
export function ghReady() {
  if (!commandExists('gh')) {
    return {
      ok: false,
      reason: 'gh (the GitHub CLI) is not installed',
      fix: GH_INSTALL,
    };
  }
  if (!exec('gh', ['auth', 'status']).ok) {
    return { ok: false, reason: 'gh is installed but not logged in', fix: 'gh auth login' };
  }
  return { ok: true };
}
