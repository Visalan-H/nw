import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT, validBuckets, bucketToPath } from './buckets.js';

/**
 * Folders that hold projects but aren't offered when creating one.
 * `archive` is kept whole and deliberately absent from the create picker — but you
 * still need to be able to find what's already in it.
 */
const EXTRA_ROOTS = [];

/**
 * Every project on disk, read fresh each run.
 *
 * No index file. Every field here is already on disk, and a cached copy drifts
 * the moment something is renamed — which is the same trap the registry file
 * fell into.
 *
 * @typedef {{ name: string, bucket: string, dir: string }} Project
 * @returns {Project[]}
 */
export function allProjects() {
  const buckets = validBuckets();
  // A child that is itself a bucket is a container, not a project — `packages`
  // sits inside `product` and holds projects of its own.
  const isBucket = new Set(buckets.concat(EXTRA_ROOTS));

  /** @type {Project[]} */
  const out = [];

  for (const bucket of buckets.concat(EXTRA_ROOTS)) {
    const base = bucketToPath(bucket);
    for (const entry of read(base)) {
      if (isBucket.has(`${bucket}/${entry}`)) continue;
      out.push({ name: entry, bucket, dir: join(base, entry) });
    }
  }

  return out;
}

/** @param {string} dir */
function read(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    // A bucket that doesn't exist yet is just empty, not a problem.
    return [];
  }
}

/**
 * Narrow the list by what was typed.
 *
 * Three passes, best first: exact name, then substring, then subsequence — so
 * `qs` finds `quick-share` but an exact `otp` never gets buried under the
 * fifteen things that merely contain those letters in order.
 *
 * @param {string} query
 * @param {Project[]} projects
 * @returns {Project[]}
 */
export function matchProjects(query, projects) {
  const q = query.toLowerCase();

  const exact = projects.filter((p) => p.name.toLowerCase() === q);
  if (exact.length > 0) return exact;

  const substring = projects.filter((p) => p.name.toLowerCase().includes(q));
  if (substring.length > 0) return sort(substring);

  return sort(projects.filter((p) => subsequence(q, p.name.toLowerCase())));
}

/** Shortest name first — the tighter the match, the more likely it's the one. */
function sort(list) {
  return [...list].sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));
}

/**
 * Are all of `q`'s characters in `text`, in order?
 * @param {string} q
 * @param {string} text
 */
function subsequence(q, text) {
  let i = 0;
  for (const c of text) {
    if (c === q[i]) i++;
    if (i === q.length) return true;
  }
  return q.length === 0;
}

/** `C:\dev\play\otp` -> `play/otp`, for a label that says where it lives. */
export function shortPath(project) {
  return `${project.bucket}/${project.name}`;
}

export { ROOT };
