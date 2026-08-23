---
title: "Surface Inventory and Open Product Questions"
lede: "What the rebuilt Lossless Toolkit needs to do for readers, for clients, and for the person publishing it — captured before any of it is designed, including the manual publish ritual we intend to delete."
date_created: 2026-08-23
date_modified: 2026-08-23
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5 (1M context)
semantic_version: 0.0.0.9
tags:
  - Exploration
  - Product-Scope
  - Toolkit
  - Client-Pages
  - Search
  - Access-Control
status: Open
---

# Surface Inventory and Open Product Questions

The current toolkit is browsable by tag and not much else. The rebuild is a chance to decide what
the surface should actually be — for a reader looking for a tool, for a client reading something
written for them, and for the person publishing, who today runs a six-step ritual to get a typo
onto the web.

This document inventories the surfaces we know we want and the product questions each one opens.
It is the product-side companion to
[[Opening-Strategy-Questions-for-Architecture-and-Stack]], which holds the architectural questions.

## The publish ritual we intend to delete

Today, getting a content change live requires:

1. Commit and push `content`
2. Go into `site`, `git pull` into `src/generated-content`
3. Commit `site` as `update(content)` with a single-line message
4. Wait for Vercel to build
5. Click through to promote to production

**The goal is to push content and have everything else cascade from it.** Every architectural
option below should be judged partly on how completely it deletes steps 2 through 5. This is not a
convenience concern — a five-step ritual is a tax on publishing, and taxed publishing means less
publishing.

## The primary distribution channel is a text message

**This reorders everything.** The main way this site gets used is the author sending a client
executive *exactly* the link relevant to them, over SMS or WhatsApp. Not search, not browsing, not a
newsletter. One person, one link, one recipient who was chosen deliberately.

Consequences, stated plainly because they invert the usual priorities:

- **The unfurl is the product surface.** For a link pasted into WhatsApp, the preview card *is* the
  page until someone taps it. A perfect page with a broken unfurl is a broken product.
- **SEO and GEO/AEO are *not* secondary — all three get overdone.** Share is the primary channel, but
  search and answer engines are being maximized alongside it, not traded away. See the section below.
- **Deep linking has to be excellent** — down to individual headings within a document, so the link
  lands on the exact paragraph that matters to that executive.

The house `open-graph-share-seo-geo` skill is already written for this exact case: *"Optimized for
iMessage and WhatsApp first (the channels we share through most)."* Its rules stop being polish and
become core requirements.

### The fragment problem — anchor links cannot have their own preview

LFM `0.5.1` ships `remark-lfm-heading-ids`, so heading anchors are available. But there is a protocol
constraint underneath that no amount of markdown tooling changes:

**URL fragments are never sent to the server.** When a recipient's WhatsApp client fetches
`/tool/foo#pricing` to build a preview, the server sees `/tool/foo` — the `#pricing` part never
leaves the client. The unfurler therefore receives page-level metadata and renders a page-level card.

So an anchor link gives you the right **landing position** and a generic **preview**. Every anchor
into the same document produces an identical card. For "exactly the link that is relevant to them,"
the landing is solved and the preview is not.

If a section's preview needs to be specific to that section, it needs a **real path**
(`/tool/foo/pricing`), not a fragment — a genuine route with its own title, description, and image.
That is more routes, but the house materialization rule already favours giving durable, linkable
views real URLs, so the two arguments point the same way.

**Open:** which sections deserve real routes? Plausibly a small, deliberate set — the ones actually
worth texting — rather than every `h2` in the corpus.

### SEO, GEO/AEO and Share are all maximized — with one carve-out

**Stated 2026-08-23: overdo all three.** Share is the primary channel by usage, but that does not
demote search. The only thing being suppressed is narrow and specific:

> **Rank for the tools, the concepts, and the vocabulary. Do not rank for client names.**

That is a carve-out, not a de-prioritization. Everything except client-name association gets the full
treatment. The `for_clients` no-emit rule from the mechanism section above is precisely how the
carve-out is enforced — it is one rule, not a general retreat from search.

**GEO / AEO scope.** The house skill treats generative-engine visibility as a concentric ring around
the OG work, and most of it is already implied:

- **`/llms.txt` and `/llms-full.txt`.** A curated markdown index plus the concatenated raw bodies.
  This corpus is exactly the shape that benefits — ~1,900 tool, concept, and vocabulary entries are
  far more useful to a model as one fetch than as 1,900 HTML pages. Reference implementation:
  `ai-labs/context-vigilance-kit/splash` (460 entries, 132 KB index, 5.7 MB companion, ~30ms build).
