/**
 * corpus.ts — where the raw markdown comes from. The only module that reads it.
 *
 * Two layers:
 *
 *   1. BASELINE: the vendored copy under `src/content/`, bundled at build time
 *      through `import.meta.glob`. A cold instance renders from this at once,
 *      with no network.
 *   2. OVERLAY: the live state of `lossless-group/lossless-content` at `ref`.
 *      `syncCorpus()` resolves the branch head, lists the two content folders
 *      (three API calls), and compares each file's git blob sha with the
 *      baseline's. Only files that differ are fetched. Deleted and moved files
 *      fall out because the remote tree is the list of record.
 *
 * So a push to the vault reaches the site without a rebuild: the push goes
 * through lossless-hook-relay to `/api/content-hook`, which purges the CDN and
 * forgets the cached head, and the next render syncs. Re-vendoring
 * (`scripts/sync-content.sh`) only shrinks the overlay a cold instance has to
 * fetch; it is never required for freshness.
 *
 * Never throws into a page. If GitHub is unreachable the last good snapshot
 * keeps serving, and a cold instance falls back to the baseline.
 *
 * Keys keep the glob shape (`../content/tooling/<path>.md`) whichever layer a
 * file came from, so `content-api.ts` and `client-tags.ts` parse both alike.
 */
import { createHash } from 'node:crypto';

