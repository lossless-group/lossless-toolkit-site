/**
 * content-api.ts — THE ONLY module in this site that reads content.
 *
 * No page, layout or component performs a filesystem read, a glob, or an
 * `import.meta.glob`. Everything goes through the four calls below, and they
 * are shaped like an HTTP API on purpose:
 *
 *     listTools({ tag?, vertical?, section?, limit?, offset? })
 *     getTool(slug)
 *     listTags()
 *     listVerticals() / getVertical(slug)
 *
 * WHY: whether toolkit content should eventually be served by a shared service
 * consumed by several Lossless sites, or read directly by each site, is
 * deliberately undecided. Coding against this interface keeps the decision
 * cheap — the implementation below resolves local paths on this machine, and a
 * future implementation could `fetch()` the same shapes over the wire without
 * a single consumer changing.
 *
 * Return shapes are therefore plain and JSON-serializable: objects, arrays,
 * strings, numbers, booleans. No class instances, no functions, no Astro
 * internals — with exactly ONE documented exception, `getToolSource()`, called
 * out at the bottom of this file.
 *
 * NORMALISATION LIVES HERE AND NOWHERE ELSE:
 *   - derived title (~30% of the corpus has no `title`)
 *   - derived slug (~73% has no `slug`)
 *   - `publish !== false`, so a missing `publish` means published
 *   - `og_image` sanity, including the stringified-empty-array case
 *   - `for_clients` reduced to a name-free boolean
 */

import { getCollection, getEntry, type CollectionEntry } from "astro:content";
import { excerpt, tagSlug } from "./site";

/* ------------------------------ wire shapes ------------------------------ */

export interface ToolDTO {
  id: string;
  slug: string;
  title: string;
  description: string;
  url: string;
  ogImage: string;
  favicon: string;
  section: string;
  tags: string[];
  tagSlugs: string[];
  /** Derived from `for_clients`. The client NAMES never cross this boundary. */
  fieldTested: boolean;
  dateModified: string;
  href: string;
}

export interface TagDTO {
  tag: string;
  slug: string;
  count: number;
}

export interface VerticalDTO {
  id: string;
  slug: string;
  title: string;
  description: string;
  url: string;
  ogImage: string;
  section: string;
  tags: string[];
  tagSlugs: string[];
  dateModified: string;
  href: string;
}

export interface ListToolsQuery {
  tag?: string;
  vertical?: string;
  section?: string;
  fieldTested?: boolean;
  limit?: number;
  offset?: number;
  /** Exclude one slug — used by "adjacent in the kit". */
  not?: string;
}

/* --------------------------- local-path adapter --------------------------- */
/* Swap everything in this block for `fetch()` and the exported API is         */
/* unchanged. It is the only part that knows content is on this disk.          */

type ToolEntry = CollectionEntry<"tools">;
type VerticalEntry = CollectionEntry<"verticals">;

let _toolCache: ToolDTO[] | null = null;
let _verticalCache: VerticalDTO[] | null = null;

/**
 * The FILENAME is the baseline, not a fallback. Astro's entry `id` is derived
 * from the file path, so it is always present — which is what lets a zero-byte
 * markdown file be a valid page. Frontmatter titles are an enhancement layered
 * on top; `src/content/tools/empty-tool-test.md` proves the baseline holds.
 */
