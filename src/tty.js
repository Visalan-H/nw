/**
 * Tell the drawing libraries this terminal can do box characters.
 *
 * clack and ora both ask `is-unicode-supported`, which on Windows only says yes
 * for Windows Terminal, VS Code, ConEmu and friends. In a plain PowerShell
 * console it says no, and the whole frame degrades to ASCII — `┌` becomes `T`,
 * `◇` becomes `o`, `└` becomes `—`. It looks broken, and it isn't true: the
 * console renders `✓` and `·` fine.
 *
 * Both libraries read this at import time, so this module has to be the *first*
 * import in the entry point, before `@clack/prompts` or `ora`.
 *
 * Nothing to do on Linux — every terminal there already answers yes.
 *
 * Set `NW_ASCII=1` to opt out if you ever hit a console that really can't.
 */
import { WINDOWS } from './platform.js';

if (WINDOWS && process.stdout.isTTY && !process.env.NW_ASCII) {
  process.env.TERM ??= 'xterm-256color';
}
