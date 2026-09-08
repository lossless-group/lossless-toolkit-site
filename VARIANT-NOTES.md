# Variant B — "islands where they earn it"

A spike, not a product. `pnpm install && pnpm build && pnpm test` is green;
`pnpm preview` serves 440 pages. Everything below is a position taken, not a
decision made.

**Hypothesis under test:** a catalogue of ~1,900 tools is a genuinely
interactive browsing problem, and reactive multi-facet filtering beats
page-per-tag navigation — *without* giving up the shareable, unfurlable URL that
is this site's actual distribution channel.

---

## What got built

| Route | Kind | Notes |
|---|---|---|
| `/` | static | Hero, stats, "best documented" grid, Explorer below the fold, category/vertical/tag indexes |
| `/tools/` | static shell + island | The full Explorer; filter state lives in the query string |
| `/tools/<slug>/` | static, 173 pages | Detail page: rendered body, TOC, related-by-tag-overlap, full share metadata, `SoftwareApplication` JSON-LD |
| `/tags/` | static | All 255 tags, bucketed by weight rather than listed flat |
| `/tags/<slug>/` | static, 255 pages | **A real page per tag** — own title, description, OG card, JSON-LD, sitemap entry |
| `/verticals/`, `/verticals/<slug>/` | static, 11 pages | The 26 vertical-toolkit files, grouped |
| `/api/tools.json` | static endpoint | The client projection, served once |
| `/llms.txt` | static endpoint | Curated markdown index for generative engines |
| `/reports/content-anomalies.md` | static endpoint | The build's own worklist (see below) |
| `/robots.txt`, `/sitemap-index.xml`, `/404` | static | AI crawlers opted in deliberately |

Content: 173 tooling files + 26 vertical-toolkit files, sampled round-robin
across every top-level directory and scored on metadata richness, with ~12%
deliberately metadata-poor entries retained so the fallback paths are exercised
rather than hypothetical. 24 of them carry `for_clients`.

---

## The islands, and why each earned its JS

Two. Everything else is static HTML and CSS.

### 1. `ToolExplorer.svelte` — `client:visible`

The claim, stated so it can be argued with: the catalogue is ~1,900 tools across
~600 tags. **Page-per-tag navigation can express exactly one facet at a time.**
"Agentic AI tools that are also open-source and self-hostable" is three
round-trips and a mental join. Multi-select answers it in one gesture.

The part that actually justifies the bundle is not the filtering — it is the
**live facet counts**. Every tag chip shows how many results it would leave
*given the current selection*, recomputed on every change. A facet reading `0`
is a dead end you can see before clicking it. There is no static rendering of
that; the counts are a function of the user's current state.

Also in this island because they share the same result set (a second island
would mean a second copy of the data): search-as-you-type across title,
summary, tags and domain; category and sort selects; and a **comparison tray**
holding up to four tools side by side. Comparison is the other thing a static
catalogue genuinely cannot do — the set being compared is chosen at runtime.

`client:visible` throughout: on `/` it sits below the fold and is not fetched
until it is nearly seen.

### 2. `ThemeToggle.svelte` — `client:idle`

~1 KB. Mode is a persisted three-way preference and there is no CSS-only way to
store one. It hydrates at idle, after everything that matters has painted.

**What it deliberately does not do is apply the mode.** That happens in a
12-line blocking inline script in `Base.astro`, because an island hydrates
*after* first paint and would flash the wrong theme on every navigation. This is
the clearest case in the codebase of a plain script beating an island, and it is
the same judgement that kept everything else static.

### What was considered and left static

Tag chips, breadcrumbs, related tools, the vertical grids, the TOC, the tag
index buckets — all computed at build. None of them change in response to
anything the user does, so none of them are islands.

---

## Filter state and URLs — the most interesting problem here

A view assembled purely in the client has no address. It cannot be texted,
cannot unfurl, and cannot be indexed. Since texting one precise link to one
executive is the *primary* distribution channel, an island that swallows the URL
would break the product while improving the browsing.

Two-level answer:

