---
title: "Opening Strategy Questions for Architecture and Stack"
lede: "Four questions that decide the shape of the Lossless Toolkit rebuild — where content lives, how fast an edit reaches the public, how the brand stays in sync across a dozen sites, and whether server-rendered pages can satisfy crawlers as well as static ones."
date_created: 2026-08-23
date_modified: 2026-08-23
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5 (1M context)
semantic_version: 0.0.0.9
tags:
  - Exploration
  - Architecture
  - Content-Pipeline
  - Design-Tokens
  - Server-Rendering
  - Static-Generation
status: Open
---

# Opening Strategy Questions for Architecture and Stack

The Lossless Toolkit is a catalog of tools, organized by vertical and by tag, that people browse
and share. Rebuilding it raises four questions that have to be answered before any code is written,
because each one determines a different axis of the system: where the content lives, how quickly an
edit reaches the public, how the site stays visually part of the Lossless family, and whether pages
rendered on demand can still be found and shared like ordinary web pages.

These are deliberately framed as questions rather than decisions. The point of this document is to
state them precisely enough that answering them is tractable — and to record what has to be true for
each candidate answer to work.

## Why these four, and why now

The toolkit surface as it exists today is 10 routes and 14 components sitting on roughly 1,900
markdown files. The rebuild is not a port; it is a chance to choose a content architecture on
purpose. All four questions below are really one question asked from four sides: **what is the
authoring-to-reader loop, and how long is it?**

Answering them in the wrong order risks building a fast site that is miserable to author, or a
delightful authoring experience that search engines cannot see.

---

## Q1 — One content source, two consumption modes

> **As asked:** *"How can we host the content files in a way so that when I update them it both hot
> reloads in the Svelte SSR pages, and propagates a build for Astro SSG?"*

**Product framing.** An editor updating a tool entry should see the change immediately while
working, and the public site should reflect it without anyone remembering to run a deploy.
Authoring should feel like editing a document, not like shipping software.

**Engineering framing.** Choose the canonical home for toolkit content, then define the two paths
that lead away from it: one that produces sub-second feedback in local development, and one that
reliably triggers a production build. The constraint is that these must be *the same source* — any
design requiring a human to write content twice, or to remember to sync two stores, will drift and
is disqualified.

**What would have to be true**

- Exactly one canonical write target. No dual-write, no "the real one is whichever was edited last."
- Local edits produce visible feedback fast enough to author against, without a manual restart.
- A write reaches production without a human running a command.
- The mechanism stays tractable at current volume (~1,900 files) and degrades predictably as it grows.

**Open sub-questions**

- Does content live in-repo (as a submodule, the way `lossless-site` consumes `content/`), or in an
  external store the site reads from?
- If in-repo: what triggers the production build — a webhook on the content repo, a scheduled build,
  or a submodule-pointer bump?
- If external: what restores the filesystem-watch behavior that makes local authoring feel instant?
- Is the authoring surface a text editor on files (Obsidian), or something else? This constrains
  every answer above.

---

## Q2 — Content that goes live without a rebuild

> **As asked:** *"Is it possible to have Astro render content from a place via API so that changes in
> content that don't require a rebuild go live almost instantly, like they do on local?"*

**Product framing.** Correcting a typo, updating a tool's description, or adding a tag should not
wait on a full site build. The cost of a small fix should feel proportional to the size of the fix.

**Engineering framing.** This is the static/dynamic boundary question. It resolves into a per-route
classification: which content is frozen at build time, and which is fetched at request time. The
interesting engineering is not the fetching — it is the caching and invalidation policy that keeps
request-time rendering from being slow or stale.

**What would have to be true**

- A clear rule for which routes are build-frozen and which are request-time, expressible per route
  rather than decided ad hoc.
- Request-time routes stay fast enough that the freshness gain is not paid for in latency.
- A defined invalidation story: when content changes, what expires, and how quickly.
- Graceful failure — if the content source is unreachable at request time, the page degrades rather
  than 500s.

**Open sub-questions**