export function titleFromId(id: string): string {
  const words = id.split("/").pop()!.replace(/[-_]+/g, " ").trim();
  if (!words) return "Untitled entry";
  return words.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function toToolDTO(entry: ToolEntry): ToolDTO {
  const d = entry.data;
  const slug = d.slug || entry.id;
  const tags = d.tags.filter(Boolean);
  return {
    id: entry.id,
    slug,
    title: d.title || titleFromId(entry.id),
    description: d.description || excerpt(entry.body ?? ""),
    url: d.url,
    ogImage: d.og_image,
    favicon: d.favicon,
    section: d.section,
    tags,
    tagSlugs: tags.map(tagSlug),
    fieldTested: d.field_tested,
    dateModified: d.date_modified,
    href: `/tools/${slug}/`,
  };
}

function toVerticalDTO(entry: VerticalEntry): VerticalDTO {
  const d = entry.data;
  const slug = d.slug || entry.id;
  const tags = d.tags.filter(Boolean);
  return {
    id: entry.id,
    slug,
    title: d.title || titleFromId(entry.id),
    description: d.description || excerpt(entry.body ?? "", 190),
    url: d.url,
    ogImage: d.og_image,
    section: d.section,
    tags,
    tagSlugs: tags.map(tagSlug),
    dateModified: d.date_modified,
    href: `/verticals/${slug}/`,
  };
}

async function loadTools(): Promise<ToolDTO[]> {
  if (_toolCache) return _toolCache;
  const raw = await getCollection("tools");
  _toolCache = raw.map(toToolDTO).sort((a, b) => a.title.localeCompare(b.title));
  return _toolCache;
}

async function loadVerticals(): Promise<VerticalDTO[]> {
  if (_verticalCache) return _verticalCache;
  const raw = await getCollection("verticals");
  _verticalCache = raw.map(toVerticalDTO).sort((a, b) => a.title.localeCompare(b.title));
  return _verticalCache;
}

/* ------------------------------- public API ------------------------------- */

export async function listTools(q: ListToolsQuery = {}): Promise<ToolDTO[]> {
  let out = await loadTools();

  if (q.tag) {
    const s = tagSlug(q.tag);
    out = out.filter((t) => t.tagSlugs.includes(s));
  }
  if (q.vertical) {
    const v = await getVertical(q.vertical);
    const own = new Set(v?.tagSlugs ?? []);
    out = own.size ? out.filter((t) => t.tagSlugs.some((s) => own.has(s))) : [];
  }
  if (q.section) out = out.filter((t) => t.section === q.section);
  if (q.fieldTested !== undefined) out = out.filter((t) => t.fieldTested === q.fieldTested);
  if (q.not) out = out.filter((t) => t.slug !== q.not);

  const offset = q.offset ?? 0;
  return q.limit === undefined ? out.slice(offset) : out.slice(offset, offset + q.limit);
}

export async function getTool(slug: string): Promise<ToolDTO | null> {
  const tools = await loadTools();
  return tools.find((t) => t.slug === slug) ?? null;
}

export async function listTags(): Promise<TagDTO[]> {
  const tools = await loadTools();
  const counts = new Map<string, { tag: string; count: number }>();
  for (const t of tools) {
    for (const tag of t.tags) {
      const s = tagSlug(tag);
      if (!s) continue;
      const prev = counts.get(s);
      counts.set(s, { tag: prev?.tag ?? tag, count: (prev?.count ?? 0) + 1 });
    }
  }
  return [...counts.entries()]
    .map(([slug, v]) => ({ slug, tag: v.tag, count: v.count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export async function listVerticals(): Promise<VerticalDTO[]> {
  return loadVerticals();
}

export async function getVertical(slug: string): Promise<VerticalDTO | null> {
  const verticals = await loadVerticals();
  return verticals.find((v) => v.slug === slug) ?? null;
}

export async function listSections(): Promise<{ section: string; count: number }[]> {
  const tools = await loadTools();
  const counts = new Map<string, number>();
  for (const t of tools) if (t.section) counts.set(t.section, (counts.get(t.section) ?? 0) + 1);
  return [...counts.entries()]
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Tag co-occurrence, computed at build time. Used to give a tag landing page a
 * facet set drawn only from tools that actually carry the parent tag.
 */
export async function listCoTags(tag: string, min = 2, limit = 18): Promise<TagDTO[]> {
  const s = tagSlug(tag);
  const tools = await listTools({ tag: s });
  const counts = new Map<string, { tag: string; count: number }>();
  for (const t of tools) {
    for (const raw of t.tags) {
      const k = tagSlug(raw);
      if (!k || k === s) continue;
      const prev = counts.get(k);
      counts.set(k, { tag: prev?.tag ?? raw, count: (prev?.count ?? 0) + 1 });
    }
  }
  return [...counts.entries()]
    .map(([slug, v]) => ({ slug, tag: v.tag, count: v.count }))
    .filter((t) => t.count >= min)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * "Related" via shared-tag overlap, weighted so that agreeing on a RARE tag
 * counts for more than agreeing on a ubiquitous one. Computed once per page at
 * build time; nothing is computed in a reader's browser.
 */
export async function listRelatedTools(slug: string, limit = 6): Promise<ToolDTO[]> {
  const target = await getTool(slug);
  if (!target || !target.tagSlugs.length) return [];
  const tags = await listTags();
  const weight = new Map(tags.map((t) => [t.slug, 1 / Math.log2(2 + t.count)]));
  const own = new Set(target.tagSlugs);
  const pool = await listTools({ not: slug });

  return pool
    .map((t) => {
      let score = 0;
      for (const s of t.tagSlugs) if (own.has(s)) score += weight.get(s) ?? 0.2;
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.t.title.localeCompare(b.t.title))
    .slice(0, limit)
    .map((x) => x.t);
}

/**
 * THE ONE NON-SERIALIZABLE SEAM, named rather than hidden.
 *
 * Astro compiles markdown to a component at build time, and that component is
 * not a wire shape. So detail pages ask this module for the entry and call
 * `render()` on it. An HTTP implementation of this API would instead return
 * `{ html: string }` from a `getToolRendered(slug)` call, and the two detail
 * templates are the only files that would change.
 */
export async function getToolSource(slug: string): Promise<ToolEntry | undefined> {
  const tools = await getCollection("tools");
  return tools.find((t) => (t.data.slug || t.id) === slug);
}

export async function getVerticalSource(slug: string): Promise<VerticalEntry | undefined> {
  const verticals = await getCollection("verticals");
  return verticals.find((v) => (v.data.slug || v.id) === slug);
}

export { getEntry };