**1. Single-tag views are real routes.** All 255 tags are prerendered at
`/tags/<slug>/` with their own `<title>`, description, OG card, JSON-LD, and
sitemap entry. When the Explorer's filter collapses to exactly one tag and
nothing else, it rewrites the URL to that canonical route via
`history.replaceState`. So the link a user copies is the server-rendered one,
and it unfurls with a page-specific card.

**2. Richer states become `/tools/?q=&tags=a,b&cat=&sort=`.** `/tools/` is
itself prerendered, so the link still returns real HTML and still unfurls — with
the index card rather than a bespoke one — and on arrival the island reads the
query string and restores exactly the state that was shared. Honest tradeoff:
the *page* is precise, the *card* is generic.

There is a **Copy shareable link** button in the status bar because the URL bar
is not where people look, and the house `ShareToolkitLink.svelte` prior art had
already established that affordance as the right one.

What this does not solve: a multi-tag view still unfurls generically. The fix is
an OG endpoint that renders a card from the query string, which needs SSR or a
generated card per materialized combination. Noted, not built.

---

## `for_clients` — three layers, and a test on the bytes

221 tooling files name client organizations. The array is a valid **input** and
must never be an **output**. Client-side filtering makes this sharper, because
whatever hydrates an island is one view-source away from public.

1. **Dropped at parse.** `src/lib/frontmatter.ts` has a `DENY` set. The field
   never enters the data model, so nothing downstream can leak it even by
   accident.
2. **Allowlisted at the client boundary.** `projectForClient()` builds an
   explicit narrow shape (`{s,t,d,g,c,i,h,k}`). A field added to `Tool` later
   cannot silently reach the browser.
3. **Asserted on the artifact.** A test walks every `.html/.json/.txt/.md/.js/.xml`
   file in `dist/` and fails if the string `for_client` appears anywhere. It
   currently finds zero across 440 pages, `/api/tools.json`, and `/llms.txt`.

Layer 3 is the one that matters — the other two are claims, that one is evidence.

---

## Content access: one module, one projection

`src/lib/content-api.ts` is the **only** module that touches content. Nothing
else globs, reads the filesystem, or parses frontmatter.

```
listTools({ tag?, tagSlug?, category?, vertical?, query?, limit? }) -> Tool[]
getTool(slug)            -> Tool | undefined
listTags(minCount?)      -> TagFacet[]
listCategories()         -> TagFacet[]
listVerticals()          -> Vertical[]
getVertical(slug)        -> Vertical | undefined
stats()                  -> { tools, tags, categories, verticals, ... }
projectForClient(tools?) -> ClientTool[]
listAnomalies()          -> Anomaly[]
```

Today the "endpoints" resolve to local paths via `import.meta.glob`. Every
return shape is plain, serializable data that would survive a trip over the
wire, so swapping the implementation for `await fetch(...)` changes this file
and nothing else. That is the whole point — Q5 (is content a toolkit concern or
family infrastructure?) stays cheap to answer later.

**The client projection** is a deliberately lossy shape, single-letter keys
because it is a wire format, not source:

```ts
{ s: slug, t: title, d: summary(≤180), g: tags[], c: category, i: image, h: host,
  k: prebuilt lowercase search haystack }
```

Markdown bodies are excluded — 173 full bodies would be multiple megabytes for
an index that only ever matches title, summary, tags, and domain.

**It is served as one static file at `/api/tools.json`, not inlined.** It began
inlined into every page mounting the Explorer, which produced a **59 MB
`dist/`** — 255 tag pages each carrying a full copy of the catalogue. Hoisting
it to a URL took `dist/` to 13 MB and the browser fetches it once, cached across
every page. It is also the honest shape of the boundary: this is exactly the
response a shared content service would return.

---

## Frontmatter: lenient by design, with a receipt

**There is exactly one real rule: `publish: false` → the page does not render.**
Everything else is an optional enhancement layered on a baseline the filename
always provides.

No strict YAML parser runs over content. `src/lib/frontmatter.ts` is hand-rolled
and handles what this corpus actually contains: **both tag syntaxes** (inline
`[A, B]` and block list), stacked double frontmatter blocks (routine in
`vertical-toolkits/`), unquoted colons, smart quotes, `...` terminators, and
`og_image: "[]"`. A line it cannot parse drops that line and keeps the document.

