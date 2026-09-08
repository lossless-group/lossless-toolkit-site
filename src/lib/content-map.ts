/**
 * content-map.ts — ONE declaration of how a vault folder becomes a site route.
 *
 * Before this file the same fact was stated in four places: the Astro
 * collection's loader `base`, the `import.meta.glob` pattern in
 * `content-api.ts`, the literal `/tools/` sprinkled through pages and the
 * state atom, and (once wikilinks resolve) the LFM route template. Four
 * copies, no compiler check between them — rename a folder and three of them
 * are silently wrong.
 *
 * Everything below is derived from `AREAS`. Nothing else in the codebase may
 * hardcode a content directory or a route base.
 *
 * The vault/route split is real and is the whole reason this exists: Obsidian
 * authors under `Tooling/`, the site publishes under `/toolkit/`. Those names
 * are allowed to differ and neither is derivable from the other.
 */

export interface ContentArea {
  /** Astro collection id. Also the directory name under `src/content/`. */
  collection: string;
  /**
   * Vault folder as authored in Obsidian, for wikilink matching. Case and
   * separator drift is handled by the resolver (`Tooling` vs `tooling`,
   * `vertical-toolkits` vs `Vertical Toolkits`), so one spelling is enough.
   */
  vault: string | string[];
  /** Site route base. Leading and trailing slash, always. */
  route: string;
  /** Human label, for breadcrumbs and nav. */
  label: string;
}

export const AREAS = [
  {
    collection: 'tooling',
    vault: 'Tooling',
    route: '/toolkit/',
    label: 'Toolkit',
  },
  {
    collection: 'vertical-toolkits',
    vault: 'Vertical Toolkits',
    route: '/verticals/',
    label: 'Verticals',
  },
] as const satisfies readonly ContentArea[];

export type AreaId = (typeof AREAS)[number]['collection'];

const byId = new Map<string, ContentArea>(AREAS.map((a) => [a.collection, a]));

export function area(id: AreaId): ContentArea {
  const a = byId.get(id);
  if (!a) throw new Error(`content-map: no area "${id}"`);
  return a;
}

/** Loader base for `defineCollection`. Astro wants it project-relative. */
export const collectionBase = (id: AreaId) => `./src/content/${area(id).collection}`;

/** Route base — `/toolkit/`. */
export const routeBase = (id: AreaId) => area(id).route;

/** A single entry's URL — `/toolkit/bazel/`. */
export const entryPath = (id: AreaId, slug: string) => `${area(id).route}${slug}/`;

/** Where the browsable catalogue lives. The explorer, search hand-off, and
 *  every "see everything" link resolve through here. */
export const EXPLORER = routeBase('tooling');

/**
 * Route table for LFM's `createPathResolver`.
 *
 * `{slug}` is slugified by the resolver; the vault side is matched
 * case-insensitively and separator-insensitively, so `Tooling/`, `tooling/`
 * and `Tooling ` all land on the same rule.
 */
export const wikilinkRoutes = [
  { match: area('tooling').vault as string | string[], to: `${area('tooling').route}{slug}` },
  {
    // Verticals do NOT publish one page per file — `allVerticals()` groups them
    // by their top-level folder into 11 group pages. A per-entry destination
    // would 404 for every one of them, which is exactly what it did: seven
    // links pointed at /verticals/<company>/ pages that are not built.
    // The group page is the real destination, and it has no per-entry anchors
    // to aim at, so the link stops at the group.
    match: area('vertical-toolkits').vault as string | string[],
    to: `${area('vertical-toolkits').route}{group}`,
  },
];

/**
 * Custom `{token}` expansions for the route templates above, passed straight to
 * `createPathResolver`. `{group}` mirrors the grouping rule in
 * `allVerticals()`: the folder directly under the collection root, or
 * `Cross-Vertical` for a file sitting loose at the top.
 */
export const wikilinkTokens = {
  group: (parts: { segments: string[] }) =>
    slugify(parts.segments.length > 2 ? parts.segments[1] : 'Cross-Vertical'),
};

/**
 * THE slug function. Page URLs and wikilink destinations must agree, and they
 * only agree if they call the same code.
 *
 * This was a real bug: the resolver's default slugifier turned
 * `Apprentice.io.md` into `apprentice-io` while the page generator produced
 * `apprenticeio`, so the wikilink pointed at a page that did not exist. Dots
 * are dropped, not hyphenated — that is the site's convention and the resolver
 * has to be told, because it cannot guess.
 */
export const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
