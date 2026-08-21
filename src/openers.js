/**
 * The things a finished project can be opened in.
 *
 * An opener is a name mapped to a command that takes a directory. That's the
 * whole model — a flag per app doesn't survive the next editor you install.
 *
 * `shell: true` on the editors because they're `.cmd`/`.exe` shims, which can't
 * be spawned directly on Windows. `wt.exe` is a real executable and needs none.
 *
 * `wt -w 0 nt` opens a new tab in the window you're already standing in. A new
 * window steals focus and orphans the one you ran nw from.
 *
 * Claude Code is the terminal opener with a command attached, not a fifth app —
 * the desktop app registers a `claude:` scheme but has no documented way to be
 * handed a directory, and guessing at a deep link is a string that breaks
 * silently on the next update.
 *
 * Order here is menu order.
 *
 * @typedef {{
 *   name: string,
 *   label: string,
 *   hint: string,
 *   cmd: string,
 *   args: (dir: string) => string[],
 *   shell?: boolean,
 * }} Opener
 * @type {Opener[]}
 */
export const OPENERS = [
  { name: 'code', label: 'VS Code', hint: 'code', cmd: 'code', args: (d) => [d], shell: true },
  { name: 'cursor', label: 'Cursor', hint: 'cursor', cmd: 'cursor', args: (d) => [d], shell: true },
  {
    name: 'antigravity',
    label: 'Antigravity',
    hint: 'antigravity-ide',
    cmd: 'antigravity-ide',
    args: (d) => [d],
    shell: true,
  },
  {
    name: 'terminal',
    label: 'Terminal',
    hint: 'wt — a new tab here',
    cmd: 'wt',
    args: (d) => ['-w', '0', 'nt', '-d', d],
  },
  {
    name: 'claude',
    label: 'Claude Code',
    hint: 'wt + claude',
    cmd: 'wt',
    args: (d) => ['-w', '0', 'nt', '-d', d, 'claude'],
  },
];

/** @returns {string[]} */
export function validOpeners() {
  return OPENERS.map((o) => o.name);
}

/**
 * @param {string} name
 * @returns {Opener | undefined}
 */
export function findOpener(name) {
  return OPENERS.find((o) => o.name === name);
}
