import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Root of the tree. Everything nw makes lives under here. */
export const ROOT = 'C:\\dev';

/**
 * The parts of the tree that name people, kept out of the repo.
 *
 * Who you work for isn't the tool's business and isn't anyone else's either, so
 * `buckets.private.json` is gitignored and read at load. Absent — a fresh clone,
 * someone else's machine — nw is simply a tool with fewer buckets.
 *
 *   {
 *     "children":   { "work": [{ "name": "acme", "hint": "retainer" }] },
 *     "extraRoots": ["archive"]
 *   }
 *
 * `children` keys are top-level bucket names, values are children appended to
 * that bucket. `extraRoots` are folders under ROOT that hold projects but are
 * never offered when creating one — findable, not suggested.
 *
 * @returns {{ children?: Record<string, Bucket[]>, extraRoots?: string[] }}
 */
function privateBuckets() {
  try {
    return JSON.parse(readFileSync(new URL('./buckets.private.json', import.meta.url), 'utf8'));
  } catch {
    return {};
  }
}

const PRIVATE = privateBuckets();

/** Folders `nw go` searches but the create picker never offers. @type {string[]} */
export const EXTRA_ROOTS = PRIVATE.extraRoots ?? [];

/**
 * Fold the untracked children into a bucket, keeping the declared ones first.
 * @param {Bucket} bucket
 * @returns {Bucket}
 */
function withPrivate(bucket) {
  const extra = (PRIVATE.children ?? {})[bucket.name];
  if (!extra || extra.length === 0) return bucket;
  return { ...bucket, children: [...(bucket.children ?? []), ...extra] };
}

/**
 * The buckets, cut by motive.
 *
 * The tree nests as deep as you like — `children` can have `children`. A project
 * can land on any node that is either a leaf, or has `here: true`.
 *
 * `here: true`   this node can hold a project directly. The picker offers `. (here)`.
 * `here: false`  this node is only a container. You must go deeper.
 *
 * `hint` is shown by the picker only on the highlighted row, so the menu stays a
 * short list of names instead of a wall of descriptions.
 *
 * Folders that exist on disk but shouldn't be offered here go in extraRoots.
 * `_cold` is last in the list so it's the furthest thing from an accidental pick.
 *
 * @typedef {{ name: string, hint?: string, here?: boolean, children?: Bucket[] }} Bucket
 * @type {Bucket[]}
 */
export const BUCKETS = [
  {
    // Its children live in buckets.private.json. With none, `work` becomes an
    // ordinary leaf that holds projects directly — which is the right shape for
    // a machine that has no clients on it.
    name: 'work',
    hint: 'paid or obligated',
    here: false,
    children: [],
  },
  {
    name: 'club',
    hint: 'college organisations',
    here: false,
    children: [
      { name: 'primeproject', hint: 'hackathon entries' },
      { name: 'techsociety' },
    ],
  },
  {
    name: 'product',
    hint: 'things you wanted to exist',
    here: true,
    children: [{ name: 'packages', hint: 'the published npm line' }],
  },
  { name: 'learning', hint: 'built to understand something' },
  { name: 'play', hint: 'fun, or one joke' },
  { name: '_cold', hint: 'dead, stalled, or untouched since 2024' },
].map(withPrivate);

/**
 * Every bucket a project may legally land in, as slash paths, at any depth.
 * A leaf is always valid; a node with children is valid only if `here`.
 * @returns {string[]}
 */
export function validBuckets() {
  /** @type {string[]} */
  const out = [];

  /**
   * @param {Bucket[]} nodes
   * @param {string} prefix
   */
  (function walk(nodes, prefix) {
    for (const node of nodes) {
      const path = prefix ? `${prefix}/${node.name}` : node.name;
      const children = node.children ?? [];
      if (children.length === 0 || node.here) out.push(path);
      walk(children, path);
    }
  })(BUCKETS, '');

  return out;
}

/**
 * Turn `work/clients/acme` into `C:\dev\work\clients\acme`.
 * @param {string} bucket
 */
export function bucketToPath(bucket) {
  return join(ROOT, ...bucket.split('/'));
}