Precedence chains, applied in exactly one place:

- **Title:** `title` → `og_title` → `site_name` → `og_site_name` → **filename**.
  The chain ends somewhere that always exists, so an empty heading cannot render.
- **Slug:** `slug` → slugified filename. Collisions are resolved deterministically
  (richer entry keeps the slug, the other gets `-2`).
- **Summary:** `zinger` → `og_description` → `description_site_cp` →
  `description` → first paragraph of the body → `''`.
- **Image:** `og_image` → `image` → `og_screenshot_url` → `banner_image` →
  house fallback card. A value must be `http(s)` and must not contain `[]`.
- **Publish:** `publish !== false`. Filtering on `=== true` would have dropped
  ~75% of the upstream corpus.

**Untagged entries** (12 in the sample, 61 upstream) are a deliberate case, not
an accident: they ship to the client with `g: []`, remain fully reachable by
search and by category, and are excluded from tag-filtered views because they
genuinely do not carry the tag. They never throw.

**Verification, not assertion.** The hand-rolled parser was run against the
**full 1,764-file upstream corpus** (`CORPUS=… pnpm test`), not just the copied
subset: no file throws, both tag syntaxes parse, every document resolves a
non-empty title, no `"[]"` survives as an image, and `for_clients` never
survives the parse.

**The empty-file acceptance test passes and is kept as a fixture.**
`src/content/tooling/Empty Tool Test.md` is zero bytes and renders at
`/tools/empty-tool-test/` with `<h1>Empty Tool Test</h1>`, a working URL, and
the fallback share card. Two more fixtures are kept: `Publish False Test.md`
(the one real rule) and `Precedence Test.md` (title precedence + block-list tags
+ the `"[]"` image trap in one file).

### The anomaly report

Leniency without a record is rot. `content-api.ts` accumulates every point where
normalization had to *assume* something, and flushes to
`/reports/content-anomalies.md` — markdown, because these files get fixed in
Obsidian, grouped by anomaly type because the workflow is "fix all the missing
titles", with counts at the top.

Current sample: **147 findings across 172 tools** — 110 derived slugs, 12
untagged, 11 unusable `og_image`, 5 missing titles, 5 with no vendor URL, 4 with
no description of any kind. The generated file is gitignored; a sample is
committed at `reports/content-anomalies.sample.md`.

---

## Share metadata

Every page carries the full sextet (`og:image`, `:secure_url`, `:type`,
`:width`, `:height`, `:alt`) plus `twitter:card=summary_large_image` and the
Twitter image pair, all absolute, with a stable canonical.

**The deliberate call: `og:image` is always a Lossless-owned asset, never the
vendor's `og_image`.** Vendor images render on-page; they never unfurl. Two
reasons, both from the house skill:

1. `og:image:type` must match the bytes actually served. Vendor URLs in this
   corpus include `.avif`, content-negotiating CDNs, and one stringified empty
   array — we cannot truthfully assert a type for them.
2. The sextet requires width and height, and an unfurler lied to about
   dimensions renders a broken card. We do not know the vendor's dimensions.

So 13 cards were generated with ImageMagick at 1200×630 JPEG in the house
palette — one generic plus one per category — and **committed** to `public/og/`,
so `pnpm build` needs no image toolchain. The gap: every tool in a category
unfurls with the same card. Per-slug generation is the obvious next step and the
seam is already there (`cardFor()` in `src/lib/seo.ts`).

---

## Theme modes — the bonus, attempted

Three modes, per the exploration's note that no Lossless site has ever shipped
any: **light, dark (default), vibrant (dark-based)**, on `data-mode`, persisted
to `localStorage`, applied before first paint, defaulting to
`prefers-color-scheme` on first visit.

Two-tier tokens per the house convention: Tier 1 `--color__*` carries every raw
value; Tier 2 `--clr-*` references Tier 1 exclusively through `var()`. No hex
appears in a semantic token.

