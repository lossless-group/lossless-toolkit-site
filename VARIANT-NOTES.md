# Variant A — "materialize everything, zero JS"

One of three parallel spikes at the Lossless Toolkit rebuild, each pushing a different
hypothesis to its limit. This one takes the static-first position as far as it goes and
reports honestly on where it breaks.

**Green bar:** `pnpm install && pnpm build` succeeds — 531 pages in ~2s. `pnpm preview`
serves it. `pnpm test` runs 23 assertions over the normalisation kernel, all passing.

---

## The thesis, stated so it can be argued with

A tag is a query. A vertical is a query. "Tools like this one" is a query. The default
industry move is to run those queries in the reader's browser: ship the index, ship a
filter component, let the client compute. It is fast to build, and it produces a site
where **nothing you are looking at has an address**.

The house vocabulary already names the alternative — *content materialization* — and
already names the anti-pattern: *"a frontmatter property that has no rendered surface is
a query whose result was never materialized."* So every tag here is a page. Every
vertical is a page. Every tool is a page. Adjacency is computed once, at build time, and
written into the HTML.

This matters more than usual for this particular site because
`Surface-Inventory-and-Open-Product-Questions.md` says the primary distribution channel
is **a text message**: one link, one recipient, chosen deliberately. A link is only worth
sending if the thing it points at exists, has a title, and unfurls. **Client-side state
cannot be texted.** That single observation is most of the case for this axis.

The same document also warns against *over*-materialization. The line this variant draws:
materialize anything with a stable URL or a durable consumer; leave ephemeral narrowing to
CSS. Concretely — `/tags/agentic-ai/` is a file, because you might send it to someone.
"Agentic-AI **and** Open-Source, unchecked in a second" is CSS, because nobody links to it.

---

## What was built

| Surface | Route | Notes |
|---|---|---|
| Landing | `/` | Stats, tag entry points, featured entries, verticals ledger |
| Tool index | `/tools/` | All 181 entries + CSS-only faceted filter over 32 tags |
| Tool detail | `/tools/<slug>/` | Full body, share card, capabilities, build-time "adjacent in the kit" |
| Tag directory | `/tags/` | All tags, bucketed by depth |
| Tag landing | `/tags/<tag>/` | Own title, description, share card + co-occurrence facets |
| Vertical index | `/verticals/` | Grouped by section |
| Vertical detail | `/verticals/<slug>/` | Body + tools matched on shared tags |
| About | `/about/` | The variant's own argument, on the site |
| 404 | `/404/` | Falls back to tag entry points |
| GEO | `/llms.txt`, `/llms-full.txt` | Curated index + concatenated corpus |
| SEO | `/sitemap-index.xml`, `/robots.txt` | House filter; AI crawlers opted in deliberately |

**531 pages. 0 bytes of JavaScript shipped. 0 runtime dependencies. 2 build dependencies**
(`astro`, `@astrojs/sitemap`) plus two dev-only ones (`yaml`, `vitest`).

### What replaced the JavaScript

- **Tag filtering** — multi-select facets on `/tools/` built from `:has()` over checkbox
  state. Each facet contributes exactly one CSS rule
  (`.facets:has(#f-x:checked) ~ .grid > .card:not([data-tags~="x"]){display:none}`), so the
  rule count is linear, not combinatorial. Checking several intersects them (AND). Works
  with JavaScript disabled.
- **Shareable filtering** — the CSS filter cannot be linked to, so every tag *also* gets a
  real route with its own metadata. Ephemeral narrowing is CSS; linkable narrowing is a URL.
- **Theme modes** — light, dark and vibrant, switched by radio inputs the root element reads
  with `:has()`. See below; this is genuinely new ground.
- **Disclosure** — `<details>`, a native element for a decade.
- **Whole-card click targets** — a stretched `::after` on the title link, not a handler.
- **Related tools** — weighted shared-tag overlap, computed at build, baked into the HTML.

### Theme modes — the first three-mode implementation in the family

The exploration doc is blunt that **no Lossless site has ever shipped a mode**, that the
`theme-system` skill's three-mode contract has zero realized implementations, and that the
catalogued house palette *is a dark palette* — so light and vibrant are design work, not
refactoring. This variant attempts all three, zero-JS:

