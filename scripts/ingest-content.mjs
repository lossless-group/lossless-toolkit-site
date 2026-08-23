#!/usr/bin/env node
/**
 * ingest-content.mjs — the sanitizing boundary between the Lossless `content`
 * corpus and this site's content collections.
 *
 * Two house rules are enforced HERE, at ingest, rather than at render:
 *
 *   1. LENIENT FRONTMATTER PARSE. The corpus frontmatter is inconsistent by
 *      nature (1764 files, hand-authored + machine-appended). A strict YAML
 *      parser would fail the build on one bad key. This parser is line-based:
 *      a key it cannot understand is DROPPED, and the document survives.
 *
 *   2. `for_clients` NEVER CROSSES THE BOUNDARY. The array names client
 *      organisations. It is legitimate as an *input* and forbidden as an
 *      *output*. Rather than remembering not to render it in a dozen
 *      templates, we consume it here and emit only a derived, name-free
 *      boolean (`field_tested`). The site cannot leak what it never receives.
 *
 * Output is normalised, JSON-quoted YAML that Astro's collection loader can
 * parse strictly and safely.
 *
 * Usage: node scripts/ingest-content.mjs [--tools N] [--verticals N]
 */

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const CORPUS = "/home/mps/code/lossless-monorepo/content";
const TOOLING_SRC = path.join(CORPUS, "tooling");
const VERTICAL_SRC = path.join(CORPUS, "vertical-toolkits");
const OUT_ROOT = path.resolve(import.meta.dirname, "..", "src", "content");

const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : Number(argv[i + 1]);
};
const WANT_TOOLS = argOf("tools", 180);
const WANT_VERTICALS = argOf("verticals", 26);

/* ------------------------------------------------------------------ */
/* Lenient frontmatter parser                                          */
/* ------------------------------------------------------------------ */

/**
 * PROPERTY-LEVEL RECOVERY, per the house reminder
 * `astro-knots/context-v/reminders/YAML-Frontmatter-Parsing-Must-Be-Lenient.md`.
 *
 * Layer 1 — a REAL YAML parser, because the corpus genuinely mixes flow style
 * (`tags: [Foo, Bar]`, 895 files) with block style (`tags:\n  - Foo`, 810
 * files) and a hand-rolled regex silently mangles one of them. But it is used
 * through `YAML.parseDocument()`, not `parse()`: the document API returns a
 * tree with non-fatal errors attached, so each top-level key can be
 * materialised INDIVIDUALLY inside a try/catch. A key that throws is dropped
 * with a warning; every other key survives, and the document survives.
 *
 * Layer 2 — if the frontmatter is broken badly enough that even
 * `parseDocument` cannot produce a mapping, a line-based recovery pass reads
 * the shapes the corpus actually uses. Still never fatal.
 *
 * The rule this enforces: a nonconforming file must not fail the build, and a
 * single bad key must not lose the file.
 */
export function parseFrontmatterLenient(raw, file = "<unknown>") {
  if (!raw.startsWith("---")) return { data: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: raw };

  const block = raw.slice(raw.indexOf("\n") + 1, end);
  const body = raw.slice(raw.indexOf("\n", end + 1) + 1);

  const viaYaml = parseViaDocumentApi(block, file);
  if (viaYaml && Object.keys(viaYaml).length) return { data: viaYaml, body };

  return { data: parseByLineRecovery(block), body };
}

