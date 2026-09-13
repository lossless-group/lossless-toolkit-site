/**
 * client-tags.ts — the ONLY reader of `for_clients` in the codebase.
 *
 * `for_clients` is stripped by the DENY set in `frontmatter.ts` before it can
 * enter the data model, and that stays true: this module does not go through
 * the normal parse. It reads the raw markdown a second time, pulls only the
 * client list, and hands back slugs.
 *
 * The rule it must not break: `for_clients` values never reach a rendered byte.
 * This module returns TOOL SLUGS, never client names, so a caller cannot
 * accidentally print one. The portal page maps a client to their tools and
 * renders the tools; the client string itself stops here.
 *
 * Matching is slug-based for the same reason everything else in this codebase
 * is: the corpus drifts. `Reach` and `Reach-U`, `FullStackVC` and
 * `- FullStackVC` (a YAML list-dash that survived into the value) are the same
 * client typed differently.
 */
const RAW = import.meta.glob('../content/tooling/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const clientSlug = (s: string): string =>
  s.replace(/^-\s*/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Every `for_clients` value on one file, normalised to slugs. */
function clientsOf(raw: string): string[] {
  const m = raw.match(/^for_clients:\s*(.*)$((?:\n[ \t]*-.*)*)/m);
  if (!m) return [];
  const inline = (m[1] ?? '').trim();
  const values = inline.startsWith('[')
    ? inline.slice(1, -1).split(',')
    : inline
      ? [inline]
      : [];
  for (const line of (m[2] ?? '').split('\n')) {
    if (line.trim()) values.push(line);
  }
  return values.map((v) => clientSlug(v.replace(/["']/g, ''))).filter(Boolean);
}

let index: Map<string, Set<string>> | null = null;

/**
 * client slug -> set of glob PATHS. Keyed on the path rather than a re-derived
 * slug on purpose: a tool's slug comes from frontmatter when present and only
 * falls back to the filename, so deriving it a second time here would be the
 * same two-inputs-one-slug bug that broke 16 wikilinks. content-api carries the
 * identical path on `Tool.sourcePath`, so the join is exact.
 */
function buildIndex(): Map<string, Set<string>> {
  if (index) return index;
  index = new Map();
  for (const [path, raw] of Object.entries(RAW)) {
    for (const c of clientsOf(raw)) {
      if (!index.has(c)) index.set(c, new Set());
      index.get(c)!.add(path);
    }
  }
  return index;
}

/** Source paths of tools tagged for this client. Empty when none. */
export function toolPathsForClient(clientSlugName: string): Set<string> {
  return buildIndex().get(clientSlug(clientSlugName)) ?? new Set();
}

/** Every client slug present in the corpus, with a count. Build-time only. */
export function clientCounts(): { slug: string; count: number }[] {
  return [...buildIndex().entries()]
    .map(([slug, files]) => ({ slug, count: files.size }))
    .sort((a, b) => b.count - a.count);
}