- **JSON-LD `Article` schema** on content pages — the skill notes generative engines treat it as
  ground truth more than OG tags.
- **Factual first paragraph.** The first ~200 characters are what gets quoted, so lead with the
  claim rather than a hook. That is a content-authoring convention, not a code change.
- **`<h1>` semantically matching `<title>`**, and stable canonicals throughout.
- **`robots.txt` explicitly allowing the AI crawlers** we want citations from — `GPTBot`,
  `ClaudeBot`, `PerplexityBot`, `Google-Extended`. The default posture is conservative; being cited
  requires opting in deliberately.
- **`@astrojs/sitemap`** with the house filter excluding `/llms.txt`, `/llms-full.txt`, and `/404`,
  plus `public/robots.txt` carrying an absolute `Sitemap:` line.

**The carve-out has to reach llms.txt too.** The house rule for these files is that they apply the
*same* publish/private predicate as the rendered HTML. Since client-curated content is public, it
will be included — so the `for_clients` array must be stripped from `/llms-full.txt` output exactly
as it is from HTML. Otherwise the client-name association we are suppressing in search gets fed
directly to the models instead. Same rule, one more output surface to enforce it on.

### Rules that become load-bearing

From the house skill, these stop being nice-to-have:

- **OG images on a CDN, not `/public`** — local assets unfurl intermittently in iMessage, WhatsApp,
  and Slack. Interacts with the Q3 hosting decision; ImageKit is the named house default.
- **JPEG, not WebP.** iMessage and WhatsApp have both shipped versions that silently ignore WebP.
- **`og:image:type` must match the bytes actually served**, verified by `curl -sI`, not the file
  extension — content-negotiating CDNs make these diverge.
- **Absolute URLs everywhere**, and the **full six-property image sextet** plus the Twitter pair.
- **1200 × 630.**
- **Cache-bust with `?v=N` to force a re-unfurl** — unfurlers cache per exact URL for days and honour
  no origin header. This one is unusually useful here: when sharing manually, appending `?v=2` is a
  one-second fix the author can apply in the moment.

### A real limitation for the test strategy

**Unfurlers cannot reach `localhost`.** Preview rendering can only be verified against a publicly
reachable URL, which means it **cannot be tested in CI against a local build**, and an agent driving
a local browser cannot verify it either. The house skill is blunt that the manual send-to-yourself
test in iMessage and WhatsApp is the only ground truth.

What *can* be automated is everything upstream of the unfurler: that the tags render, that the URLs
are absolute, that the declared type matches the served bytes, that width and height match the real
file. That is a good Vitest target. The final rendering is a human check against a deployed preview —
which is another argument for shipping to `lossless-toolkit.vercel.app` early.

This also raises the priority of the v2 OpenGraph health checker: if unfurls are the product, a dead
vendor image is not a cosmetic bug.

### Prior art to reuse

`lossless-site` already has `src/components/toolkit/ShareToolkitLink.svelte` (builds a share URL from
the selected tag set, with human-readable labelling like *"Design and 3 more"*) and
`TagShareHeader.astro`. Worth reading before rebuilding — the tag-set-to-shareable-URL idea is
exactly right for this use case.

## Decided

**Search is Pagefind.** Tag filtering alone is not search. Pagefind handles the current corpus
(~1,900 files) and considerably more without trouble. Treated as settled; the open questions below
are about how it interacts with freshness and gating, not whether to use it.

**Timeline stays.** The timeline views are wanted in the rebuild.

**Analytics is OpenPanel.** The house basic-analytics choice, carried into this site.

There is a working component to copy rather than reinvent —
`astro-knots/sites/mpstaton-site/src/components/Analytics.astro`. The pattern: production-only
(`import.meta.env.PROD`), client id from `OPENPANEL_CLIENT_ID`, `is:inline` scripts, and an init call
with `trackScreenViews`, `trackOutgoingLinks`, and `trackAttributes` all enabled.

**`trackOutgoingLinks` matters more here than on a typical site.** A toolkit is fundamentally a
directory of links *out* — to vendors, docs, and repos. Outbound clicks are the primary success
signal, arguably more than pageviews. The Pass-2 analytics prompt at the monorepo root frames the
motivating question as *"I would like to know what people actually click on"*; for this surface that
question is almost entirely about outbound clicks, and `trackAttributes` makes it declarative
(`data-*` on the card) rather than requiring per-component JS.

