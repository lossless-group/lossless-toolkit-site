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
  tags: [],
  category: '',
  sort: 'depth',
});

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
  toolkit.category = p.get('cat') ?? '';
  toolkit.sort = p.get('sort') ?? 'depth';
}

export function writeUrl() {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  const set = (k, v) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
  set('q', toolkit.query.trim());
  set('tags', toolkit.tags.join(','));
  set('cat', toolkit.category);
  set('sort', toolkit.sort === 'depth' ? '' : toolkit.sort);
  history.replaceState(null, '', u.pathname + u.search);
}
