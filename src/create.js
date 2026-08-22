import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';

import { bucketToPath } from './buckets.js';
import { GITIGNORE } from './gitignore.js';
import { run, ghReady } from './run.js';
import { openIn, openerLabel } from './openers.js';
import { copyCd } from './clip.js';
import * as ui from './ui.js';

/** The GitHub account new repos are created under. */
export const GH_OWNER = 'Visalan-H';

/**
 * Records what actually happened so a half-finished run can explain itself.
 * Nothing is ever rolled back — a folder you just made is worth more than a
 * clean exit.
 */
class Trail {
  /** @type {{ label: string, ok: boolean, detail?: string }[]} */
  steps = [];
  broke = false;

  /** @param {string} label */
  did(label) {
    this.steps.push({ label, ok: true });
  }

  /**
   * @param {string} label
   * @param {string} detail
   */
  failed(label, detail) {
    this.steps.push({ label, ok: false, detail });
    this.broke = true;
  }
}

/**
 * Make the project.
 *
 * @param {{ name: string, bucket: string, github: boolean, public: boolean, opener: string | null }} opts
 * @returns {Promise<{ dir: string, broke: boolean }>}
 */
export async function createProject(opts) {
  const dir = join(bucketToPath(opts.bucket), opts.name);
  const trail = new Trail();

  // Checked up front so we don't build half a project before finding out.
  const gh = opts.github ? ghReady() : { ok: true };
  if (!gh.ok) ui.warn(`${gh.reason}. Local git only.`);
  const wantsRemote = opts.github && gh.ok;

  const spin = ui.working('setting up');

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.gitignore'), GITIGNORE);

  const init = await run('git', ['init', '-b', 'main'], { cwd: dir });
  if (!init.ok) {
    spin.stop();
    trail.failed('git init', reason(init.err));
    return finish(trail, dir, opts, gh);
  }

  await run('git', ['add', '-A'], { cwd: dir });
  const commit = await run('git', ['commit', '-m', 'init'], { cwd: dir });
  if (!commit.ok) {
    spin.stop();
    trail.failed('first commit', reason(commit.err || commit.out));
    return finish(trail, dir, opts, gh);
  }
  trail.did('git init + first commit');

  if (wantsRemote) {
    spin.text = 'creating the github repo';
    // One command: creates the repo, wires origin, AND sets upstream. Doing this
    // by hand with `git remote add` + `git push` is how repos end up unpushable.
    const create = await run(
      'gh',
      [
        'repo',
        'create',
        `${GH_OWNER}/${opts.name}`,
        opts.public ? '--public' : '--private',
        '--source=.',
        '--remote=origin',
        '--push',
      ],
      { cwd: dir },
    );

    const repo = `github.com/${GH_OWNER}/${opts.name}`;
    if (create.ok) {
      trail.did(`${pc.cyan(repo)} ${pc.dim(opts.public ? '(public)' : '(private)')}`);
    } else {
      trail.failed(repo, reason(create.err));
    }
  } else if (!opts.github) {
    // Not "(--no-github)" any more — you can get here from the prompt too, and
    // naming a flag you didn't type reads like the tool misheard you.
    trail.did(pc.dim('no github'));
  }

  spin.stop();
  return finish(trail, dir, opts, gh);
}

/**
 * Clone someone else's repo into a bucket instead of into Downloads.
 *
 * @param {{ url: string, name: string, bucket: string, opener: string | null }} opts
 */
export async function cloneProject(opts) {
  const dir = join(bucketToPath(opts.bucket), opts.name);
  const trail = new Trail();

  mkdirSync(bucketToPath(opts.bucket), { recursive: true });

  const spin = ui.working(`cloning ${opts.url}`);
  const clone = await run('git', ['clone', opts.url, dir]);
  spin.stop();

  if (clone.ok) {
    // origin stays pointed at their repo. You're reading their code, not owning it.
    trail.did(`cloned from ${pc.cyan(opts.url)}`);
  } else {
    trail.failed('clone', reason(clone.err));
  }

  return finish(trail, dir, { ...opts, github: false, public: false }, { ok: true }, [
    `git clone ${opts.url} ${dir}`,
  ]);
}

/**
 * @param {Trail} trail
 * @param {string} dir
 * @param {{ name?: string, opener: string | null, github: boolean, public: boolean }} opts
 * @param {{ ok: boolean, fix?: string }} gh
 * @param {string[]} [retry] the commands that finish the job by hand
 */
function finish(trail, dir, opts, gh, retry) {
  ui.steps(trail.steps);

  // A missing or logged-out gh is a gap too, even though every step we ran worked.
  const broke = trail.broke || !gh.ok;
  // Don't promise a folder that isn't there — a failed clone leaves nothing.
  const kept = existsSync(dir);

  if (broke) {
    const commands = retry ?? [`cd ${dir}`, 'gh repo create --source=. --remote=origin --push'];
    ui.gaps(
      kept ? 'not everything worked — the folder is still there' : 'not everything worked',
      gh.fix ? [gh.fix, ...commands] : commands,
    );
  } else {
    // Named here rather than after the launch — openIt() explains why.
    ui.next(dir, kept && copyCd(dir), kept && opts.opener ? openerLabel(opts.opener) : undefined);
  }

  openIt(dir, opts.opener, broke, kept);
  return { dir, broke };
}

/**
 * Open the finished project, once the report is already on screen.
 *
 * Order matters and this is the whole reason it lives at the bottom: `wt -w 0 nt`
 * switches you to the new tab the instant it lands, so anything printed after it
 * scrolls past in a window you're no longer looking at.
 *
 * The trade is that success can't be a ✓ in the report — it hasn't happened yet.
 * That's survivable because of an asymmetry: a failed open steals no focus, so
 * you're still on the old tab and the warning prints where your eyes already are.
 *
 * @param {string} dir
 * @param {string | null | undefined} name
 * @param {boolean} broke
 * @param {boolean} kept
 */
function openIt(dir, name, broke, kept) {
  if (!name || !kept) return;

  // The gaps block above holds the commands that finish the job by hand. Stealing
  // focus off the one screen you needed to read is the worst moment for it.
  if (broke) return ui.couldnt('didn\'t open — fix the above first');

  const started = openIn(name, dir);
  if (!started.ok) {
    // Not a gap: git and the remote are the contract, the editor is a convenience.
    ui.couldnt(`couldn't open ${started.label} — ${started.reason}`, started.retry);
  }
}

/**
 * Pull the one useful line out of a command's stderr.
 *
 * The first line is usually progress, not the problem — `git clone` opens with
 * "Cloning into '…'" and only says `fatal:` at the end. Prefer a line that
 * announces a failure, then fall back to the last thing said.
 *
 * @param {string} text
 */
function reason(text) {
  const lines = (text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return 'failed';

  const named = lines.find((l) => /^(fatal|error|ERROR|GraphQL|HTTP \d)/.test(l));
  return named ?? lines[lines.length - 1];
}

/** @param {string} dir */
export function dirTaken(dir) {
  return existsSync(dir);
}