/** Layer 1. Materialise one key at a time so one bad key drops one key. */
function parseViaDocumentApi(block, file) {
  let doc;
  try {
    doc = YAML.parseDocument(block, { strict: false, uniqueKeys: false, logLevel: "silent" });
  } catch (err) {
    warn(file, "*", `document unparseable (${err.message}) — falling back to line recovery`);
    return null;
  }
  if (!doc || !doc.contents || !Array.isArray(doc.contents.items)) return null;

  const out = {};
  for (const pair of doc.contents.items) {
    let key;
    try {
      key = String(pair.key?.value ?? pair.key);
    } catch {
      continue;
    }
    if (!key || key === "undefined") continue;
    try {
      const value = pair.value ? pair.value.toJSON() : null;
      const norm = normaliseValue(value);
      if (norm !== undefined) out[key] = norm;
    } catch (err) {
      // Drop the key. Keep the document. This is the whole point.
      warn(file, key, err.message);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Anomaly accumulator                                                  */
/*                                                                      */
/* Leniency without a record turns content problems invisible. The      */
/* build never fails; instead every point at which we had to ASSUME     */
/* something is recorded, grouped by anomaly type, and flushed to       */
/* `reports/content-anomalies.md` — markdown, because these files are   */
/* actually edited in Obsidian and the report has to be readable and    */
/* actionable there (and by an agent asked to batch-fix one category).  */
/* ------------------------------------------------------------------ */

const anomalies = new Map();

function anomaly(kind, relPath, detail) {
  if (!anomalies.has(kind)) anomalies.set(kind, []);
  anomalies.get(kind).push({ relPath, detail });
}

const ANOMALY_ORDER = [
  ["missing-title", "Missing title (fell back to filename)"],
  ["missing-slug", "Missing slug (derived from title)"],
  ["unusable-og-image", "Unusable og_image (fell back to house share card)"],
  ["missing-og-image", "No og_image at all (fell back to house share card)"],
  ["missing-url", "No url — the entry links nowhere"],
  ["no-tags", "No tags — the entry appears on no tag page"],
  ["dropped-key", "Frontmatter key dropped by the lenient parser"],
  ["unparseable-frontmatter", "Frontmatter needed line-level recovery"],
  ["publish-false", "Explicitly unpublished (respected — the one real rule)"],
];

function writeAnomalyReport(outFile, scanned) {
  const total = [...anomalies.values()].reduce((n, l) => n + l.length, 0);
  const now = new Date().toISOString().slice(0, 10);

  const lines = [
    "---",
    'title: "Content Anomalies"',
    `lede: "Everything a strict validator would have rejected. The build stayed green; this is the worklist."`,
    `date_created: ${now}`,
    `date_modified: ${now}`,
    "tags:",
    "  - Content-Health",
    "  - Frontmatter",
    "publish: false",
    "---",
    "",
    "# Content anomalies",
    "",
    `Generated by \`scripts/ingest-content.mjs\` on ${now}. ${scanned} source files scanned, ` +
      `${total} ${total === 1 ? "anomaly" : "anomalies"} recorded.`,
    "",
    "Nothing here failed the build. Every one of these is a place where the pipeline had to",
    "assume something on the author's behalf. Paths are relative to the `content` repo root, so",
    "they resolve directly in Obsidian.",
    "",
    "## Summary",
    "",
    "| Anomaly | Count |",
    "| --- | ---: |",
  ];

  for (const [kind, label] of ANOMALY_ORDER) {
    const list = anomalies.get(kind);
    if (list?.length) lines.push(`| ${label} | ${list.length} |`);
  }
  for (const [kind, list] of anomalies) {
    if (!ANOMALY_ORDER.some(([k]) => k === kind) && list.length) {
      lines.push(`| ${kind} | ${list.length} |`);
    }
  }
  lines.push("");

  const emit = (kind, label) => {
    const list = anomalies.get(kind);
    if (!list?.length) return;
    lines.push(`## ${label}`, "");
    lines.push(`${list.length} ${list.length === 1 ? "file" : "files"}.`, "");
    for (const a of list.slice(0, 300)) {
      lines.push(`- \`${a.relPath}\` — ${a.detail}`);
    }
    if (list.length > 300) lines.push(`- …and ${list.length - 300} more.`);
    lines.push("");
  };

  for (const [kind, label] of ANOMALY_ORDER) emit(kind, label);
  for (const [kind, list] of anomalies) {
    if (!ANOMALY_ORDER.some(([k]) => k === kind)) emit(kind, kind);
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, lines.join("\n") + "\n");
  console.log(`anomaly report: ${total} recorded → ${path.relative(process.cwd(), outFile)}`);
}

const warned = new Set();
function warn(file, key, message) {
  const sig = `${file}:${key}`;
  if (warned.has(sig)) return;
  warned.add(sig);
  anomaly(key === "*" ? "unparseable-frontmatter" : "dropped-key", relToCorpus(file),
    key === "*" ? message : `key \`${key}\` — ${message}`);
}

function relToCorpus(file) {
  return path.relative(CORPUS, file);
}

/** Coerce whatever YAML produced into the flat shapes this site consumes. */
function normaliseValue(v) {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") {
    const s = cleanScalar(v);
    return s === null ? undefined : s;
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === "string" ? cleanScalar(x) : x == null ? null : String(x)))
      .filter((x) => x !== null && x !== "");
  }
  // Nested maps have no consumer here. Drop the key rather than guess.
  return undefined;
}