const BASELINE: Record<string, string> = {
  ...(import.meta.glob('../content/tooling/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  ...(import.meta.glob('../content/vertical-toolkits/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
};

/** Vault folders the site publishes. Each is a top-level folder of the repo. */
const AREAS = ['tooling', 'vertical-toolkits'] as const;
export type CorpusArea = (typeof AREAS)[number];

/**
 * Site-owned fixtures with no vault counterpart. They pin behaviour the corpus
 * cannot be relied on to exhibit, so the overlay keeps them even though the
 * remote tree never lists them.
 */
const FIXTURES = new Set(
  ['Empty Tool Test.md', 'Precedence Test.md', 'Publish False Test.md'].map((f) => `../content/tooling/${f}`),
);

export const SOURCE = {
  repo: 'lossless-group/lossless-content',
  // The relay wakes subscribers on pushes to master, the tier the content repo
  // promotes to once development is in parity.
  ref: 'master',
};

const env = (k: string): string | undefined => (import.meta.env as any)[k] ?? process.env[k];
const token = () => env('GITHUB_TOKEN') ?? env('GITHUB_API_TOKEN');
// CONTENT_SOURCE=baseline pins the vendored copy: offline dev, and the tests.
const pinned = () => env('CONTENT_SOURCE') === 'baseline';

/* ------------------------------------------------------------------ state -- */

let files: Record<string, string> = BASELINE;
let syncedSha = 'baseline';
/** Bumped whenever `files` changes, so derived memos know to rebuild. */
let version = 0;

export const corpusVersion = () => version;
export const corpusSha = () => syncedSha;

/** Every file of one area, keyed `../content/<area>/<path>`. */
export function corpusFiles(area: CorpusArea): Record<string, string> {
  const prefix = `../content/${area}/`;
  return Object.fromEntries(Object.entries(files).filter(([k]) => k.startsWith(prefix)));
}

/* ----------------------------------------------------------------- GitHub -- */

// Same discipline as client-portals-site's github.ts: at most 8 requests in
// flight, ETag on the head lookup, and memos keyed by content-addressed shas,
// which therefore never go stale.
let active = 0;
const queue: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 8) await new Promise<void>((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

function gh(path: string, init: { etag?: string; raw?: boolean } = {}) {
  return limited(() => {
    const headers: Record<string, string> = {
      Accept: init.raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lossless-toolkit-site',
    };
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;
    if (init.etag) headers['If-None-Match'] = init.etag;
    return fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(15_000) });
  });
}

let head: { sha: string; etag?: string; checked: number } | null = null;
const HEAD_TTL = 10_000;

async function headSha(): Promise<string> {
  if (head && Date.now() - head.checked < HEAD_TTL) return head.sha;
  const res = await gh(`/repos/${SOURCE.repo}/commits/${encodeURIComponent(SOURCE.ref)}`, { etag: head?.etag });
  if (res.status === 304 && head) {
    head.checked = Date.now();
    return head.sha;
  }
  if (!res.ok) throw new Error(`GitHub ${res.status} resolving ${SOURCE.repo}@${SOURCE.ref}`);
  const sha = (await res.json()).sha as string;
  head = { sha, etag: res.headers.get('etag') ?? undefined, checked: Date.now() };
  return sha;
}

/** Make the next sync re-check the branch head at once. Called by the hook. */
export function forgetHead() {
  head = null;
}

interface RemoteFile {
  key: string;
  sha: string;
}

const subtrees = new Map<string, Promise<RemoteFile[]>>();
/** Markdown blobs under one area's subtree. Memoized by subtree sha. */
function areaTree(area: CorpusArea, treeSha: string): Promise<RemoteFile[]> {
  if (!subtrees.has(treeSha)) {
    subtrees.set(
      treeSha,
      (async () => {
        const res = await gh(`/repos/${SOURCE.repo}/git/trees/${treeSha}?recursive=1`);
        if (!res.ok) throw new Error(`GitHub ${res.status} listing ${area}`);
        const body = await res.json();
        if (body.truncated) throw new Error(`GitHub truncated the ${area} tree`);
        return (body.tree as { type: string; path: string; sha: string }[])
          .filter((e) => e.type === 'blob' && /\.md$/i.test(e.path))
          .map((e) => ({ key: `../content/${area}/${e.path}`, sha: e.sha }));
      })().catch((e) => {
        subtrees.delete(treeSha);
        throw e;
      }),
    );
  }
  return subtrees.get(treeSha)!;
}

const blobs = new Map<string, Promise<string>>();
function blobText(sha: string): Promise<string> {
  if (!blobs.has(sha)) {
    blobs.set(
      sha,
      (async () => {
        const res = await gh(`/repos/${SOURCE.repo}/git/blobs/${sha}`, { raw: true });
        if (!res.ok) throw new Error(`GitHub ${res.status} reading blob ${sha}`);
        return res.text();
      })().catch((e) => {
        blobs.delete(sha);
        throw e;
      }),
    );
  }
  return blobs.get(sha)!;
}

/** Git's blob id for a string: sha1 of `blob <bytes>\0<content>`. */
function gitBlobSha(text: string): string {
  const buf = Buffer.from(text, 'utf8');
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

let baselineShas: Map<string, string> | null = null;
function baselineSha(key: string): string | undefined {
  if (!baselineShas) baselineShas = new Map(Object.entries(BASELINE).map(([k, v]) => [k, gitBlobSha(v)]));
  return baselineShas.get(key);
}

/* ------------------------------------------------------------------- sync -- */

let inflight: Promise<void> | null = null;

/**
 * Bring the corpus up to the branch head. Cheap when nothing moved: one
 * conditional request at most every few seconds. Concurrent callers share one
 * sync. Never throws.
 */
export function syncCorpus(): Promise<void> {
  if (pinned()) return Promise.resolve();
  inflight ??= doSync()
    .catch((e) => console.warn(`[corpus] serving ${syncedSha}: ${(e as Error).message}`))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function doSync() {
  const sha = await headSha();
  if (sha === syncedSha) return;

  const root = await gh(`/repos/${SOURCE.repo}/git/trees/${sha}`);
  if (!root.ok) throw new Error(`GitHub ${root.status} reading the root tree`);
  const top = (await root.json()).tree as { path: string; type: string; sha: string }[];

  const remote = (
    await Promise.all(
      AREAS.map((area) => {
        const t = top.find((e) => e.type === 'tree' && e.path === area);
        if (!t) throw new Error(`no ${area}/ at ${sha.slice(0, 7)}`);
        return areaTree(area, t.sha);
      }),
    )
  ).flat();

  // Reuse what we already hold (baseline or the previous snapshot) whenever the
  // blob sha matches; fetch the rest. One failed fetch abandons this sync and
  // keeps the previous snapshot whole, rather than serving a half-updated one.
  const previous = files;
  const next: Record<string, string> = {};
  const shas = new Map<string, string>();
  let fetched = 0;
  await Promise.all(
    remote.map(async ({ key, sha: blob }) => {
      if (key in previous && (previousShas.get(key) ?? baselineSha(key)) === blob) {
        next[key] = previous[key];
      } else {
        next[key] = await blobText(blob);
        fetched++;
      }
      shas.set(key, blob);
    }),
  );
  for (const k of FIXTURES) if (k in BASELINE) next[k] = BASELINE[k];

  previousShas = shas;
  files = next;
  syncedSha = sha;
  version++;
  console.log(`[corpus] ${sha.slice(0, 7)}: ${remote.length} files, ${fetched} fetched`);
}

// Blob shas of the snapshot now serving, so the next sync can reuse unchanged
// files without hashing them again.
let previousShas = new Map<string, string>();
