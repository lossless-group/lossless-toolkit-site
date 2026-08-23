import { parseFrontmatter, str, list, type Frontmatter } from './frontmatter';

/**
 * content-api.ts — THE ONLY module in this codebase that touches content.
 *
 * Nothing else globs, reads the filesystem, or parses frontmatter. Pages and
 * islands consume the API-shaped functions at the bottom of this file:
 *
 *     listTools({ tag?, vertical?, category?, query?, limit? })
 *     getTool(slug)
 *     listTags()
 *     listVerticals()
 *     getVertical(slug)
 *     projectForClient(tools)
 *
 * Why an interface rather than direct reads: whether toolkit content is
 * eventually served by a shared Lossless content service or read per-site is a
 * deliberately deferred decision. Today the "endpoints" resolve to local paths
 * via `import.meta.glob`. Swapping them for `await fetch(...)` changes this file
 * and nothing else, because every return shape is plain, serializable data that
 * would survive a trip over the wire.
 *
 * Normalization also lives here and only here: derived titles and slugs, the
 * `publish !== false` rule, image fallbacks, and the `for_clients` strip. Every
 * consumer therefore gets clean data and there is exactly one place to fix.
 *
 * Reads are RAW markdown, deliberately bypassing Astro content collections.
 * Collections use a strict YAML parser plus schema validation — either of which
 * turns one bad key in one of ~1,900 hand-maintained files into a failed build.
 * The corpus is not schema-clean and never will be, so the pipeline is lenient
 * by design.
 */