- Which of Astro's content mechanisms (content layer / loaders, per-route `prerender`, on-demand
  revalidation) apply at the version we pin? This needs verifying against the actual target version
  rather than assumed.
- Is "almost instantly" measured in seconds or minutes? The acceptable number changes the design.
- Which content classes genuinely need instant propagation, and which are fine on a build cadence?
  Plausibly: tool metadata edits are instant; adding a whole new vertical is a build.
- Does the API layer serve rendered content, or raw markdown the site renders?

---

## Q3 — A shared, always-in-sync design token layer

> **As asked:** *"Is it possible to have a `lossless-theme-modes` CDN link somewhere that is
> embeddable so the many Lossless-themed sites have a starter set of design tokens that are always
> in sync?"*

**Prior art — this is less greenfield than it looks.** `astro-knots/packages/` already contains
`@knots/tokens` (v0.1.0, marked `private: false` and therefore publishable, but **not published to
any registry today** — it is workspace-only, consumed by path). It already exports `./css/modes.css`
alongside
`./css/variables.css`. There is also `@knots/brand-config`, `@knots/tailwind`, `@knots/icons`,
`@knots/svelte`, `@knots/astro`, and `@knots/ui`, plus a `design-system-viewer` app. The question is
therefore **not** "should tokens exist" but "should the existing token package gain a CDN
distribution channel, and what are the consequences of consuming it that way?"

**Product framing.** Every Lossless-branded site should read as one family, and a brand-level change
should propagate without opening a dozen repositories. A new site should get the house look by
default rather than by copying CSS from a sibling.

**Engineering framing.** Choose a distribution mechanism for a token layer that already exists as a
workspace package, and decide the versioning policy that comes with it. There is a direct tension:
"always in sync" implies an unpinned runtime fetch, while build reproducibility and page performance
both argue for a pinned, build-time dependency. These pull in opposite directions and the resolution
should be explicit rather than incidental.

**What would have to be true**

- A single source of truth for token values, with each site's `DESIGN.md` as the human-readable
  contract over it.
- A stated pinning policy — whether sites track a moving `latest` or pin a version and upgrade
  deliberately.
- No render-blocking dependency on a third-party host in the critical path.
- A defined blast radius: if a token changes and every site picks it up immediately, that is a
  feature only if it is also reversible.

**Resolved 2026-08-23 — no published package; self-hosted on Cloudflare instead**

**Decision: do not publish `@knots/tokens` to a registry.** The overhead is real and recurring —
JSR and GitHub, click-through, every time the CSS changes — and the consumer set is our own UIs.
Registry publishing buys version negotiation and third-party discoverability, neither of which is
needed for internal CSS. A Cloudflare-hosted URL gets the same distribution without the ritual.

Registry-backed CDNs (unpkg, jsDelivr, esm.sh) are therefore out, since they all resolve from a
registry. Self-hosting is the path.

**Why a CDN and not just a relative path.** Worth stating, because it is the real constraint rather
than mere preference: sites under `astro-knots` are **not** pnpm workspace members, and each site is
its own git repo. A build in CI clones only the site repo, so `../../../packages/tokens/css/` exists
locally and does not exist in the deploy. That rules out the relative-path shortcut and leaves
exactly three options — publish, self-host, or vendor a copy into each site. Self-hosting is the
chosen one.

**The remaining tension is the same one as Q2.** A runtime `<link>` to a stable URL gives genuine
always-in-sync: change the CSS, every site updates with no rebuild. The costs are a render-blocking
request to a third-party origin, and a blast radius where one bad token change breaks every site at
once with no pinning. A build-time fetch inverts all of that — no runtime cost, no third-party
dependency at request time, but propagation requires a rebuild.

Both are cheap to build. Which is right depends on whether token changes should reach
already-deployed sites without rebuilding, which is the Q2 question wearing different clothes.

**Preferred token shape — named colors feeding semantic and system styles**

Stated as a preference, not a hard rule: named colors should be pulled into semantic styles rather
than semantic tokens carrying raw values, so that a palette change is a re-point rather than a
find-and-replace.