- **Tier 1** — the nine catalogued house colours, promoted verbatim under the
  `--color__<name>` convention, **plus seven newly designed values**: light grounds
  (`--color__porcelain`, `--color__catskill-mist`), light-mode ink (`--color__slate-ink`),
  accessible-on-light accents (`--color__teal-deep`, `--color__purple-deep` — `#04e5e5` on
  white is unreadable), and a vibrant chord (`--color__void`, `--color__magenta-flare`,
  `--color__cyan-flare`, `--color__violet-flare`).
- **Tier 2** — a fixed semantic vocabulary (`--surface-page`, `--text-primary`, `--accent`,
  `--border-strong`, `--glow`, …), defined **exclusively** through `var()` onto Tier 1. No
  raw value appears in a Tier 2 declaration anywhere. A palette change is a re-point.
- **Vibrant is dark-based**, per the recorded common error — it does not inherit light's
  ground, and it introduces magenta so it reads as a *different chord* rather than dark with
  the saturation turned up.
- **Selection** — `prefers-color-scheme` by default; explicit choice overrides it via
  `:root:has(#mode-light:checked)`. The "Auto" radio deliberately carries a different class
  so it does not suppress the media query.

**The honest cost:** the choice does not survive a navigation. There is nowhere to persist
it without script. This is the single sharpest edge of the axis and it is stated on the
site itself, not buried here.

---

## Handling the inconsistent frontmatter

### The architecture: a sanitizing boundary

`scripts/ingest-content.mjs` is the only thing that ever touches the raw corpus. It reads
`/home/mps/code/lossless-monorepo/content/{tooling,vertical-toolkits}` **read-only**,
normalises, and writes clean markdown into `src/content/`. Two consequences:

1. **Leniency happens once**, at ingest, where it belongs — not in every template.
2. **`for_clients` never crosses the boundary.** The array is consumed and reduced to a
   name-free `field_tested: true`. There is no field for it in the schema and no way to add
   one. **The site cannot leak what it never receives.** Verified: `grep -ril for_clients
   dist/` returns nothing, and a test asserts on `JSON.stringify()` output, not just types.

### Parsing — property-level recovery, per the house reminder

`YAML-Frontmatter-Parsing-Must-Be-Lenient.md` is explicit that file-level skipping is *also*
the wrong shape. So:

- **Layer 1** — a real YAML parser via `YAML.parseDocument()`, because the corpus genuinely
  mixes flow (`tags: [A, B]`, 895 files) and block (`tags:\n  - A`, 810 files) style and a
  hand-rolled regex silently mangles one of them. Each top-level key is materialised
  **individually** inside a try/catch. A key that throws is dropped with a warning; every
  other key survives, and the document survives.
- **Layer 2** — if the frontmatter is broken badly enough that no mapping comes back at all,
  a line-based recovery pass reads the shapes the corpus actually uses. Still never fatal.

### The one real rule, and the schema that enforces nothing

`publish: false` → the page does not render. **That is the entire rule.** Missing `publish`
means published (1321 of 1764 files have no `publish` line; filtering on `=== true` would
have dropped ~75% of the corpus).

The Zod schemas in `src/content/tools/config.ts` are **documentation and typing, not
enforcement**: every field is `.optional().catch(…).default(…)`, and the object is
`.passthrough()` so an unanticipated key costs nothing.

### The filename is the baseline, not a fallback

Reframed exactly as instructed: Astro's entry `id` always exists, so a title, a slug and a
URL always exist. Frontmatter is an enhancement layered on top.

**Precedence chain, applied in one place:** `title` → `og_title` → `site_name` →
`og_site_name` → filename → `"Untitled entry"`.

**Acceptance test run and passing:** `src/content/tools/empty-tool-test.md` is a genuinely
zero-byte file, **kept as a committed fixture** so every build exercises the guarantee. It
builds to `/tools/empty-tool-test/` with `<h1>Empty Tool Test</h1>` and a working fallback
share card. A `grep` for empty `<h1>` across `dist/` returns nothing.

### The anomaly report

