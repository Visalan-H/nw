import { launch } from './run.js';
import { SHIMS_NEED_SHELL, TERMINAL_NAMES, terminal } from './platform.js';

/**
 * The things a project can be opened in.
 *
 * An opener is a name mapped to a command that takes a directory. That's the
 * whole model — a flag per app doesn't survive the next editor you install.
 *
 * The editors are the same three names on both operating systems. The terminal
 * isn't: `platform.js` finds whichever one this machine has and says how to hand
 * it a directory, so the three terminal openers are that one command with
 * different argv. Nothing here knows which terminal it got.
 *
 * `shell` on the editors because on Windows they're `.cmd` shims, which can't be
 * spawned directly. On Linux they're ordinary executables and it stays off.
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
 *   needsTerminal?: boolean,
 * }} Opener
 */

const TERM = terminal();

/** The ones that take a directory and nothing else. @type {Opener[]} */
const EDITORS = [
  {
    name: 'code',
    label: 'VS Code',
    hint: 'code',
    cmd: 'code',
    args: (d) => [d],
    shell: SHIMS_NEED_SHELL,
  },
  {
    name: 'cursor',
    label: 'Cursor',
    hint: 'cursor',
    cmd: 'cursor',
    args: (d) => [d],
    shell: SHIMS_NEED_SHELL,
  },
  {
    name: 'antigravity',
    label: 'Antigravity',
    hint: 'antigravity-ide',
    cmd: 'antigravity-ide',
    args: (d) => [d],
    shell: SHIMS_NEED_SHELL,
  },
];

/**
 * The ones that are this machine's terminal with an argv attached.
 *
 * `hint` is the tail of the hint — the terminal's own name goes in front of it,
 * because which one you get is a property of the machine, not of the opener.
 *
 * @typedef {{ name: string, label: string, hint: string, run: string[] | null, goOnly?: boolean }} TerminalSpec
 * @type {TerminalSpec[]}
 */
const TERMINAL_SPECS = [
  { name: 'terminal', label: 'Terminal', hint: ' — a new tab here', run: null },
  { name: 'claude', label: 'Claude Code', hint: ' + claude', run: ['claude'] },
  // The one you reach for going back to something — `claude -r` lists that
  // folder's past sessions and picks up where you stopped.
  {
    name: 'resume',
    label: 'Claude Code — resume',
    hint: ' + claude -r — pick up a past session',
    run: ['claude', '-r'],
    goOnly: true,
  },
];

/**
 * A terminal spec as an opener, or nothing if there's no terminal to open.
 * @param {TerminalSpec} spec
 * @returns {Opener[]}
 */
function terminalOpener(spec) {
  if (!TERM) return [];
  return [
    {
      name: spec.name,
      label: spec.label,
      hint: `${TERM.cmd}${spec.hint}`,
      cmd: TERM.cmd,
      args: (d) => TERM.args(d, spec.run),
      goOnly: spec.goOnly,
      needsTerminal: true,
    },
  ];
}

/** @type {Opener[]} */
export const OPENERS = [...EDITORS, ...TERMINAL_SPECS.flatMap(terminalOpener)];

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
 * Names a flag may use, including the ones this machine can't do.
 *
 * `--open terminal` on a box with no terminal emulator should be told what's
 * missing, not told that `terminal` isn't a word — the list of openers is part
 * of the tool, and only one of them happens to be unavailable today.
 *
 * Derived, not typed out: `OPENERS` is already short a few names on a machine
 * with no terminal, and a hand-kept copy would go stale the first time a fourth
 * one is added — silently, since the failure is a worse error message.
 *
 * @type {string[]}
 */
export const ALL_NAMES = [...EDITORS.map((o) => o.name), ...TERMINAL_SPECS.map((s) => s.name)];

/** @param {string} name */
export function knownOpener(name) {
  return ALL_NAMES.includes(name);
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
  if (!opener) {
    // Known name, no opener built — the terminal it needs isn't installed.
    if (!knownOpener(name)) return { ok: true };
    return {
      ok: false,
      label: name,
      reason: 'no terminal emulator found',
      retry: `install one of: ${TERMINAL_NAMES}`,
    };
  }

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