This turns out to be the **already-documented house convention**, not a new idea. The `theme-system`
skill specifies a two-tier system: Tier 1 named tokens (`--color__violet-electric`, BEM-ish `__`
separator, private to the theme) and Tier 2 semantic tokens (`--color-primary`, kebab-case,
referencing Tier 1 through `var()`). The stated rationale is client iteration — re-point a semantic
token and every component follows without edits.

`sites/fullstack-vc/src/styles/theme.css` is the realized reference: 16 named tokens, with semantics
declared as `--color-primary: var(--color__violet-electric)`.

**`@knots/tokens` does not currently follow it.** Worth knowing before it becomes the CDN artifact:

- **No Tier 1 at all.** `variables.css` declares semantic tokens with raw hex inlined
  (`--primary: #2563eb`). There are no named colors to re-point.
- **Duplication.** `modes.css` re-declares the same semantic tokens with fresh hex per mode, so a
  palette change means editing values in two files.
- **Two modes, not three.** Only light and dark are present. The house contract is three, the third
  being a dark-based vibrant mode.
- **The values are generic Tailwind defaults**, not a Lossless palette — `#2563eb` is Tailwind
  blue-600, `#f59e0b` is amber-500. This package reads as unfinished scaffolding rather than a
  realized brand, which matters if it is about to become the shared source of truth.
- `src/index.ts` exposes a `ColorScale` type suggesting an intent toward full scales, with only step
  `500` ever populated.

None of this blocks the Cloudflare decision — it describes what should be *in* the artifact being
served. The tidy version: bring the token set to the two-tier, three-mode house shape, with a real
Lossless palette as Tier 1, then serve that.

**The house palette exists — it has just never been consolidated**

Confirmed against the corpus 2026-08-23. This is not a greenfield palette exercise; the colors are
real, in use, and shared across sites. `#04e5e5` appears in 9 `lossless-site` files and is the
`primary` in `lossless-changelog`'s `DESIGN.md`.

`lossless-site` already runs a two-tier system, with genuinely good Tier 1 names:

| Named token | Value |
|---|---|
| `--cyan-aqua--brightest` | `rgb(4, 229, 229)` — the house cyan, `#04e5e5` |
| `--purple-heart` | `hsla(272, 73%, 55%, 1)` — the house violet, ≈ `#9138e0` |
| `--aquamarine` | `#6FFFD6` |
| `--hippie-blue` | `#50a3b3` |
| `--gunmetal` | `#283139` |
| `--bastille-black` | `hsla(273, 18%, 10%, 1)` |
| `--jaguar-black` | `hsla(288, 100%, 2%, 1)` |
| `--bunker-black` | `hsla(218, 22%, 7%, 1)` |
| `--white-catskill` | `hsla(184, 35%, 92%, 1)` |

Semantics reference them as `--clr-lossless-primary-600: var(--purple-heart)`. `lossless-changelog`
contributes the era ramp (`#22a6b5`, `#9138e0`, `#d9233b`, `#f59c49`) — load-bearing data, not
decoration — plus the type stack: Bodoni Moda display, Figtree heading and body, JetBrains Mono, and
Poor Story for handwritten notes.

**Why it reads as unfinished — three conventions and some collisions**

- **Three naming schemes across the family.** `--clr-lossless-*` → bare named tokens
  (`lossless-site`); `--color-*` → `--color__*` (`fullstack-vc`, and what the `theme-system` skill
  specifies); bare `--primary` with inlined hex (`@knots/tokens`).
- **Conflicting duplicate definitions in `lossless-site`.** `--clr-lossless-accent--brightest` is
  defined twice (once `#04e5e5`, once `var(--cyan-aqua--brightest)`), `--clr-lossless-primary-dark`
  twice (`var(--bastille)` vs `var(--bastille-black)`), `--clr-lossless-primary-glass` twice (once
  `hsla`, once `rgba`).