Leniency without a record makes content problems invisible. `pnpm ingest` writes
`reports/content-anomalies.md` — markdown, because these files are edited in Obsidian and
because an agent asked to batch-fix one category needs a readable worklist. Grouped by
anomaly **type** (the workflow is "fix all the missing titles"), with counts at the top.
Paths are relative to the `content` repo root so they resolve in the vault.

Current run: **1912 source files scanned, 2186 anomalies recorded, build green.**

| Anomaly | Count |
| --- | ---: |
| Missing slug (derived from title) | 1339 |
| No og_image at all (house fallback used) | 518 |
| Missing title (fell back to filename) | 129 |
| No url — the entry links nowhere | 108 |
| No tags — appears on no tag page | 78 |
| Unusable og_image (e.g. the literal `"[]"`) | 13 |
| Explicitly unpublished (respected) | 1 |

One sample is **committed** for illustration; the rest of `reports/` is gitignored.

---

## Share metadata

`src/components/MetaTags.astro` is the single emission point. Every route — including tag
and vertical landings — gets its own title, description and image rather than inheriting a
site default.

- Absolute URLs only, via `abs()`; asserted in tests.
- Full sextet: `og:image`, `og:image:secure_url`, `og:image:type`, `og:image:width`,
  `og:image:height`, `og:image:alt`. Plus `twitter:card=summary_large_image` and the twitter
  image pair.
- **JPEG, 1200×630**, because iMessage and WhatsApp have both shipped versions that silently
  ignore WebP — and `og:image:type` therefore matches the bytes actually served.
- **Fallback family**: six house cards in `public/og/`, generated by
  `scripts/make-og-fallbacks.mjs` (ImageMagick, at authoring time, **committed** — not a
  build step) and assigned by a stable FNV hash of the slug. Six rather than one so a wall of
  fallbacks does not read as identical grey rectangles; deterministic so a given tool always
  unfurls with the same card and the unfurler's per-URL cache stays coherent.
- JSON-LD on every page (`CollectionPage`, `ItemList`, `Article`) — the house skill notes
  generative engines treat it as ground truth more than OG tags.

---

## The content-api boundary

**`src/lib/content-api.ts` is the only module in the site that reads content.** No page,
layout or component performs an `fs` read, a glob, or an `import.meta.glob`.

```
listTools({ tag?, vertical?, section?, fieldTested?, limit?, offset?, not? })
getTool(slug)
listTags()  ·  listCoTags(tag)  ·  listSections()  ·  listRelatedTools(slug)
listVerticals()  ·  getVertical(slug)
```

Return shapes are plain and JSON-serializable — `ToolDTO`, `TagDTO`, `VerticalDTO` — so the
local-path implementation and a future HTTP one are genuinely interchangeable. Whether
toolkit content should eventually be served by a shared service (Q5 in the strategy doc) is
deliberately deferred; coding against this interface keeps the decision cheap.

**One documented exception, named rather than hidden:** `getToolSource()` returns the Astro
collection entry so detail pages can call `render()`, because Astro compiles markdown to a
component at build time and a component is not a wire shape. An HTTP implementation would
return `{ html }` instead, and the two detail templates are the only files that would change.

---

## Conventions followed / diverged

**Followed:**
- `src/` layout: `components/`, `layouts/`, `pages/`, `styles/`, `lib/`, `content/`.
- PascalCase `.astro` components at the top of `src/components/`.
- `MetaTags.astro` as the canonical name for the OpenGraph component (renamed mid-build from
  `Head.astro` after the convention note).
- Two-tier `--color__*` / `--color-*` token system, per `theme-system`.
- Astro-only. **No React, no JSX, no Angular. No Svelte either** — the axis rules it out.
- `lossless-site` used strictly as a source of *content shape*, never as a structure or
  style reference.

**Diverged, deliberately:**
- **Per-collection content config.** `src/content.config.ts` is three lines; the schemas live
  in `src/content/tools/config.ts` and `src/content/verticals/config.ts`. Per instruction,
  against what the siblings do.
- **No `Analytics.astro`.** OpenPanel is a script tag, and the axis is zero JS. This is a
  real cost, not an oversight — see below.
- **`pnpm-workspace.yaml` exists** in a non-workspace site purely because pnpm 11 moved the
  build-script allowlist there from `package.json`.

---

