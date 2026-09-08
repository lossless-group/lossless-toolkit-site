/**
 * wikilinks.ts — the site's single wikilink resolver, built from `content-map`.
 *
 * All mechanics (normalisation, the index cascade, ambiguity handling) live in
 * `@lossless-group/lfm`'s `createPathResolver`. This file supplies only the two
 * things that are genuinely per-site: WHICH files exist, and WHERE each vault
 * folder publishes to. Both come from `content-map.ts`, so a folder rename is
 * still a one-line change.
 *
 * Deliberately NOT a chain of `if (path.startsWith(...))` branches. That shape
 * handles the paths its author thought of and silently drops the rest — which
 * is what every other Lossless site currently does, and what this replaces.
 *
 * Failure is graceful and has two distinct flavours, both rendering as plain
 * text with no anchor:
 *
 *   ambiguous     the basename matched several vault files. Resolution STOPS
 *                 here — it does not fall through to a catch-all route, because
 *                 a confidently-wrong link is worse than no link.
 *   not-in-index  nothing matched. The link was probably never written.
 *
 * Both are collected in `diagnostics` for a build-time report rather than
 * thrown, so one bad link cannot fail a build of ~1,900 hand-maintained files.
 */
import { createPathResolver } from '@lossless-group/lfm';
import { wikilinkRoutes, wikilinkTokens, slugify } from './content-map';
import { slugByVaultPath } from './content-api';

/** Raw vault paths, keyed as `tooling/AI-Toolkit/Zod.md`. */
const FILES = import.meta.glob('../content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `../content/tooling/AI-Toolkit/Zod.md` → `tooling/AI-Toolkit/Zod.md` */
const vaultIndex = Object.keys(FILES).map((k) => k.replace(/^\.\.\/content\//, ''));

export interface WikilinkDiagnostic {
  input: string;
  reason: string;
  candidates?: string[];
}

export const diagnostics: WikilinkDiagnostic[] = [];

export const resolver = createPathResolver({
  index: vaultIndex,
  routes: wikilinkRoutes,
  tokens: wikilinkTokens,
  // Same slug function the pages are generated with. Without this the
  // resolver invents its own and links miss by a hyphen.
  slugify,
  // …but the function alone is not enough. A page's slug can come from
  // frontmatter rather than its filename, and only content-api knows that.
  // Look the real slug up per file, and fall back to the filename only when
  // the path is not a published entry.
  slugFrom: (parts) => slugByVaultPath().get(parts.path.toLowerCase()) ?? slugify(parts.name),
  // `suffix` stays in: a rebuild IS a reorganisation, and links written against
  // the old shape should survive it. Every hit reports `via`, so speculative
  // tiers can be audited rather than trusted blindly.
  cascade: ['exact', 'suffix', 'basename'],
  // Refuse to guess between colliding basenames. Measured at 0.7% of bare links.
  onAmbiguous: 'plain',
  onDiagnostic: (d) => diagnostics.push(d),
});

/** Resolution stats, for the build-time report. */
export const stats = { resolved: 0, unresolved: 0, byTier: {} as Record<string, number> };

export interface ResolvedWikilink {
  url: string;
  display: string;
  isLocal: boolean;
  via: string;
}

/**
 * Resolve one wikilink target. Returns `null` when it cannot be settled — the
 * caller renders the display text with no anchor.
 *
 * Accepts the full Obsidian form: `Path/To/Page#Anchor|Display`.
 */
export function resolveWikilink(raw: string): ResolvedWikilink | null {
  const m = /^([^#|]+)(?:#([^|]+))?(?:\|(.*))?$/.exec(raw.trim());
  if (!m) return null;
  const [, path, anchor, display] = m;

  const hit = resolver.resolve(path.trim());

  // `route` means no index tier matched and a prefix rule claimed the path
  // anyway. That is right for a site that mirrors the whole vault; it is WRONG
  // here, because this site publishes a curated subset (199 of ~1,900 upstream
  // files). Letting it through manufactures links to pages that were never
  // built — `[[Tooling/…/Python|Python]]` became a confident /toolkit/python/
  // with no page behind it. An index was supplied, so the index is the
  // authority: if it does not know the file, we do not link it.
  if (!hit || (hit.via === 'route' && !hit.file)) {
    stats.unresolved++;
    return null;
  }

  stats.resolved++;
  stats.byTier[hit.via] = (stats.byTier[hit.via] ?? 0) + 1;

  const frag = anchor ? `#${anchor.trim().toLowerCase().replace(/\s+/g, '-')}` : '';
  // Local routes get a trailing slash to match how every other link on the
  // site is written; external destinations are left exactly as the route
  // template produced them.
  const base = hit.isLocal && !hit.url.endsWith('/') ? `${hit.url}/` : hit.url;

  return {
    url: `${base}${frag}`,
    display: (display ?? hit.display).trim(),
    isLocal: hit.isLocal,
    via: hit.via,
  };
}