- **Scattered definition sites** — some tokens are declared in `src/styles/animations.css` and even
  in `src/pages/debug/sequential-section.astro`, rather than a single theme file.
- **Mixed notation** — hex, `hsla`, and `rgb` for the same tier.

Per the drift policy, none of this gets fixed in `lossless-site` as a side effect of this work. It is
recorded because consolidating it *here* is the opportunity: this site can adopt one convention and
serve it, rather than inheriting the ambiguity.

**The modes do not exist yet — this is design work, not consolidation**

Correcting an easy misreading of the above: **the palette catalogued here is a dark palette.**
`bastille-black`, `jaguar-black`, `bunker-black`, and `gunmetal` are dark grounds.
`lossless-changelog`'s `DESIGN.md` states it outright — *"Dark by decision, not by mode."*

Verified across the family on 2026-08-23, and the result is stronger than expected:

| Site | Mode blocks in its theme/global CSS |
|---|---|
| `fullstack-vc` | none — `:root` only |
| `lossless-changelog` | none — `:root` only |
| `twf_site` | none — `:root` only |
| `mpstaton-site` | no `theme.css` / `global.css` at all |

**No Lossless site implements modes.** Not three, not even light and dark. Every one is single-mode.

Two consequences worth stating plainly:

- **The `theme-system` skill's three-mode contract has zero realized implementations.** The skill
  cites `sites/fullstack-vc` as the "vibrant mode reference (lines 90-130 of `theme.css`)", but that
  file contains only a `:root` block. The skill describes itself as an initial scaffold with most
  references still TBD, so this is aspiration recorded as if it were precedent. Worth knowing before
  treating it as a spec to conform to.
- **Ironically, the only place with mode blocks is `@knots/tokens`.** Its `modes.css` has
  `[data-theme="light"]`, `[data-theme="dark"]`, and `.dark` — carrying generic Tailwind values, in
  a package nothing consumes.

So **light mode and vibrant mode have never been attempted, and nobody knows what they look like.**
That has to be converged on, and it is design work rather than refactoring. Promoting the existing
named colors to Tier 1 yields a dark theme and nothing else; the light grounds, the light-mode text
ramp, and the entire vibrant treatment do not exist as values anywhere.

Per the `theme-system` skill, one constraint is already known: **vibrant is dark-based**, not
light-based. The recorded common error is vibrant inheriting light mode's white background.

**What "nailed down" would mean concretely**

1. One naming convention for both tiers, chosen rather than inherited.
2. Tier 1 = the named colors above for dark, **plus newly designed values for light and vibrant**.
3. Tier 2 = a fixed semantic vocabulary, referencing Tier 1 exclusively — no raw values.
4. A decided mode contract, and an actual design for each mode in it — the contract is the cheap
   part; converging on what light and vibrant *look like* is the real work.
5. One file, one origin, one URL, with the `DESIGN.md` as its human-readable contract.

**The opportunity.** This site can be where three modes get worked out for the first time, with the
result propagated to the family through the shared token URL rather than reimplemented per site.
That also makes it a good candidate for the variant loop — mode design is exactly the kind of
question where three parallel attempts along a named axis beat one attempt iterated.

**Open sub-decisions**

- Which Cloudflare product — Pages (git-connected, auto-deploys on push, likely simplest), R2 with a
  public bucket, or a Worker? Pages appears to fit best because it removes the manual step entirely.
- What URL and versioning scheme? Serving both a moving `/latest/modes.css` and pinned
  `/v0.1.0/modes.css` costs almost nothing and preserves the option to pin later.
- Runtime `<link>`, build-time fetch, or both — see the tension above.
- Which domain does it live on, and does one already exist to hang it off?
- Where does the source of truth stay — `astro-knots/packages/tokens/` with a deploy hook, or a
  dedicated small repo?
- Does the shared artifact ship a full three-mode contract, or only the modes this site uses?
- Is there an actual Lossless palette to promote into Tier 1, or does one need designing first?


**Open sub-questions**