const TOOL_FILES = import.meta.glob('../content/tooling/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const VERTICAL_FILES = import.meta.glob('../content/vertical-toolkits/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface Tool {
  slug: string;
  title: string;
  /** Vendor site. Absent for ~5% of the corpus. */
  url?: string;
  domain?: string;
  tags: string[];
  category: string;
  subcategory?: string;
  summary: string;
  /** Always populated — falls back to the generated house card. */
  image: string;
  imageIsFallback: boolean;
  favicon?: string;
  body: string;
  /** Ranked 0-100. Drives the default sort so thin entries sink. */
  depth: number;
  vertical?: string;
}

export interface Vertical {
  slug: string;
  name: string;
  title: string;
  summary: string;
  entries: Tool[];
}

export const FALLBACK_OG = '/og/toolkit-card.jpg';

const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';

/** Human-facing tag label. Corpus tags are Pascal-Kebab: `LLM-Gateways`. */
export const tagLabel = (t: string) => t.replace(/-/g, ' ').trim();
export const tagSlug = (t: string) => slugify(t);

function firstParagraph(body: string): string {
  const lines = body.split('\n');
  const buf: string[] = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) {
      if (buf.length) break;
      continue;
    }
    if (l.startsWith('#') || l.startsWith('|') || l.startsWith('>')) {
      if (buf.length) break;
      continue;
    }
    buf.push(l);
    if (buf.join(' ').length > 220) break;
  }
  return buf
    .join(' ')
    .replace(/\[\^?\d+\]/g, '')
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickImage(data: Frontmatter): { image: string; fallback: boolean } {
  for (const key of ['og_image', 'image', 'og_screenshot_url', 'banner_image']) {
    const v = str(data, key);
    // `og_image: "[]"` — a stringified empty array — appears in the corpus and
    // is the exact shape that renders as a broken image if trusted.
    if (v && /^https?:\/\//i.test(v) && !v.includes('[]')) return { image: v, fallback: false };
  }
  return { image: FALLBACK_OG, fallback: true };
}

function hostOf(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------------ anomalies --
 * Leniency without a record is just rot. The build never fails on a bad file,
 * but every point where normalization had to ASSUME something is recorded here
 * and flushed to a markdown report at `/reports/content-anomalies.md`. Markdown
 * because these files are edited in Obsidian, where a JSON blob is useless.
 * Grouped by anomaly type, because the workflow is "fix all the missing titles",
 * never "fix this one file".
 */
export interface Anomaly {
  kind: string;
  file: string;
  field: string;
  found: string;
  assumed: string;
}

const anomalies: Anomaly[] = [];
const seenAnomalies = new Set<string>();

function note(a: Anomaly) {
  const key = `${a.kind}|${a.file}|${a.field}`;
  if (seenAnomalies.has(key)) return;
  seenAnomalies.add(key);
  anomalies.push(a);
}

export function listAnomalies(): Anomaly[] {
  allTools();
  allVerticals();
  return anomalies;
}

function build(path: string, raw: string, rootSegment: string): Tool | null {
  const { data, body } = parseFrontmatter(raw);

  // House convention: missing `publish` means published. Only 443 of 1,764
  // files carry the field — filtering on `=== true` silently drops 75%.
  if (data.publish === false) return null;

  const rel = path.split(`/content/${rootSegment}/`)[1] ?? path;
  const contentPath = `${rootSegment}/${rel}`;
  const segments = rel.replace(/\.md$/, '').split('/');
  const filename = segments[segments.length - 1];
  const dirs = segments.slice(0, -1);

  // Title precedence, applied in exactly one place. None of these fields is
  // reliable and several files carry more than one, so the chain ends in the
  // filename — which always exists. An empty heading must never render.
  const title =
    str(data, 'title') ||
    str(data, 'og_title') ||
    str(data, 'site_name') ||
    str(data, 'og_site_name') ||
    filename;
  if (!str(data, 'title') && !str(data, 'og_title') && !str(data, 'site_name') && !str(data, 'og_site_name')) {
    note({
      kind: 'Missing title (fell back to filename)',
      file: contentPath,
      field: 'title',
      found: 'no `title`, `og_title`, `site_name`, or `og_site_name`',
      assumed: `"${title}"`,
    });
  }
  const slug = slugify(str(data, 'slug') || filename);

  const url = str(data, 'url') || str(data, 'site_url');
  const summary =
    str(data, 'zinger') ||
    str(data, 'og_description') ||
    str(data, 'description_site_cp') ||
    str(data, 'description') ||
    firstParagraph(body) ||
    '';

  const tags = list(data, 'tags').map((t) => t.trim()).filter(Boolean);
  if (!tags.length) {
    note({
      kind: 'No tags',
      file: contentPath,
      field: 'tags',
      found: 'absent or empty',
      assumed: 'entry is reachable by search and category, but never by a tag filter',
    });
  }

  const { image, fallback } = pickImage(data);
  if (fallback) {
    const rawImg = data.og_image === undefined ? 'absent' : JSON.stringify(data.og_image);
    note({
      kind: 'Unusable og_image',
      file: contentPath,
      field: 'og_image',
      found: rawImg,
      assumed: 'the generated house share card',
    });
  }
  if (!str(data, 'slug')) {
    note({
      kind: 'Derived slug',
      file: contentPath,
      field: 'slug',
      found: 'absent',
      assumed: `/tools/${slug}/`,
    });
  }
  if (!url) {
    note({
      kind: 'No vendor URL',
      file: contentPath,
      field: 'url',
      found: 'absent',
      assumed: 'the entry renders without an outbound link',
    });
  }
  if (!summary) {
    note({
      kind: 'No description of any kind',
      file: contentPath,
      field: 'zinger / og_description / description',
      found: 'absent, and the body yielded no usable first paragraph',
      assumed: 'an empty summary — the share card will carry the page title only',
    });
  }

  const category = dirs[0] || 'Uncategorized';
  const subcategory = dirs[1];

  // Depth score: how much there is to actually read. Used for default ordering
  // so an entry with a real writeup outranks a bare stub.
  const depth = Math.min(
    100,
    Math.round(
      (body.trim().length > 4000 ? 40 : body.trim().length > 1200 ? 25 : body.trim().length > 200 ? 10 : 0) +
        (tags.length ? Math.min(20, tags.length * 4) : 0) +
        (summary.length > 60 ? 20 : summary ? 10 : 0) +
        (fallback ? 0 : 15) +
        (url ? 5 : 0)
    )
  );

  return {
    slug,
    title,
    url,
    domain: hostOf(url),
    tags,
    category,
    subcategory,
    summary,
    image,
    imageIsFallback: fallback,
    favicon: str(data, 'og_favicon'),
    body,
    depth,
  };
}

function dedupe(tools: Tool[]): Tool[] {
  const seen = new Map<string, Tool>();
  for (const t of tools) {
    const existing = seen.get(t.slug);
    if (!existing) {
      seen.set(t.slug, t);
      continue;
    }
    // Deterministic collision handling — keep the richer entry, re-slug the other.
    const loser = existing.depth >= t.depth ? t : existing;
    const winner = existing.depth >= t.depth ? existing : t;
    seen.set(winner.slug, winner);
    let n = 2;
    while (seen.has(`${loser.slug}-${n}`)) n++;
    seen.set(`${loser.slug}-${n}`, { ...loser, slug: `${loser.slug}-${n}` });
  }
  return [...seen.values()];
}

let _tools: Tool[] | null = null;

export function allTools(): Tool[] {
  if (_tools) return _tools;
  const out: Tool[] = [];
  for (const [path, raw] of Object.entries(TOOL_FILES)) {
    const t = build(path, raw, 'tooling');
    if (t) out.push(t);
  }
  _tools = dedupe(out).sort((a, b) => b.depth - a.depth || a.title.localeCompare(b.title));
  return _tools;
}

let _verticals: Vertical[] | null = null;

export function allVerticals(): Vertical[] {
  if (_verticals) return _verticals;
  const groups = new Map<string, Tool[]>();
  for (const [path, raw] of Object.entries(VERTICAL_FILES)) {
    const t = build(path, raw, 'vertical-toolkits');
    if (!t) continue;
    const rel = path.split('/content/vertical-toolkits/')[1] ?? '';
    const seg = rel.split('/');
    const name = seg.length > 1 ? seg[0] : 'Cross-Vertical';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push({ ...t, vertical: name });
  }
  _verticals = [...groups.entries()]
    .map(([name, entries]) => {
      const deduped = dedupe(entries).sort((a, b) => b.depth - a.depth || a.title.localeCompare(b.title));
      return {
        slug: slugify(name),
        name,
        title: name.replace(/-/g, ' '),
        summary: `${deduped.length} companies and tools catalogued under ${name.replace(/-/g, ' ')}.`,
        entries: deduped,
      };
    })
    .sort((a, b) => b.entries.length - a.entries.length);
  return _verticals;
}

export interface TagFacet {
  tag: string;
  slug: string;
  label: string;
  count: number;
}

export function tagFacets(minCount = 1): TagFacet[] {
  const counts = new Map<string, number>();
  for (const t of allTools()) for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .map(([tag, count]) => ({ tag, slug: tagSlug(tag), label: tagLabel(tag), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function categoryFacets(): TagFacet[] {
  const counts = new Map<string, number>();
  for (const t of allTools()) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, slug: tagSlug(tag), label: tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function toolBySlug(slug: string): Tool | undefined {
  return allTools().find((t) => t.slug === slug);
}

/**
 * The payload the browser receives. This shape is the enforcement point for the
 * `for_clients` no-emit rule at the client boundary: it is an explicit
 * allowlist, so a field added to `Tool` later cannot silently reach the bundle.
 * (`for_clients` is already dropped at parse time — this is defence in depth.)
 * `body` is excluded too: 170 full markdown bodies would be a multi-megabyte
 * download for a search index that only ever matches on title, summary, and tags.
 */
export interface ClientTool {
  s: string; // slug
  t: string; // title
  d: string; // summary
  g: string[]; // tags
  c: string; // category
  i: string; // image
  h?: string; // host
  k: string; // prebuilt lowercase haystack
}

export function projectForClient(tools: Tool[] = allTools()): ClientTool[] {
  return tools.map((t) => ({
    s: t.slug,
    t: t.title,
    d: t.summary.length > 180 ? `${t.summary.slice(0, 177)}…` : t.summary,
    g: t.tags,
    c: t.category,
    i: t.image,
    h: t.domain,
    k: `${t.title} ${t.summary} ${t.tags.join(' ')} ${t.category} ${t.domain ?? ''}`.toLowerCase(),
  }));
}

/* ==========================================================================
   The API surface. Everything above is implementation; everything a page or
   island is allowed to call is below. Each of these could be an HTTP handler
   tomorrow without a single consumer changing.
   ========================================================================== */

export interface ListToolsQuery {
  /** Exact corpus tag, e.g. `LLM-Gateways`. */
  tag?: string;
  /** Tag slug, e.g. `llm-gateways`. Resolved to the corpus tag. */
  tagSlug?: string;
  category?: string;
  vertical?: string;
  query?: string;
  limit?: number;
}

export function listTools(q: ListToolsQuery = {}): Tool[] {
  let pool = q.vertical ? (getVertical(q.vertical)?.entries ?? []) : allTools();

  const tag = q.tag ?? (q.tagSlug ? listTags().find((f) => f.slug === q.tagSlug)?.tag : undefined);
  if (tag) pool = pool.filter((t) => t.tags.includes(tag));
  if (q.category) pool = pool.filter((t) => t.category === q.category);
  if (q.query) {
    const words = q.query.toLowerCase().split(/\s+/).filter(Boolean);
    pool = pool.filter((t) => {
      const hay = `${t.title} ${t.summary} ${t.tags.join(' ')} ${t.category}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  return q.limit ? pool.slice(0, q.limit) : pool;
}

export function getTool(slug: string): Tool | undefined {
  return toolBySlug(slug);
}

export function listTags(minCount = 1): TagFacet[] {
  return tagFacets(minCount);
}

export function listCategories(): TagFacet[] {
  return categoryFacets();
}

export function listVerticals(): Vertical[] {
  return allVerticals();
}

export function getVertical(slug: string): Vertical | undefined {
  return allVerticals().find((v) => v.slug === slug);
}

/** Corpus-wide counts for the landing page. Cheap, and avoids shipping the list. */
export function stats() {
  const tools = allTools();
  const verticals = allVerticals();
  return {
    tools: tools.length,
    tags: tagFacets().length,
    categories: categoryFacets().length,
    verticals: verticals.length,
    verticalEntries: verticals.reduce((n, v) => n + v.entries.length, 0),
    withOwnImage: tools.filter((t) => !t.imageIsFallback).length,
  };
}