## Where I reached for JavaScript

**Nowhere in the shipped output.** `dist/` contains no `<script>` tag of any kind, inline or
external. The only JavaScript in the repository runs at build time (`astro`, the ingest
script) or in tests.

The two places I *would* reach for it, if the axis were relaxed by exactly one inch:

1. **~10 lines to persist the theme choice** into `localStorage` and re-apply it on load.
   This is the highest value-per-byte JavaScript in the entire project and the axis
   currently forbids it. If Variant A is chosen, this is the first thing I would concede.
2. **Pagefind**, for real search. Tag filtering is not search, and the exploration doc
   already settles on Pagefind — which ships a WASM index. There is no zero-JS answer to
   free-text search over 1,900 documents; the honest static answer is "more materialized
   surfaces", which does not actually substitute.

---

## Verification rungs

| Rung | Status |
|---|---|
| `pnpm build` green | ✅ 531 pages, ~2s |
| `pnpm preview` serves | ✅ verified against the built output |
| Unit tests over the normalisation kernel | ✅ **23 assertions, all passing** (`pnpm test`) |
| `for_clients` leak scan over `dist/` | ✅ zero hits |
| Empty-file acceptance test | ✅ renders with a derived title |
| Empty-`<h1>` scan over `dist/` | ✅ zero hits |
| Playwright smoke drive | ❌ **skipped** — out of time |

The seven rules asked for are all covered by `tests/normalization.test.ts`, plus extras:
`publish: false` excluded · missing `publish` **included** · empty file yields a non-empty
derived title · title precedence resolves in documented order · `for_clients` absent from
`JSON.stringify()` output · `og_image: "[]"` falls back · both tag syntaxes produce the same
array · malformed keys drop without losing the document · absolute-URL and tag-slug
invariants.

**The named-in-advance Playwright click-path**, for whoever picks this up: build → serve →
`/` → assert 200, non-empty `h1`, `og:image` present → click through to one `/tools/<slug>/`
→ same three assertions → click a tag chip to `/tags/<tag>/` → same three assertions →
toggle the vibrant radio and assert the computed `--surface-page` changes.

---

## What I would do next, in order

1. **Concede the 10 lines of theme-persistence JS.** Everything else on this axis holds; this
   one does not, and pretending otherwise is dishonest.
2. **Playwright smoke drive**, per the click-path above.
3. **Scale to the full 1,764 files** and measure. Extrapolating linearly from 531 pages in
   2s, ~5,000 pages lands around 20s — fine. The thing to actually watch is `/llms-full.txt`,
   which grows to tens of MB and probably wants a size cap or a per-section split.
4. **Real OG images per tool**, rendered at authoring time from the tool's own card, rather
   than six shared fallbacks. `lossless-site` already proves per-slug generation works.
5. **Pagefind**, accepting the JS. Frame it as *the* deliberate exception with a measured
   budget, so it stays one exception rather than the first of many.
6. **Section-level routes** for the deep-linking problem the exploration doc raises: a URL
   fragment never reaches the server, so `/tool/foo#pricing` and `/tool/foo` unfurl
   identically. A small, deliberate set of `/tools/foo/pricing/` routes would fix it, and
   fits this axis perfectly.
7. **Serve the token layer** from the Cloudflare URL Q3 settles on, so the three modes
   designed here propagate to the family instead of being re-invented per site.

## What I deliberately skipped

- **Svelte.** Permitted by the house rules; ruled out by the axis.
- **Search.** See above.
- **Analytics.** See above.
- **Client pages, auth, the codename/identity split.** The exploration doc defers all of it
  to a later phase with a private content source; there is nothing to gate yet.
- **LFM rendering.** Bodies render through Astro's default markdown, so the corpus's
  hex-code citations show as plain footnote markers and callouts render as blockquotes.
  Wiring `@lossless-group/lfm` is the correct fix and is a known, bounded piece of work — it
  was not worth risking the green bar for.
- **`/brand-kit` and `/design-system` pages.** Required per site by the astro-knots
  conventions; `/about/` carries a partial argument for the token work in the meantime.
- **A `DESIGN.md`.** The three-mode token set designed here is exactly the thing that should
  be written down as a contract, and it currently only exists as CSS.