**One discrepancy worth resolving.** That component currently runs **three** platforms in parallel —
Umami, Fathom, and OpenPanel — described in its own comment as an evaluation window with a rollout
plan at `context-v/prompts/Setup-Analytics-Across-Sites.md`. If that evaluation has concluded in
OpenPanel's favour, this site should ship OpenPanel alone and the older sites are carrying dead
scripts. If it has not, this site is a data point in it. Worth knowing which, since it is the
difference between one script tag and three.

Related prior art at the monorepo root: `context-v/prompts/Setup-Analytics-Across-Sites.md` (Pass 1,
getting scripts live) and `context-v/prompts/Implement-Deeper-Analytics-Tracking.md` (Pass 2, event
instrumentation — explicitly gated on Pass 1 shipping across all 8 sites plus a week of baseline).


## How client association actually works — `for_clients`

Client content and client-scoped toolkit views are **always derived from a frontmatter property**:

```yaml
for_clients:
  - Hypernova
  - Avalanche
  - Humain
```

Verified against the corpus as of 2026-08-23: **481 files** carry `for_clients`, spread across
`tooling` (221), `concepts` (122), `vocabulary` (46), `vertical-toolkits` (33), `organizations` (22),
`sources` (13), `content-areas` (13), `lost-in-public` (7), `projects` (4), and `essays` (1). It is
written as a YAML block list, not an inline array.

This is good news architecturally: client scoping is a **content-level property**, so it is derivable
per document rather than depending on where a file happens to sit in the tree. Every client view —
page, index, feed, gate decision — is a query over this one property.

### The multi-tenancy leak vector

**A document routinely names several clients at once.** The sample above is a single file listing
three. That creates a specific and easy-to-miss failure: if a client-facing page renders, exposes,
or embeds its own `for_clients` array, **Client A learns that Client B is also a client.**

This is exactly the confidentiality half of the anonymity / confidentiality / customization tension,
and it is a data-shape problem rather than a UI one. The array is an *input* to rendering and must
never be an *output* of it — not in visible copy, not in JSON-LD, not in a data attribute, not in a
search index entry, not in an API response that a client-side script can read.

### Resolved — `for_clients` is curation, not a gate

**Position taken 2026-08-23.** `for_clients` marks content as **curated for** those clients while
**remaining public**. It is not an access-control property. The only concern attached to it is
avoiding SEO that links a client's name to the material.

This is a large simplification. All 481 `for_clients` files are public content: they can be
materialized, cached, indexed by Pagefind, shared, and unfurled with no gate logic whatsoever. The
gating machinery does not apply to them at all.

The rule against emitting the array still holds, but for a different reason than confidentiality: a
public page rendering `for_clients: [Hypernova, Avalanche, Humain]` publishes a crawlable
association between three client names and the material. That is precisely the SEO linkage being
avoided. So the array remains an **input** to rendering, never an **output** of it.

### Gated content is a separate, future content source

There *will* be genuinely gated content — recommendations and similar — but it will **not** live in
the `content` repo. It is destined for **its own private repositories**.

Two consequences worth fixing now, before either is expensive:

- **Do not touch the `content` repo for this.** No new gating properties, no restructuring. It stays
  the public corpus.
- **Gating is deferred, not designed away.** The near-term build is entirely public content. What the
  architecture owes today is a **seam** where a second, private, authenticated content source can be
  added later — not the source itself, and not the gate.

This also means the auth prior art below is aimed at a *later* phase. It is captured now because the
pattern is proven and the seam should be shaped to fit it, not because a passcode is needed in the
first release.

## Prior art — this pattern is already named

[[Content Materialization]] (in `content/vocabulary/`) names our exact problem as an anti-pattern:

> **Implicit views.** A frontmatter property like `for_clients: [Foo]` that has no rendered surface
> is a query whose result was never materialized. If the property is meant to drive a per-client
> view, the view should exist as a file.

That is the client-page problem stated precisely, and it predates this rebuild. The same document
also warns against **over-materialization** — pre-rendering every possible query is waste. The house
rule it lands on: materialize views that have stable URLs, durable consumers, or that agents need to
address; leave the rest JIT.

## Surfaces

### Landing pages by tag and by path

Beyond a flat tag filter: real landing pages for a tag and for a path, each substantial enough to be
worth arriving at from search or a shared link.