/** Layer 2 — line recovery. Handles both tag syntaxes the corpus uses. */
function parseByLineRecovery(block) {
  const data = {};
  const lines = block.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    i++;
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    // Only top-level keys. Indented lines are consumed by their owner below.
    if (/^\s/.test(line)) continue;

    const m = line.match(/^([A-Za-z0-9_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue; // unparseable line -> drop it, keep the document
    const key = m[1];
    const rest = m[2];

    if (rest === "") {
      // Possible block sequence.
      const items = [];
      while (i < lines.length && /^\s+-\s+/.test(lines[i])) {
        items.push(cleanScalar(lines[i].replace(/^\s+-\s+/, "")));
        i++;
      }
      // Skip any other indented continuation we do not model.
      while (i < lines.length && /^\s+\S/.test(lines[i])) i++;
      if (items.length) data[key] = items.filter(Boolean);
      continue;
    }

    if (rest.startsWith("[")) {
      const inner = rest.replace(/^\[/, "").replace(/\]\s*$/, "");
      const items = inner
        .split(",")
        .map((s) => cleanScalar(s))
        .filter(Boolean);
      data[key] = items; // may legitimately be []
      continue;
    }

    const v = cleanScalar(rest);
    if (v !== null && v !== "") data[key] = v;
  }

  return data;
}

function cleanScalar(s) {
  let v = String(s).trim();
  // Strip a trailing inline comment only when clearly outside quotes.
  if (!/^["']/.test(v)) v = v.replace(/\s+#\s.*$/, "");
  v = v.trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length > 1) ||
    (v.startsWith("'") && v.endsWith("'") && v.length > 1)
  ) {
    v = v.slice(1, -1);
  }
  v = v.trim();
  if (v === "null" || v === "~") return null;
  return v;
}

/**
 * The corpus contains stringified empty arrays (`og_image: "[]"`), bare `[]`,
 * empty strings, and the literal word "undefined". None of these are URLs.
 */
export function usableUrl(v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (s === "[]" || s === "{}" || s === "undefined" || s === "null") return null;
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
}

/* ------------------------------------------------------------------ */
/* Derivation                                                          */
/* ------------------------------------------------------------------ */

export function slugify(s) {
  return String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

/** ~530 files have no `title`. The filename is always there. */
/**
 * The pure normalisation kernel, exported for tests.
 *
 * Given raw file text and a path, produce the record the site consumes — or
 * `null` when the ONE REAL RULE applies (`publish: false`). Every other field
 * is derived, never required. `for_clients` is consumed and reduced to a
 * name-free boolean; the names do not survive this function.
 */
export function normalizeRecord(raw, filePath = "Untitled.md") {
  const { data, body } = parseFrontmatterLenient(raw, filePath);
  if (String(data.publish).toLowerCase() === "false") return null;

  const tags = Array.isArray(data.tags) ? data.tags.filter((t) => typeof t === "string") : [];
  const title = deriveTitle(data, filePath);
  const slug =
    typeof data.slug === "string" && data.slug.trim() ? slugify(data.slug) : slugify(title);

  return {
    title,
    slug,
    tags,
    body: body.trim(),
    url: usableUrl(data.url) || usableUrl(data.og_url) || "",
    ogImage: usableUrl(data.og_image) || "",
    description:
      (typeof data.og_description === "string" && data.og_description.trim()) ||
      (typeof data.description === "string" && data.description.trim()) ||
      "",
    fieldTested: Array.isArray(data.for_clients) && data.for_clients.filter(Boolean).length > 0,
  };
}

export function hasTitleField(data) {
  return [data.title, data.og_title, data.site_name, data.og_site_name].some(
    (c) => typeof c === "string" && c.trim() && c.trim() !== "[]"
  );
}

export function deriveTitle(data, file) {
  // Measured across 1764 files: title 1232, site_name 970, og_title 821,
  // og_site_name 92 — and some files carry none of them. Precedence chain,
  // applied in exactly one place, ending in a value that cannot be empty.
  const candidates = [data.title, data.og_title, data.site_name, data.og_site_name];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() && c.trim() !== "[]") return c.trim();
  }
  const fromFile = path.basename(file, ".md").replace(/[-_]+/g, " ").trim();
  return fromFile || "Untitled entry";
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Selection + emit                                                    */
/* ------------------------------------------------------------------ */

function read(file, srcRoot) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const { data, body } = parseFrontmatterLenient(raw, file);

  // House convention: MISSING `publish` means published. Only an explicit
  // `false` suppresses. Filtering on `=== true` would drop ~75% of the corpus.
  if (String(data.publish).toLowerCase() === "false") {
    anomaly("publish-false", relToCorpus(file), "`publish: false` — not rendered");
    return null;
  }

  const relFromRoot = path.relative(srcRoot, file);
  const section =
    path.dirname(relFromRoot) === "." ? null : path.dirname(relFromRoot).split(path.sep)[0];

  const tags = Array.isArray(data.tags) ? data.tags.filter((t) => typeof t === "string") : [];
  const title = deriveTitle(data, file);
  const slug = typeof data.slug === "string" && data.slug.trim() ? slugify(data.slug) : slugify(title);

  const rel = relToCorpus(file);
  if (!hasTitleField(data)) {
    anomaly("missing-title", rel, `no \`title\`, \`og_title\`, \`site_name\` or \`og_site_name\`; used "${title}"`);
  }
  if (!(typeof data.slug === "string" && data.slug.trim())) {
    anomaly("missing-slug", rel, `no \`slug\`; derived "${slug}"`);
  }
  if (data.og_image === undefined) {
    anomaly("missing-og-image", rel, "no `og_image`; used the house fallback card");
  } else if (!usableUrl(data.og_image)) {
    anomaly("unusable-og-image", rel,
      `\`og_image\` was ${JSON.stringify(data.og_image)}, which is not a URL; used the house fallback card`);
  }
  if (!usableUrl(data.url) && !usableUrl(data.og_url)) {
    anomaly("missing-url", rel, "no usable `url` or `og_url`");
  }
  if (!tags.length) anomaly("no-tags", rel, "no `tags`; appears on no tag page");

  const forClients = Array.isArray(data.for_clients) ? data.for_clients.filter(Boolean) : [];

  return {
    file,
    rel: relFromRoot,
    section,
    slug,
    title,
    tags,
    body: body.trim(),
    url: usableUrl(data.url) || usableUrl(data.og_url),
    ogImage: usableUrl(data.og_image),
    favicon: usableUrl(data.og_favicon),
    description:
      (typeof data.og_description === "string" && data.og_description.trim()) ||
      (typeof data.description === "string" && data.description.trim()) ||
      "",
    dateModified: typeof data.date_modified === "string" ? data.date_modified : null,
    dateCreated: typeof data.date_created === "string" ? data.date_created : null,
    // for_clients is consumed HERE and discarded. Only the count-free boolean
    // and the count itself survive; no client name ever reaches src/content.
    fieldTested: forClients.length > 0,
    _hadForClients: forClients.length,
    _score:
      (tags.length ? 2 : 0) +
      (usableUrl(data.url) ? 2 : 0) +
      (usableUrl(data.og_image) ? 2 : 0) +
      (data.title ? 1 : 0) +
      (data.og_description ? 2 : 0) +
      Math.min(3, Math.floor(body.trim().length / 1500)),
  };
}

function emit(rec, outDir, extra = {}) {
  const fm = {
    title: rec.title,
    slug: rec.slug,
    description: rec.description.slice(0, 400),
    url: rec.url || "",
    og_image: rec.ogImage || "",
    favicon: rec.favicon || "",
    section: rec.section || "",
    tags: rec.tags,
    field_tested: rec.fieldTested,
    date_modified: rec.dateModified || "",
    date_created: rec.dateCreated || "",
    ...extra,
  };
  const yaml = Object.entries(fm)
    .map(([k, v]) =>
      Array.isArray(v)
        ? v.length
          ? `${k}:\n${v.map((x) => `  - ${JSON.stringify(String(x))}`).join("\n")}`
          : `${k}: []`
        : `${k}: ${JSON.stringify(v)}`
    )
    .join("\n");
  fs.writeFileSync(path.join(outDir, `${rec.slug}.md`), `---\n${yaml}\n---\n\n${rec.body}\n`);
}

function ingest(srcRoot, outName, want, extraFn) {
  const outDir = path.join(OUT_ROOT, outName);
  fs.mkdirSync(outDir, { recursive: true });
  // Clear the markdown only — `config.ts` is source, not generated output.
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith(".md") && f !== "empty-tool-test.md") fs.rmSync(path.join(outDir, f));
  }

  const all = walk(srcRoot)
    .map((f) => read(f, srcRoot))
    .filter(Boolean)
    .filter((r) => r.slug && r.body.length > 200);

  // Spread the selection across sections so the sample is representative
  // rather than alphabetically clustered, then take the best-metadata files
  // from each. Deliberately keep a handful of degraded records (no og_image,
  // no title in source) so the fallbacks are exercised by the real build.
  const bySection = new Map();
  for (const r of all) {
    const k = r.section || "_root";
    if (!bySection.has(k)) bySection.set(k, []);
    bySection.get(k).push(r);
  }
  for (const list of bySection.values()) list.sort((a, b) => b._score - a._score);

  const picked = [];
  const seen = new Set();
  const sections = [...bySection.keys()];
  let round = 0;
  while (picked.length < want && round < 400) {
    let progressed = false;
    for (const s of sections) {
      const list = bySection.get(s);
      if (round >= list.length) continue;
      progressed = true;
      const r = list[round];
      if (seen.has(r.slug)) continue;
      seen.add(r.slug);
      picked.push(r);
      if (picked.length >= want) break;
    }
    if (!progressed) break;
    round++;
  }

  let noImage = 0,
    noUrl = 0,
    clientTouched = 0;
  for (const r of picked) {
    if (!r.ogImage) noImage++;
    if (!r.url) noUrl++;
    if (r._hadForClients) clientTouched++;
    emit(r, outDir, extraFn ? extraFn(r) : {});
  }

  console.log(
    `${outName}: ${picked.length} files from ${all.length} candidates ` +
      `(${noImage} without og_image, ${noUrl} without url, ` +
      `${clientTouched} had for_clients — stripped at the boundary)`
  );
  return picked;
}

if (process.argv[1] === import.meta.filename) {
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  let scanned = 0;
  scanned += walk(TOOLING_SRC).length;
  scanned += walk(VERTICAL_SRC).length;
  ingest(TOOLING_SRC, "tools", WANT_TOOLS);
  ingest(VERTICAL_SRC, "verticals", WANT_VERTICALS);
  writeAnomalyReport(
    path.resolve(import.meta.dirname, "..", "reports", "content-anomalies.md"),
    scanned
  );
}
