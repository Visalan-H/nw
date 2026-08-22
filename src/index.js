#!/usr/bin/env node
// Must come first — it sets the env var clack and ora read when they load.
import './tty.js';

import { parseArgs } from 'node:util';
import { join } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';

import { BUCKETS, validBuckets, bucketToPath } from './buckets.js';
import { OPENERS, validOpeners, openIn, openerLabel } from './openers.js';
import { allProjects, matchProjects, shortPath, ROOT } from './projects.js';
import { createProject, cloneProject, dirTaken, GH_OWNER } from './create.js';
import { copyCd } from './clip.js';
import * as ui from './ui.js';

const HELP = `
  ${pc.bold('nw')} — puts a project in the right place with git already correct, and finds it again.

  ${pc.dim('nw')}                                  ask everything
  ${pc.dim('nw trackify')}                         ask for the bucket
  ${pc.dim('nw trackify product')}                 just go
  ${pc.dim('nw clone <url> [bucket]')}             clone into a bucket, not Downloads

  ${pc.dim('nw go trackify')}                      find it again and open it
  ${pc.dim('nw go track')}                         partial is fine — pick from the matches
  ${pc.dim('nw go')}                               list everything

  ${pc.dim('--public')}      public repo (default is private)
  ${pc.dim('--no-github')}   local git only, no remote
  ${pc.dim('--open <app>')}  open it when it's done — ${validOpeners().join(', ')}
  ${pc.dim('-e')}            short for --open code

  buckets:
${bucketColumns()
  .split('\n')
  .map((r) => `  ${r}`)
  .join('\n')}
`;

// Called at the bottom of the file, not here. `const` doesn't hoist, so starting
// work mid-module means anything that reaches a sentinel like NONE without
// awaiting first hits it before it exists — which `nw go` did, synchronously.