- **Auto-collected context.** Related concepts, vocabulary, and adjacent material gathered onto the
  page rather than hand-curated per tag.
- Open: what makes something "related" — shared tags, wikilink adjacency, co-occurrence, or an
  explicit relation in frontmatter? This determines whether the collection is computed at build,
  computed at request, or authored.
- Open: how many tags and paths produce a landing page? All of them, or only those above some
  threshold of content? Thin pages are an SEO liability.

### Client pages

The hardest surface, and the one where the previous attempt fell short. A "Map of Content" file
produced some functionality, but not what was needed.

- **Narrative plus functionality** — a client page should read as something written for them, not a
  filtered index.
- **Partly gated.** Some of the content sits behind a passcode.
- **People pages.** Clients have individual leaders and teams, who need their own pages.
- **The three-way tension.** Anonymity, confidentiality, and the page feeling genuinely customized
  pull against each other. Naming a client makes it feel bespoke and compromises confidentiality;
  anonymizing protects them and makes it feel generic. Note that the `for_clients` leak vector above
  is the sharpest edge of this tension, and it has a concrete fix rather than a philosophical one.
- **People pages inherit the same gate.** Leaders and teams are client-scoped by definition, so
  whatever resolves the `for_clients` gating question resolves theirs too.
- Open: where exactly does the gate fall — whole client page, or public shell with gated sections?
  This is the decision that determines whether the page can be shared, indexed, or unfurled at all.
- Open: is the passcode per client, per person, or per document?
- Open: what does an ungated visitor see — a teaser, a request-access affordance, or a 404?
- Open: does the public surface reference clients anonymously (by sector, size, shape) while the
  gated surface names them? That would resolve the three-way tension by splitting it across the gate.

### Resolved — anonymity by codename, confidentiality by de-indexing

**Position taken 2026-08-23.** Clients do not materially care about public exposure and will not
notice, provided the material does not surface at the top of search results. That converts a
confidentiality problem into a **discoverability** problem, which is far cheaper to solve.

The approach:

- **Public artifact carries a codename**, not the client. A page says *"Saving Lives"* where it would
  otherwise say *"Laerdal"*.
- **Identity is revealed after sign-in or passcode**, using the multi-tier auth already working on
  `mpstaton-site`, `hypernova-site`, and `fullstack-vc`.
- **Discoverability is suppressed** via `sitemap.xml`, `robots.txt`, `llms.txt`, and `noindex`.

**Stated plainly so the tradeoff is deliberate:** `robots.txt`, `sitemap.xml`, and `llms.txt` are
requests to well-behaved crawlers, not access control. Anyone holding the URL can read the page, and
non-compliant crawlers will ignore all three. That is an accepted risk here, not an oversight — but
it means these mechanisms manage *ranking*, never *secrecy*. Anything that must genuinely stay
private has to sit behind the gate, not behind a directive.

**The unlock this buys:** because the public artifact is anonymous, client pages no longer have to be
excluded from materialization. They can be built, cached, shared, and unfurled like any other page —
they simply do not name anyone. This dissolves most of the gating-versus-caching tension.

### Long-term direction on the codename split — not a rule for now

Noted as direction, deliberately **not** adopted as a hard rule — nothing in the first release has
an identity layer to protect, and designing around this now would add machinery for a problem that
does not exist yet.

The direction: when a page does eventually carry both a codename and a real identity, the real name
is better kept out of the static artifact than shipped and hidden. Hiding a baked-in name with CSS or
a conditional is a view-source away from being public. Worth knowing, worth building toward, not
worth complicating the first release over.

The mechanical reason, for whenever it matters: a genuinely prerendered page cannot reveal identity
server-side, because middleware short-circuits on prerendered routes (`mpstaton-site`'s middleware
returns early on `context.isPrerendered` for exactly this reason). An identified layer would arrive
at runtime, by one of:

- a **non-prerendered SSR variant route** that renders identity for an authenticated session, or
- an **authenticated fetch** from the static page to an endpoint that returns the identified data.

If and when that layer is built, keeping the codename→client mapping server-side is the cleaner
posture. Until then this is a note, not a constraint.

### Prior art — the auth pattern already exists in the family

`mpstaton-site/src/middleware.ts` (42 lines) is the closest model and demonstrates the multi-tier
shape directly:

- **Two independent gates** with separate scopes — a `promote` session and a narrower
  `trackRecordMarkups` session — and explicitly *"holding a promote session does NOT unlock markups,
  and vice versa."* That is the tiering the toolkit needs for client / leader / team scopes.