The catalogued palette is a *dark* palette, so light and vibrant grounds had to
be designed. Those Tier 1 additions are marked inline as invented rather than
catalogued, so the boundary between "the house palette" and "what this spike
guessed" stays visible. One judgement worth flagging: **in light mode the accent
role moves from the house cyan to the violet**, because `#04e5e5` fails contrast
as text on paper. Cyan is demoted to a fill-only role there. Vibrant is
dark-based, never light-based, per the recorded common error.

---

## Conventions followed, and where this diverges

**Followed:** `src/` split into `components`, `layouts`, `pages`, `styles`,
`lib`, `content`. PascalCase `.astro` components at the top of
`src/components/`. `MetaTags.astro` as the canonical meta component. Astro +
Svelte only, zero React/JSX. Two dependencies beyond Astro itself
(`@astrojs/svelte`, `@astrojs/sitemap`) — no markdown parser, no search library,
no CSS framework. Modern CSS throughout: grid, container queries, `:has()`,
nesting, `color-mix()`, logical properties.

**Diverged, deliberately:**

- **Content collections are not used for reading.** `content-api.ts` reads raw
  markdown via `import.meta.glob` and parses leniently, because a strict schema
  is exactly the trap the leniency rule warns about. The per-collection configs
  exist and are composed by a thin `src/content.config.ts`, with every field
  `.optional().catch()` and `.passthrough()` — but their job is documentation
  and typing, and nothing consumes them at runtime. They also silence Astro's
  auto-collection deprecation warning.
- **`node:test` rather than Vitest.** Node 24 strips TypeScript natively, so the
  suite runs with zero additional toolchain. Vitest is the house choice and
  `getViteConfig` would be the right move the moment a test needs to import a
  module that uses `import.meta.glob`. Noted as a real divergence.
- **Tests assert on `dist/`, not on the module.** `content-api.ts` cannot be
  imported outside Vite. Testing the artifact is also the stronger claim for the
  `for_clients` rule — it verifies the bytes that ship.
- **A hand-rolled ~90-line markdown renderer** instead of a parser dependency,
  per "web standards before libraries". This is the seam LFM replaces.
- **`lossless-site` was not used as a structural reference.** Its
  `ShareToolkitLink.svelte` was read as prior art for the tag-set-to-URL idea and
  nothing was ported.

---

## Test rungs managed

| Rung | Status |
|---|---|
| Unit / content-shaped | **18 tests, all passing.** 6 run against the full 1,764-file upstream corpus |
| Route / integration | Partial — asserted against built HTML rather than a request cycle |
| Browser drive | **Skipped.** Click-path named below so it is codified rather than improvised |
| Unfurl rendering | Not possible locally — unfurlers cannot reach `localhost` |

The Playwright click-path, named in advance per the house convention: build →
serve → `/` returns 200 with a non-empty `h1` and an `og:image` → click a tag
chip → assert `/tags/<slug>/` returns 200 with a tag-specific `<title>` → type
in the search box → assert the URL gains `?q=` → select a second tag → assert
the URL becomes `/tools/?q=…&tags=a,b` → reload → assert the filter state
survived.

---

## What I would do next

1. **Per-slug OG cards.** The single biggest share-quality win. `cardFor()` is
   already the only place that decides, so it is a contained change.
2. **The Playwright drive above**, then Checkly for the same specs as monitors.
3. **A card from query-string state**, so multi-tag views unfurl specifically —
   the one part of the URL story still unresolved.
4. **Pagefind** for full-text over bodies. The island searches metadata only,
   which is right for filtering and wrong for "which tool mentioned SOC 2".
5. **Fold the anomaly report back into the vault** as a dated markdown file with
   wikilinks, so it is actionable in Obsidian rather than only in `dist/`.
6. **Scale to the full 1,900.** The parser is already verified against all of
   them; what is unproven is whether a ~1 MB `tools.json` still feels instant.
   If not, the answer is a prebuilt inverted index, not less interactivity.

## Deliberately skipped

Analytics (`Analytics.astro` / OpenPanel — the component exists to copy, it just
adds nothing to a spike), auth and the gating seam, client pages and codenames,
timeline views, the GitHub repos surface, `/llms-full.txt`, LFM integration,
`DESIGN.md`, `astro check` in CI, and the OG image health checker (explicitly
v2).
