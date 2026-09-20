import { accessSync, constants, lstatSync } from 'node:fs';
import { delimiter, isAbsolute, join } from 'node:path';

/**
 * Everything that differs between Windows and Linux, in one file.
 *
 * The rest of nw is the same tool on both. What changes is small and mechanical:
 * where the tree lives, which binary owns the clipboard, which program opens a
 * terminal, and how you install `gh`. Keeping those four facts here means the
 * other modules never ask what OS they're on.
 */

export const WINDOWS = process.platform === 'win32';

/**
 * Root of the tree. Everything nw makes lives under here.
 *
 * On Linux this is the NTFS partition mounted at boot, not a folder under the
 * Fedora home directory — the machine dual-boots and `dev\` is the same tree
 * either OS is running, shared across the mount rather than duplicated per OS.
 */
export const ROOT = WINDOWS ? 'C:\\dev' : '/mnt/BC8A5BB68A5B6C40/dev';

/**
 * Do `.cmd`/`.bat` shims need a shell to spawn?
 *
 * On Windows they do — `code` is `code.cmd`, and Node won't exec it directly.
 * On Linux the same editors are ELF binaries or symlinks to shell scripts with
 * a shebang, so spawning goes straight through and the shell would only add a
 * quoting problem nw doesn't otherwise have.
 */
export const SHIMS_NEED_SHELL = WINDOWS;

/**
 * How to get the GitHub CLI.
 *
 * `dnf` because Fedora is the Linux this runs on — the only string here that
 * assumes a distro rather than probing for one. On anything else it's the one
 * word to change, and it's a hint printed next to a failure, not a command nw
 * runs.
 */
export const GH_INSTALL = WINDOWS ? 'winget install --id GitHub.cli -e' : 'sudo dnf install gh';

/**
 * Extensions that make a PATH entry executable. `''` first so a command written
 * with its extension (`clip.exe`) is found as itself.
 */
const PATH_EXTS = WINDOWS
  ? ['', ...(process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)]
  : [''];

/**
 * Something you could run sits at this path.
 *
 * `lstat`, not `stat`, which is wrong twice over: Windows installs Terminal as
 * an App Execution Alias, a reparse point `stat` refuses with EACCES, and on
 * Linux half of `/usr/bin` is symlinks. Following the link isn't the question —
 * whether the name resolves is.
 *
 * The execute bit is then checked where there is one, so this answers the same
 * question `which` does rather than the looser "a file by that name exists".
 * Windows has no such bit; `PATHEXT` is the whole test there.
 *
 * @param {string} path
 */
function runnable(path) {
  try {
    if (lstatSync(path).isDirectory()) return false;
    if (WINDOWS) return true;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Is this on the PATH? Asked without running it.
 *
 * Reading `<cmd> --version` is fine for `gh` and wrong for anything with a
 * window — `wt --version` opens a terminal, `code --version` takes about a
 * second. This used to shell out to `where.exe`, which answered the same
 * question and only existed on one OS. Walking PATH is what `where` and `which`
 * both do anyway, and doing it here costs a handful of `lstat` calls instead
 * of a process.
 *
 * @param {string} cmd
 */
export function onPath(cmd) {
  if (isAbsolute(cmd)) return PATH_EXTS.some((ext) => runnable(cmd + ext));

  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  return dirs.some((dir) => PATH_EXTS.some((ext) => runnable(join(dir, cmd) + ext)));
}

/**
 * The clipboard, in order of preference.
 *
 * `clip.exe` ships with Windows. Fedora ships Wayland, so `wl-copy` is the one
 * that works on a stock install; X11 sessions and older setups have `xclip` or
 * `xsel` instead. Whichever is there first wins, and if none of them are the
 * copy just doesn't happen — `→ cd <path>` is still printed, which was always
 * the part that mattered.
 *
 * @type {{ cmd: string, args: string[] }[]}
 */
export const CLIPBOARDS = WINDOWS
  ? [{ cmd: 'clip.exe', args: [] }]
  : [
      { cmd: 'wl-copy', args: [] },
      { cmd: 'xclip', args: ['-selection', 'clipboard'] },
      { cmd: 'xsel', args: ['--clipboard', '--input'] },
    ];

/**
 * Terminals that can open a tab in a directory, best first.
 *
 * `args(dir, run)` builds the command line: `run` is the argv to execute in the
 * new tab, or null for a plain shell.
 *
 * Ghostty leads — it's what actually runs here, ahead of Fedora's own default.
 * Ptyxis is next because it's Fedora's default terminal from 41 on, then
 * gnome-terminal for anyone who kept the old one. Those two and konsole take a
 * flag that reuses the window you're already standing in, which is what `wt -w 0
 * nt` was picked for on Windows — a new window steals focus and orphans the one
 * you ran nw from. The rest, ghostty included, can't do it without a running
 * instance to talk to, so they open a window, and on those the opener is worth
 * a little less.
 *
 * @typedef {{ cmd: string, args: (dir: string, run: string[] | null) => string[] }} Terminal
 * @type {Terminal[]}
 */
const TERMINALS = WINDOWS
  ? [{ cmd: 'wt', args: (dir, run) => ['-w', '0', 'nt', '-d', dir, ...(run ?? [])] }]
  : [
      {
        cmd: 'ghostty',
        args: (dir, run) => [`--working-directory=${dir}`, ...(run ? ['-e', ...run] : [])],
      },
      {
        cmd: 'ptyxis',
        args: (dir, run) => [
          '--tab',
          `--working-directory=${dir}`,
          ...(run ? ['-x', run.join(' ')] : []),
        ],
      },
      {
        cmd: 'gnome-terminal',
        args: (dir, run) => [
          '--tab',
          `--working-directory=${dir}`,
          ...(run ? ['--', ...run] : []),
        ],
      },
      {
        cmd: 'konsole',
        args: (dir, run) => ['--new-tab', '--workdir', dir, ...(run ? ['-e', ...run] : [])],
      },
      {
        cmd: 'kgx',
        args: (dir, run) => [`--working-directory=${dir}`, ...(run ? ['-e', run.join(' ')] : [])],
      },
      {
        cmd: 'wezterm',
        args: (dir, run) => ['start', '--cwd', dir, ...(run ? ['--', ...run] : [])],
      },
      { cmd: 'kitty', args: (dir, run) => ['-d', dir, ...(run ?? [])] },
      {
        cmd: 'alacritty',
        args: (dir, run) => ['--working-directory', dir, ...(run ? ['-e', ...run] : [])],
      },
    ];

/** @type {Terminal | null | undefined} */
let found;

/**
 * The terminal this machine actually has, or null.
 *
 * Looked up once and remembered. Null is a real answer — a headless box or a
 * desktop nw hasn't heard of — and the openers that need one drop off the menu
 * rather than failing after you pick them.
 *
 * @returns {Terminal | null}
 */
export function terminal() {
  found ??= TERMINALS.find((t) => onPath(t.cmd)) ?? null;
  return found;
}

/** What to suggest when there's no terminal to open. */
export const TERMINAL_NAMES = TERMINALS.map((t) => t.cmd).join(', ');
