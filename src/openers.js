import { launch } from './run.js';

/**
 * The things a project can be opened in.
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
 * `goOnly` keeps an opener out of the create menu. Resuming a session in a
 * folder that didn't exist a second ago has nothing to resume, and an option
 * that can only disappoint you shouldn't be on the list.
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
 *   goOnly?: boolean,
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
  {
    // The one you reach for going back to something — `claude -r` lists that
    // folder's past sessions and picks up where you stopped.
    name: 'resume',
    label: 'Claude Code — resume',
    hint: 'wt + claude -r — pick up a past session',
    cmd: 'wt',
    args: (d) => ['-w', '0', 'nt', '-d', d, 'claude', '-r'],
    goOnly: true,
  },
];

/**
 * The openers a menu should offer.
 * @param {boolean} existing whether the project was already there
 * @returns {Opener[]}
 */
export function menuOpeners(existing) {
  return OPENERS.filter((o) => existing || !o.goOnly);
}

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

/**
 * Open a folder in one of them.
 *
 * Shared by `nw` and `nw go` — a project you just made and a project you're
 * going back to want exactly the same thing to happen.
 *
 * @param {string} name
 * @param {string} dir
 * @returns {{ ok: true } | { ok: false, label: string, reason: string, retry: string }}
 */
export function openIn(name, dir) {
  const opener = findOpener(name);
  if (!opener) return { ok: true };

  const args = opener.args(dir);
  const started = launch(opener.cmd, args, { shell: opener.shell });
  if (started.ok) return { ok: true };

  return {
    ok: false,
    label: opener.label,
    reason: started.reason,
    retry: `${opener.cmd} ${args.join(' ')}`,
  };
}

/** The human name, for saying what's about to open. @param {string} name */
export function openerLabel(name) {
  return findOpener(name)?.label;
}
