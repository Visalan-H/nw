import * as p from '@clack/prompts';
import pc from 'picocolors';
import ora from 'ora';

/**
 * Everything the tool prints.
 *
 * The asking is clack's — its prompts draw their own frame and keep a trail of
 * what you picked. The reporting isn't: once there's nothing left to answer the
 * frame closes and the result prints as plain indented lines, the way npm and
 * vite do it. A box around a finished job is decoration.
 */

const IND = '  ';

/** True when the last thing written was an empty line, so blank() can't double up. */
let blankLast = false;

/** @param {string} [text] */
function line(text = '') {
  process.stdout.write(`${text}\n`);
  blankLast = text === '';
}

/** One blank line between blocks — never two, wherever the last one came from. */
function blank() {
  if (!blankLast) line();
}

/** True once `┌ nw` has been printed, so it happens at most once and only if we ask something. */
let framed = false;

/**
 * Open the frame. Called by each prompt rather than at startup, so a run that
 * takes everything from flags never draws a frame it would immediately close.
 */
export function asking() {
  if (framed) return;
  p.intro(pc.bgCyan(pc.black(' nw ')));
  framed = true;
}

/** Close the frame if it was opened. The label doubles as the result's header. */
export function header(label) {
  if (framed) {
    p.outro(pc.dim(label));
    framed = false;
    blankLast = true; // clack's outro already leaves one
    return;
  }
  blank();
  line(IND + pc.dim(label));
}

/**
 * The run, as a list.
 * @param {{ label: string, ok: boolean, detail?: string }[]} items
 */
export function steps(items) {
  if (items.length === 0) return;
  blank();
  for (const s of items) {
    const mark = s.ok ? pc.green('✓') : pc.red('✗');
    const text = s.ok ? s.label : `${s.label} ${pc.red(`— ${s.detail ?? 'failed'}`)}`;
    line(`${IND}${mark} ${text}`);
  }
}

/**
 * An answer nw filled in for you.
 *
 * Drawn as `◇`, the same mark clack leaves on a question you've answered —
 * because that's what it is. One match means nw picked for you, and picking
 * silently and then asking the next question reads like it ignored you.
 *
 * @param {string} label
 */
export function found(label) {
  asking();
  p.log.step(`${pc.dim('found')}  ${label}`);
}

/**
 * The one thing to do next.
 *
 * Printed whether or not something was opened. After an open it stops being an
 * instruction and becomes a receipt — a clipboard written silently is a small
 * theft, since whatever you had copied is gone and nothing said so.
 *
 * `opening` rides on the same block rather than printing after the launch, for
 * the reason in create.js: the new window takes focus the instant it lands, so
 * anything said afterwards is said to an empty room.
 *
 * @param {string} dir
 * @param {boolean} [copied]
 * @param {string} [opening] label of what's about to be opened
 */
export function next(dir, copied = false, opening) {
  blank();
  line(`${IND}${pc.cyan('→')} cd ${dir}${copied ? pc.dim('  (copied)') : ''}`);
  if (opening) line(`${IND}${pc.cyan('↗')} opening ${opening}`);
  line();
}

/**
 * One thing didn't work, and here's the command that does it by hand.
 *
 * Deliberately not `gaps()` — no "not everything worked", because the project
 * itself is fine. That framing has to stay worth reading.
 *
 * @param {string} message
 * @param {string} [command]
 */
export function couldnt(message, command) {
  blank();
  line(`${IND}${pc.yellow('!')} ${message}`);
  if (command) line(`${IND}  ${pc.dim(command)}`);
  line();
}

/**
 * What broke, and the commands that finish the job by hand.
 * @param {string} summary
 * @param {string[]} commands
 */
export function gaps(summary, commands) {
  blank();
  line(`${IND}${pc.yellow('!')} ${summary}`);
  for (const c of commands) line(`${IND}  ${pc.dim(c)}`);
  line();
}

/** A heads-up that doesn't stop the run. @param {string} message */
export function warn(message) {
  blank();
  line(`${IND}${pc.yellow('!')} ${message}`);
}

/**
 * Stopped before doing anything.
 * @param {string} message
 * @param {string[]} [detail]
 */
export function fail(message, detail = []) {
  if (framed) {
    p.cancel(message);
    framed = false;
  } else {
    blank();
    line(`${IND}${pc.red('✗')} ${message}`);
  }
  if (detail.length > 0) {
    blank();
    for (const d of detail) line(`${IND}${pc.dim(d)}`);
  }
  line();
}

/**
 * A spinner that leaves nothing behind.
 *
 * clack's own always commits a `◇ …` line when it stops, which would put a
 * framed line in the middle of an unframed block. ora clears its line.
 *
 * @param {string} label
 */
export function working(label) {
  // ora defaults to stderr; everything else here is stdout. One stream, so the
  // line-erase can't land somewhere other than where the text was drawn.
  return ora({
    text: label,
    prefixText: ' ',
    // Same cyan as the `→ cd` line — the accent colour, for the one thing
    // currently happening. Green/red/yellow are already spoken for by the
    // result lines. Swap for any of ora's: red green yellow blue magenta
    // cyan white gray.
    color: 'cyan',
    stream: process.stdout,
  }).start();
}