- **`context.locals.<gate>.unlocked`** is set as a plain boolean for routes to branch on, which is
  precisely the codename-versus-identity switch.
- **`context.rewrite()` to the hub page** rather than a redirect, so a gated URL renders its unlock
  prompt without changing the URL.
- **An explicit `context.isPrerendered` early return**, with a comment recording why — the same
  prerender lesson the Astro Knots rules encode.

`fullstack-vc` is the heavier tier: full OAuth (GitHub, Google, LinkedIn) with JWT signing,
`lib/session.ts`, `lib/oauth-roster.ts`, and `pages/api/auth` routes — built for interactivity rather
than for protecting information, as noted. `hypernova-site` is not currently cloned locally, so its
variant has not been examined.

Open: does the toolkit need the passcode tier only, or OAuth as well? Passcode alone is far less
machinery, and nothing described so far requires per-person identity.

### GitHub repositories

A dedicated page for repos, which are frequently dependencies that arrive with no OG image and no
presentation.

- **Secondary purpose:** encouraging clients to value open-source contribution and "keeping up."
  This is a narrative surface, not just a list.
- Open: which repos — our own, our dependencies, or a curated set spanning both?
- Open: repo metadata (stars, last commit, language, license) changes without anyone editing
  content. This makes the repo page the **best test case in the project for API-sourced content**,
  because its data genuinely moves on its own.
- Open: OG images will need generating, since the whole point is that these repos lack them.

### Streams — essays, concepts, vocabulary, sources

Wanted, and due for a redo — but **probably not scoped to this app.**

This is the observation that escalates into an architecture question: if these streams are consumed
by more than one site, the thing that serves them is not a toolkit concern. See Q5 in
[[Opening-Strategy-Questions-for-Architecture-and-Stack]].

## Logged for v2 — OpenGraph image health

**Explicitly a v2 requirement, not first release.** Toolkit entries carry OG images sourced from
vendors' own sites, and those decay: sites redesign, assets move, domains lapse. The requirement has
four parts:

1. **Test** the OG images arriving from toolkit content.
2. **Track** which ones have stopped being valid.
3. **Fall back** to something presentable when one is dead.
4. **Log** the invalid ones in a form that supports fixing them in Obsidian.

**Why this is more than a link check.** The classic failure is not a 404 — it is a `200 OK` that
returns an HTML error page, or a 1×1 placeholder, or a redirect to a homepage. Validity therefore
means status *and* content-type *and* plausible size, not status alone.

**Design notes worth fixing now while it is cheap to think about**

- **It cannot run inline in the build.** Roughly 1,764 tooling entries means 1,764 network requests;
  that is a scheduled job or a standalone script, not a build step. The build should consume a
  *cached verdict*, never perform the check.
- **The log wants to be markdown in the content repo.** "So I can go fix them in Obsidian" is a
  concrete output format requirement: a dated markdown report with wikilinks to the offending entries
  is directly actionable in the vault, where a JSON artifact or a CI log is not.
- **The fallback has prior art.** `lossless-site` already has `src/pages/toolkit/[...slug]/og.png.ts`,
  so per-entry OG generation is proven here. A generated fallback also serves the GitHub repos
  surface, whose whole premise is that repos arrive without good OG images — one mechanism, two
  consumers.
- **Related skill:** `generate-consistent-og-images` covers the house approach to generating share
  imagery, including rasterizing a project's own hero rather than illustrating from scratch.

**Open**

- Does a dead image get replaced permanently in content, or is the fallback applied at render while
  the source value stays as a record of what it was?
- What cadence — weekly, or on some content-change trigger?
- Does the check also cover the images' *dimensions*, since undersized images unfurl badly even when
  they load?

## What is not yet decided

Deliberately open: the visual design, the routing scheme, whether client pages live on this site at
all or on a sibling, and the boundary between what this app owns and what a shared content service
would own.

## Related

- [[Opening-Strategy-Questions-for-Architecture-and-Stack]] — the architectural half of this pair.
- [[Content Materialization]] — house coinage in `content/vocabulary/` that already names the
  implicit-views and JIT-only-derivation anti-patterns this rebuild has to answer.
- [[2026-08-03_Rebuild-Keep-Drop-Ledger]] — the `lossless-site` rebuild ground truth, at
  `lossless-monorepo/site/context-v/decisions/`, reachable from here at `../../../site/`.
