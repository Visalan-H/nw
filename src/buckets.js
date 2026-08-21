import { join } from 'node:path';

/** Root of the tree. Everything nw makes lives under here. */
export const ROOT = 'C:\\dev';

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
 * `archive` is absent on purpose — it exists on disk, it just isn't offered here.
 * `_cold` is last in the list so it's the furthest thing from an accidental pick.
 *
 * @typedef {{ name: string, hint?: string, here?: boolean, children?: Bucket[] }} Bucket
 * @type {Bucket[]}
 */
export const BUCKETS = [
  {
    name: 'work',
    hint: 'paid or obligated',
    here: false,
    children: [
      { name: 'internal', hint: 'paid or obligated' },
      {
        name: 'clients',
        hint: 'acme, beta, gamma, delta',
        // Today each client is a single project, so this is a leaf. To give a
        // client its own folder of projects, add:
        //   here: true,
        //   children: [{ name: 'acme' }],
      },
    ],
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
];

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
