/**
 * One reactive atom for the whole toolkit surface.
 *
 * Why this exists: every `client:` directive mounts a SEPARATE Svelte root with
 * its own state. The header search bar and the explorer on /toolkit/ were two
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

import { EXPLORER } from './content-map';

export const toolkit = $state({
  query: '',
  tags: [],          // stored Train-Case values, never display labels
  category: '',
  sort: 'depth',
  slugs: new Map(),  // Train-Case -> url slug, registered once by whoever knows
  pathTagSlug: '',   // slug from a /tags/<slug>/ path, resolved when the index lands
  scope: '',         // set by a SCOPED explorer mount; '' means the global catalogue
});

/**
 * Tell the atom this explorer only ever describes a subset — a client portal, the
 * repo list. Scoped mounts own their own URL; see canonicalPath().
 */
export function setScope(path) {
  toolkit.scope = path ?? '';
}

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
 * to /toolkit/. Copy-shareable-link then read one and the address bar showed the
 * other. One owner, one answer.
 */
export function canonicalPath() {
  const q = toolkit.query.trim();
  const tags = toolkit.tags.map((t) => toolkit.slugs.get(t) ?? t);

  /**
   * A SCOPED explorer keeps its filter state on its own path.
   *
   * The two rewrites below are only correct for the global catalogue. On a client
   * portal or /repositories/, swapping the URL to /tags/<slug>/ or /toolkit/ would
   * silently replace the page with a DIFFERENT, unscoped result set — the filter
   * would appear to work, and the link the user copied would open something else
   * entirely. A scoped view has no prerendered single-tag equivalent, so query
   * params on the current path is the honest answer: the page still returns real
   * HTML, still unfurls with its own card, and restores the filter on arrival.
   */
  if (toolkit.scope) {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (tags.length) p.set('tags', tags.join(','));
    if (toolkit.category) p.set('cat', toolkit.category);
    if (toolkit.sort !== 'depth') p.set('sort', toolkit.sort);
    const qs = p.toString();
    return `${toolkit.scope}${qs ? `?${qs}` : ''}`;
  }

  if (tags.length === 1 && !q && !toolkit.category && toolkit.sort === 'depth') {
    return `/tags/${tags[0]}/`;
  }

  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (tags.length) p.set('tags', tags.join(','));
  if (toolkit.category) p.set('cat', toolkit.category);
  if (toolkit.sort !== 'depth') p.set('sort', toolkit.sort);
  const qs = p.toString();
  return `${EXPLORER}${qs ? `?${qs}` : ''}`;
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

  // A canonical /tags/<slug>/ URL carries the selection in the PATH, not a
  // param — and a slug cannot become a tag name until the tag index has
  // loaded. So record it for whoever can resolve it, and DO NOT clear an
  // existing selection on such a page.
  //
  // Clearing here is precisely what broke the tag pages: the server seeded the
  // island with its tag, this ran, set tags to [], and the atom->local bridge
  // then wiped the seed — so /tags/must-have/ rendered the unfiltered first 48
  // of the whole catalogue instead of its 47 tools.
  const paramTags = (p.get('tags') ?? '').split(',').filter(Boolean);
  const onTagPage = window.location.pathname.match(/^\/tags\/([^/]+)\/?$/);
  if (paramTags.length) toolkit.tags = paramTags;
  else if (!onTagPage) toolkit.tags = [];
  toolkit.pathTagSlug = onTagPage ? decodeURIComponent(onTagPage[1]) : '';
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