- Does "always in sync" mean runtime-fetched, or "pinned but trivially upgradable"?
- How do per-site overrides layer on top without forking the base?
- Does this site consume tokens as a sibling workspace package, given that sites are *not* pnpm
  workspace members in `astro-knots`?

---

## Q4 — Server-rendered pages that behave like static ones

> **As asked:** *"Can Svelte SSR ALSO serve pages that kind of 'pose' as SSG for SEO and link
> sharing?"*

**Product framing.** A link to a tool page, pasted into Slack or a text message, must unfurl with the
right title, description, and image. Search engines must index the page as a real page. Neither
should depend on how the page happened to be rendered.

**Engineering framing.** The useful reframing is that "posing as SSG" is really **cacheable SSR**.
Crawlers and unfurlers do not ask how a page was produced; they ask whether the first HTTP response
contains complete HTML, returns the right status code, declares a stable canonical URL, and carries
its metadata in that initial payload. Server rendering satisfies all of this — provided nothing
load-bearing is deferred to client-side rendering. What remains is a caching layer that buys
static-like latency without giving up freshness.

**What would have to be true**

- Complete, meaningful HTML in the first response — no metadata or primary content injected after
  hydration.
- Correct status codes, particularly 404 and any redirects.
- OpenGraph and Twitter metadata present server-side, with absolute image URLs.
- Stable, canonical, human-readable URLs that do not change per render.
- Cache headers deliberate enough that a CDN can serve most requests without touching the origin.

**Open sub-questions**

- Which unfurlers matter most here, and do any of them execute JavaScript? (Most do not — this is
  usually the decisive constraint.)
- What is the caching layer, and what is the invalidation path when Q2's instant updates land?
  Q2 and Q4 are in direct tension and should be resolved together.
- Does any toolkit route need auth? If so, the Astro Knots rule that gated routes must never be
  prerendered applies, and the answer to this question changes for those routes.
- Where do OG images come from — the existing per-slug endpoint, generated at build, or on demand?

---

## Q5 — Is the content service a toolkit concern or family infrastructure?

> **Emerged from:** the observation that essays, concepts, vocabulary, and sources are due for a
> redo but *"probably not scoped to this app"* — and the follow-on thought that if content is served
> via API, perhaps one backend serves several apps and sites.

**Product framing.** The toolkit is one reader of the Lossless corpus. Essays, concepts, vocabulary,
and sources have readers elsewhere. If each site re-implements its own way of reading the same
content, they drift, and a change to how content works has to be made several times.

**Engineering framing.** Decide the ownership boundary before building anything that reads content.
Three positions, and they are not equally reversible:

- **Consume.** The toolkit reads from a content service it does not own. Requires that service to
  exist, or to be stubbed behind an interface the toolkit codes against.
- **Own.** The toolkit builds the service, and later sites consume it. Risks turning a site rebuild
  into a platform project, on the toolkit's schedule.
- **Defer.** The toolkit reads content directly, with a seam placed where the service would go, and
  the decision is made once a second consumer actually exists.

**The scope hazard.** This is the question most likely to swallow the project. A toolkit rebuild is
a bounded piece of work; a content platform for the whole family is not. Whatever we choose, the
boundary should be written down and defended, because "while we're in here" is how the bounded thing
becomes the unbounded one.

**On Hono specifically.** Named as a candidate — small, fast, built on Web standards, and it deploys
to edge runtimes, which fits the house preference for lean tools. Two honest caveats before it
becomes the answer:

- It is **not on the Astro Knots approved-framework list**, which puts it on probation by default.
  That is not a veto, but it needs a deliberate justification rather than quiet adoption.
- **A framework may not be needed at all.** Astro can serve endpoints from this app. The prior
  question is whether a *separate deployable service* is warranted — if the answer is "defer," Hono
  is premature; if the answer is "own," it is a reasonable shortlist entry.

**Open sub-questions**

- Does a second consumer exist today, or is it anticipated? Building for one consumer that might
  become several is the classic over-build.