async function main() {
  let args;
  try {
    args = parseArgs({
      allowPositionals: true,
      options: {
        public: { type: 'boolean', default: false },
        'no-github': { type: 'boolean', default: false },
        open: { type: 'string' },
        editor: { type: 'boolean', short: 'e', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    die(err.message);
  }

  const { values: flags, positionals } = args;

  if (flags.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (positionals[0] === 'clone') {
    await runClone(positionals.slice(1), flags);
  } else if (positionals[0] === 'go') {
    await runGo(positionals.slice(1), flags);
  } else {
    await runNew(positionals, flags);
  }
}

/**
 * Go back to something that already exists.
 *
 * A CLI can't change its parent shell's directory — so it doesn't try. It opens
 * the project instead, and puts `cd <path>` on your clipboard for the times you
 * wanted the shell you're already standing in. Picking `terminal` gets you a tab
 * that's already there, which is the same thing by another route.
 *
 * @param {string[]} positionals
 * @param {Record<string, string | boolean>} flags
 */
async function runGo(positionals, flags) {
  const all = allProjects();
  if (all.length === 0) die(`Nothing under ${ROOT} yet.`);

  const query = positionals[0];
  const found = query ? matchProjects(query, all) : all;

  if (found.length === 0) {
    die(`Nothing matching "${query}".`, [`${all.length} projects under ${ROOT}`]);
  }

  // One hit is the whole point — don't make you confirm what you already said.
  // But say which one, before asking anything else: `nw go track` and a prompt
  // about openers, with the project never named, is nw talking about a folder
  // you haven't been shown. The picker names it for you; this branch has to.
  const project = found.length === 1 ? found[0] : await pickProject(found, query);
  if (found.length === 1) ui.found(shortPath(project));

  // Always asks, unlike creating. The point of `go` is to land somewhere, so
  // finding the folder and then saying nothing is half an answer.
  const opener = await settleOpener(flags, true);

  ui.header(shortPath(project));
  ui.next(project.dir, copyCd(project.dir), opener ? openerLabel(opener) : undefined);

  if (opener) {
    const started = openIn(opener, project.dir);
    if (!started.ok) {
      ui.couldnt(`couldn't open ${started.label} — ${started.reason}`, started.retry);
    }
  }
}

/**
 * @param {import('./projects.js').Project[]} found
 * @param {string} [query]
 */
async function pickProject(found, query) {
  ui.asking();

  const choice = await p.select({
    message: query
      ? `${found.length} matches for "${query}"`
      : `Which project ${pc.dim(`(${found.length})`)}`,
    options: found.map((pr) => ({
      value: pr.dir,
      label: pr.name,
      hint: pr.bucket,
    })),
  });
  bailIfCancelled(choice);
  return found.find((pr) => pr.dir === choice);
}

/**
 * @param {string[]} positionals
 * @param {Record<string, boolean>} flags
 */
async function runNew(positionals, flags) {
  const name = positionals[0] ?? (await askName());
  const badName = checkName(name);
  if (badName) die(badName);

  const bucket = positionals[1] ?? (await pickBucket());
  if (!validBuckets().includes(bucket)) {
    die(`"${bucket}" isn't a bucket. Pick one of:`, bucketColumns().split('\n'));
  }

  const dir = join(bucketToPath(bucket), name);
  if (dirTaken(dir)) die(`${dir} already exists.`);

  const interactive = positionals.length < 2;
  const github = await settleGithub(flags, interactive);
  const opener = await settleOpener(flags, interactive);

  // Closes the prompt frame and heads the report with where this is going.
  ui.header(`${bucket}/${name}`);

  await createProject({ name, bucket, ...github, opener });
}

/**
 * Where the code goes: private, public, or nowhere.
 *
 * One question rather than two. `--public` and `--no-github` are separate flags
 * because flags are cheap, but as prompts they'd be two stops on the way to a
 * folder — and this tool loses to `mkdir` the moment it asks too much. They're
 * three answers to one question anyway: how public is this.
 *
 * @param {Record<string, string | boolean>} flags
 * @param {boolean} interactive
 * @returns {Promise<{ github: boolean, public: boolean }>}
 */
async function settleGithub(flags, interactive) {
  // Either flag is a decision already made. Don't ask it twice.
  if (flags['no-github']) return { github: false, public: false };
  if (flags.public) return { github: true, public: true };
  if (!interactive) return { github: true, public: false };

  ui.asking();

  const choice = await p.select({
    message: 'GitHub',
    options: [
      // Private first and highlighted: public is a decision for publishing day,
      // not for minute zero.
      { value: 'private', label: 'Private repo', hint: `github.com/${GH_OWNER}` },
      { value: 'public', label: 'Public repo', hint: 'anyone can see it' },
      { value: 'none', label: 'No GitHub', hint: 'local git only — still commits' },
    ],
  });
  bailIfCancelled(choice);

  return { github: choice !== 'none', public: choice === 'public' };
}

/**
 * @param {string[]} positionals
 * @param {Record<string, boolean>} flags
 */
async function runClone(positionals, flags) {
  const url = positionals[0] ?? (await ask('Repo URL', 'https://github.com/…'));
  if (!url) die('No URL given.');

  const name = nameFromUrl(url);
  if (!name) die(`Can't work out a folder name from "${url}".`);

  const bucket = positionals[1] ?? (await pickBucket());
  if (!validBuckets().includes(bucket)) {
    die(`"${bucket}" isn't a bucket. Pick one of:`, bucketColumns().split('\n'));
  }

  const dir = join(bucketToPath(bucket), name);
  if (dirTaken(dir)) die(`${dir} already exists.`);

  const opener = await settleOpener(flags, positionals.length < 2);

  ui.header(`${bucket}/${name}`);

  await cloneProject({ url, name, bucket, opener });
}

/**
 * Which opener, if any.
 *
 * The flag and the prompt are two doors to one setting, so `-e` is nothing more
 * than `--open code` and there's no second field for them to drift apart in.
 *
 * The prompt is only offered to a run that was already interactive. With both
 * positionals supplied nw asks nothing at all today — that path is "just go",
 * and a stop sign in it would be the thing you start resenting.
 *
 * @param {Record<string, string | boolean>} flags
 * @param {boolean} interactive whether nw already had to ask something
 * @returns {Promise<string | null>}
 */
async function settleOpener(flags, interactive) {
  // --open wins over -e without comment. They're the same setting.
  const flagged = flags.open ?? (flags.editor ? 'code' : null);
  if (flagged) {
    if (!validOpeners().includes(flagged)) {
      die(`"${flagged}" isn't something I can open. Pick one of:`, [validOpeners().join('  ')]);
    }
    return flagged;
  }

  if (!interactive) return null;
  return await pickOpener();
}

/**
 * `nothing` sits first and starts highlighted, so blind Enter does exactly what
 * this tool did before the question existed. A third prompt can only cost you
 * what you chose to spend.
 */
async function pickOpener() {
  ui.asking();

  const choice = await p.select({
    message: 'Open in',
    options: [
      { value: NONE, label: 'nothing', hint: 'just make it' },
      ...OPENERS.map((o) => ({ value: o.name, label: o.label, hint: o.hint })),
    ],
  });
  bailIfCancelled(choice);
  return choice === NONE ? null : choice;
}

/**
 * The bucket list laid out in columns. As one line it's 140 characters that wrap
 * into mush in a normal terminal.
 *
 */
function bucketColumns() {
  const all = validBuckets();
  const width = Math.max(...all.map((b) => b.length)) + 3;
  const perRow = 3;

  const rows = [];
  for (let i = 0; i < all.length; i += perRow) {
    rows.push(all.slice(i, i + perRow).map((b) => b.padEnd(width)).join('').trimEnd());
  }
  return rows.join('\n');
}

/** Sentinel for "stop here, put the project in this folder". */
const HERE = '\0here';

/** Sentinel for "don't open anything" — an absence, not an opener. */
const NONE = '\0none';

/**
 * Walk down the bucket tree, one menu per level, as deep as the tree goes.
 * Stops when you hit a leaf, or when you pick `. (here)` on a node that allows it.
 * `work` and `club` are `here: false`, so they never hold loose projects.
 */
async function pickBucket() {
  ui.asking();

  /** @type {string[]} */
  const parts = [];
  let nodes = BUCKETS;
  /** @type {import('./buckets.js').Bucket | null} */
  let current = null;

  while (nodes.length > 0) {
    /** @type {{value: string, label: string, hint?: string}[]} */
    const options = [];
    // Never offered at the top level — nothing is created loose in C:\dev.
    if (current?.here) {
      options.push({ value: HERE, label: '. (here)', hint: `straight into ${parts.join('/')}` });
    }
    // The description rides as a `hint`, so it only shows on the highlighted row.
    options.push(...nodes.map((n) => ({ value: n.name, label: n.name, hint: n.hint })));

    const choice = await p.select({
      message: parts.length ? `${parts.join('/')}/` : 'Bucket',
      options,
    });
    bailIfCancelled(choice);
    if (choice === HERE) break;

    current = nodes.find((n) => n.name === choice);
    parts.push(current.name);
    nodes = current.children ?? [];
  }

  return parts.join('/');
}

async function askName() {
  ui.asking();

  const name = await p.text({
    message: 'Name',
    placeholder: 'trackify-v3',
    validate: (v) => checkName(v) ?? undefined,
  });
  bailIfCancelled(name);
  return name;
}

/**
 * @param {string} message
 * @param {string} placeholder
 */
async function ask(message, placeholder) {
  ui.asking();

  const value = await p.text({ message, placeholder });
  bailIfCancelled(value);
  return value;
}

/**
 * Has to be safe as a folder name and as a GitHub repo name.
 * @param {string} name
 * @returns {string | null} the problem, or null if it's fine
 */
function checkName(name) {
  if (!name || !name.trim()) return 'Needs a name.';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    return 'Letters, numbers, dot, dash and underscore only — and start with a letter or number.';
  }
  return null;
}

/** `https://github.com/facebook/react.git` -> `react` @param {string} url */
function nameFromUrl(url) {
  const last = url.replace(/\.git$/, '').replace(/\/+$/, '').split(/[/:]/).pop();
  return last && checkName(last) === null ? last : null;
}

/** @param {unknown} value */
function bailIfCancelled(value) {
  if (p.isCancel(value)) {
    p.cancel('cancelled');
    process.exit(0);
  }
}

/**
 * @param {string} message
 * @param {string[]} [detail]
 */
function die(message, detail) {
  ui.fail(message, detail);
  process.exit(1);
}

main();
