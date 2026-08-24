/**
 * One reactive atom for the whole toolkit surface.
 *
 * Why this exists: every `client:` directive mounts a SEPARATE Svelte root with
 * its own state. The header search bar and the explorer on /tools/ were two
 * disconnected apps that happened to read the same query params, so selecting a
 * tag in one could only reach the other by navigating. That is islands used
 * where an application was wanted.
 *
 * A module-level `$state` object is a singleton across every island that imports
 * it (Vite dedupes the module), so mutating `toolkit.tags` here updates the
 * search bar, the chips and the results grid in the same tick — no navigation,
 * no prop drilling, no custom events.
 *
 * The URL stays the serialisation of this atom rather than its source of truth:
 * hydrate from it once, write back on change, so any state reached is sendable.
 */

export const toolkit = $state({
  query: '',
  tags: [],          // stored Train-Case values, never display labels
  category: '',
  sort: 'depth',
  slugs: new Map(),  // Train-Case -> url slug, registered once by whoever knows
});

/** The explorer loads the tag index; it teaches the atom how to build paths. */
export function registerSlugs(pairs) {
  toolkit.slugs = new Map(pairs);
}

/**
 * The single implementation of state -> URL.
 *
 * Collapses to the canonical prerendered route when exactly one tag is selected
 * and nothing else narrows — that page has its own title, share card and
 * metadata, so the link unfurls specifically instead of generically. Anything
 * richer has no prerendered equivalent and falls back to query parameters on
 * the explorer, which restores the same state on arrival.
 *
 * This previously existed twice — here and in ToolExplorer — and the two raced,
 * so whichever wrote last won and the canonical path kept getting clobbered back
 * to /tools/. Copy-shareable-link then read one and the address bar showed the
 * other. One owner, one answer.
 */
export function canonicalPath() {
  const q = toolkit.query.trim();
  const tags = toolkit.tags.map((t) => toolkit.slugs.get(t) ?? t);

  if (tags.length === 1 && !q && !toolkit.category && toolkit.sort === 'depth') {
    return `/tags/${tags[0]}/`;
  }

  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (tags.length) p.set('tags', tags.join(','));
  if (toolkit.category) p.set('cat', toolkit.category);
  if (toolkit.sort !== 'depth') p.set('sort', toolkit.sort);
  const qs = p.toString();
  return `/tools/${qs ? `?${qs}` : ''}`;
}

export function shareUrl() {
  return new URL(canonicalPath(), location.origin).href;
}

export function toggleTag(tag) {
  toolkit.tags = toolkit.tags.includes(tag)
    ? toolkit.tags.filter((t) => t !== tag)
    : [...toolkit.tags, tag];
  writeUrl();
}

export function popTag() {
  if (toolkit.tags.length) {
    toolkit.tags = toolkit.tags.slice(0, -1);
    writeUrl();
  }
}

export function setQuery(q) {
  toolkit.query = q;
  writeUrl();
}

export function clearAll() {
  toolkit.query = '';
  toolkit.tags = [];
  writeUrl();
}

/** Read once on boot. Safe to call from several islands; last write wins. */
export function hydrateFromUrl() {
  if (typeof window === 'undefined') return;
  const p = new URL(window.location.href).searchParams;
  toolkit.query = p.get('q') ?? '';
  toolkit.tags = (p.get('tags') ?? '').split(',').filter(Boolean);
  // A canonical /tags/<slug>/ URL carries the selection in the path, not a param.
  const m = window.location.pathname.match(/^\/tags\/([^/]+)\/?$/);
  if (m && !toolkit.tags.length) toolkit.pendingSlug = decodeURIComponent(m[1]);
  toolkit.category = p.get('cat') ?? '';
  toolkit.sort = p.get('sort') ?? 'depth';
}

export function writeUrl() {
  if (typeof window === 'undefined') return;
  const next = canonicalPath();
  if (location.pathname + location.search !== next) {
    history.replaceState(null, '', next);
  }
}