- If a service exists, what does it serve — rendered HTML, structured JSON, or raw markdown?
- Where does it deploy, and does it become a thing that can be down? A build-time-only dependency
  cannot take the site offline; a request-time one can.

---

## Deployment and domains — staged

**Plan stated 2026-08-23.** Ship first to the platform-provided subdomain
`lossless-toolkit.vercel.app`. Move to a real subdomain only once we like it *and* more of the
refactor has landed. The eventual shape is subdomain-per-surface:

- `toolkit.lossless.group`
- `changelog.lossless.group` (the already-extracted first stage)

**Why this matters beyond hosting.** Subdomain-per-surface is the extraction strategy made visible.
Each extracted surface becomes its own origin, which means separate builds, separate deploys, and no
shared bundle between them. That directly strengthens the case for a shared runtime token link from
Q3: sites on different origins cannot share a build artifact, so a common CSS URL is doing real work
rather than saving a copy-paste.

It also raises cross-surface questions that do not exist inside a single site — shared navigation
between toolkit and changelog, consistent headers, and whether a reader perceives them as one
property or several.

**Worth confirming before launch**

- Vercel applies `X-Robots-Tag: noindex` to preview deployment URLs. Whether that also applies to a
  production `*.vercel.app` domain should be verified rather than assumed — it interacts directly
  with the de-indexing approach for client-curated content.
- Launching on one hostname and moving later means URLs change. Redirects and canonical tags at
  cutover are cheap if planned and annoying if not. Low stakes during the `vercel.app` phase, since
  little external linking will have accrued.
- The site deploys on Vercel while Q3 proposes Cloudflare for tokens. Two platforms is fine, but
  serving the token CSS from the same Vercel project is worth a moment's thought purely to avoid a
  second platform to operate.
- `custom-domain-cutover` exists as a skill covering DNS, cert issuance, and the stale-cache theater
  that follows a cutover. It is written against Railway rather than Vercel, so it is adjacent prior
  art rather than a direct playbook.

---

## Constraints discovered while scoping the product surface

These emerged from the surface inventory and materially narrow the answer space above. See
[[Surface-Inventory-and-Open-Product-Questions]] for the surfaces themselves.

### Pagefind indexes at build time — "live" and "searchable" are different guarantees

Pagefind builds its index by crawling built HTML output. Content that goes live without a rebuild is
therefore **not searchable until the next build**, even though it is visible. This is a direct
constraint on Q2: instant propagation and instant searchability are not the same promise, and the
gap between them has to be either closed deliberately or accepted per content class.

Resolutions worth weighing: accept a search lag for fast-moving content; run indexing as a job
decoupled from the site build; or serve dynamic content through a different search path entirely.

### A public Pagefind index is a public asset — gated content must never enter it

Pagefind's index ships as static files the browser fetches. **Anything indexed is readable
regardless of what gate sits in front of the page it came from.** With client content behind a
passcode, an over-broad index is a confidentiality leak, not merely a bug.

There is a convenient interaction here: if gated routes are never prerendered — which the Astro
Knots rule already requires — Pagefind never sees them, and the leak cannot occur by construction.
The cost is that gated content is then not searchable *for the client either*. A client-facing
search would need a separate, access-controlled index.

### The house already has a decision rule — Content Materialization

[[Content Materialization]] (`content/vocabulary/`) is Lossless-internal coinage for promoting a
reference or query into a real, addressable artifact. It matters here because it supplies the exact
rule Q2 and Q4 both need, and it predates this rebuild:

> **JIT-only derivations.** A computation done only at request time is fine for ergonomics but
> cannot be linked to, cached by CDNs, or crawled by search engines. If the derived view is part of
> the public surface, materialize it.
>
> **Over-materialization.** Pre-rendering every possible query is wasteful. Materialize the views
> that have stable URLs, durable consumers, or that need to be addressable by agents — leave the
> rest as JIT.

So the route-classification question Q2 and Q4 keep circling is not open after all — the house
answer is **materialize what needs a stable URL, a durable consumer, or agent addressability; leave
the rest JIT.** Applied here: tag and path landing pages, tool pages, and repo pages are
materialized; live filtering and personalized slices stay JIT.

This also reframes Q2. "Instant updates without a rebuild" is a request to move content *out* of
materialization — which the same document warns costs linkability, cacheability, and crawlability.
The question is therefore not "can we" but "which content classes can afford to give those up," and
for a catalog whose whole value is being findable and shareable, the honest answer may be "few."

### `for_clients` is the gate, and it is multi-valued

Client scoping derives from a single frontmatter property, `for_clients`, present on 481 files. It
is multi-valued — one document routinely names several clients. Two consequences for this document:

- **`for_clients` is curation, not a gate** (resolved 2026-08-23). The 481 files carrying it are
  public. No gating logic attaches to them, so the public/gated split does *not* have to be
  evaluated per document — which removes the caching problem this bullet originally raised.
- The array must still never appear in output, including in any search index or API response —
  a public page naming three clients together publishes exactly the SEO association we are avoiding.
- **Genuinely gated content is a separate future source**, destined for its own private repos rather
  than the `content` corpus. The architecture owes a **seam** for a second authenticated content
  source, not a gate. This meaningfully de-risks Q2 and Q4: the first release is all-public, so
  materialize-and-cache applies everywhere without exception.

### Gating breaks shared caching — Q4 resolves per route class, not globally

A gated route cannot be cached in a shared CDN keyed on URL alone, because the response depends on
who is asking. Cache must vary on session or bypass entirely. So Q4 does not have one answer: public
toolkit pages can be aggressively cached and should behave exactly like static ones, while client
pages are uncacheable at the shared layer by definition. The route classification this implies is
the same one Q2 needs — which is a good sign the two should be decided together.

---

## How the questions interact

They are not independent, and answering them separately will produce a contradiction.

- **Q1 and Q2** are the same axis at different time scales: Q1 is the authoring loop, Q2 is the
  publishing loop. A single content architecture has to serve both.
- **Q2 and Q4** are in direct tension. Q2 wants content fetched as late as possible; Q4 wants
  responses cached as aggressively as possible. The cache invalidation policy is where that tension
  is actually resolved, and it is the highest-risk unknown in this document.
- **Q3 is largely separable** and could be decided first. It is also the closest to already having an
  answer, given `@knots/tokens` exists.
- **Q5 sits underneath Q1 and Q2.** Where content is served from determines what the authoring and
  publishing loops can even look like. Answering Q1 and Q2 without settling Q5 risks building a
  content path that a later service invalidates.

A reasonable sequencing is therefore: settle Q3 (nearly answered, and separable), take a position on
Q5's ownership boundary (even if that position is an explicit "defer, with a seam"), resolve Q1 and
Q2 together as one content architecture, and let Q4 fall out of the caching policy Q2 forces — noting
that Q4's answer will differ between public and gated routes.

## What this document does not decide

Deliberately unanswered here: the framework mix beyond the Astro Knots defaults, whether the six
existing Svelte toolkit components survive the rebuild, hosting and deploy target, and the
relationship between this extraction and the `site-next/` strategy recorded in the `lossless-site`
rebuild ledger. Those belong in a spec, once these four are settled.

## Related

- [[Content Materialization]] — house coinage supplying the materialize-vs-JIT decision rule.
- [[Surface-Inventory-and-Open-Product-Questions]] — the product-side companion: the surfaces we
  want, the publish ritual we intend to delete, and the client-page access questions.
- [[2026-08-03_Rebuild-Keep-Drop-Ledger]] — Phase-0 ground truth for the `lossless-site` rebuild,
  including the deadweight method and the keep/drop lists that cover toolkit components. Lives at
  `lossless-monorepo/site/context-v/decisions/`, reachable from this repo at `../../../site/`.
- [[Multi-Site-Astro-Starter-Kit-Architecture]] — prior art on the `@knots/*` design-system family.
- `astro-knots/packages/tokens/` — the existing token package behind Q3.
