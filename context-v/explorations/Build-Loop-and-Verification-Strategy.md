---
title: "Build Loop and Verification Strategy"
lede: "How the Lossless Toolkit gets built — test-first on both ends, with parallel full-stack variants generated unattended and cherry-picked on return."
date_created: 2026-08-23
date_modified: 2026-08-23
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5 (1M context)
semantic_version: 0.0.0.6
tags:
  - Exploration
  - Testing
  - Agent-Workflow
  - Build-Loop
status: Open
---

# Build Loop and Verification Strategy

Two requirements for how this rebuild gets made, as distinct from what gets made: it should be
**test-driven on both the backend and the frontend**, and it should support a **variant loop** —
sending several agents off to build competing full-stack implementations in parallel, then returning
to cherry-pick the best parts of each.

They are stated together because they depend on each other more than they look.

## TDD, front and back

Test-first for backend work is well-trodden. Test-first for an Astro frontend needs its rungs named,
because "frontend tests" spans four quite different things:

| Rung | Answers | Cost |
|---|---|---|
| Unit | Does this function do the right thing? | Cheap, fast, run constantly |
| Component | Does this component render the right markup from these props? | Cheap |
| Route / integration | Does this URL return the right HTML, status, and metadata? | Moderate |
| Browser drive | Does the actual click-path work in a real browser? | Expensive, slow |

The house already has an opinion on the top rung: the Astro Knots browser-drive convention says the
click-path is **named in the phase plan before implementation**, and that a drive living only in a
session transcript does not count as codified. That is TDD applied to the browser rung — write the
path down first, then make it pass.

**Open**

- What is the minimum bar for a slice to be considered green? Build passing plus unit plus route
  tests, with browser drive reserved for slices that have a real click-path?
- Content-shaped assertions are unusual and worth deciding early: with ~1,900 markdown files, tests
  over *content* (does every tool have required frontmatter, do all wikilinks resolve, does no page
  emit `for_clients`) may be more valuable than tests over components. The `for_clients` rule in
  particular is exactly the kind of invariant a test should enforce rather than a convention.

## Tooling — and whether API testing needs its own stack

**Vitest is the runner.** Astro already builds on Vite, so Vitest shares the same config and
transform pipeline (`getViteConfig` from `astro/config`) — no second toolchain, no duplicate module
resolution. It also has existing use in the parts of the tree currently visible (`twf_site`, `flave-ai`) — see
the survey caveat below before treating that as a complete picture.

**Playwright is the browser rung**, already standardized for agent-driven browser testing and
consistent with the Astro Knots browser-drive convention.

### Does API-first need separate tooling? Mostly no — with one real exception

**Testing the API: no separate framework needed.**

- If the API is Hono, it ships `app.request()` for in-process testing — no listening server, no
  `supertest`, and it runs inside Vitest directly.
- If the API is Astro endpoints, they test the same way through the shared Vite config.

Either way, the HTTP layer is exercised without new machinery.

**Contract testing: this is what "API-first" actually buys.** If the contract is designed first, the
schema becomes the durable artifact rather than the prose. Defining it once in Zod (already a
dependency in `augment-it`) yields runtime validation, static types, test fixtures, and — via
`@hono/zod-openapi` — a generated OpenAPI document, all from one definition. Without that, "API-first"
degrades into "we wrote the routes first."

**Monitoring is genuinely a separate concern.** Worth separating from testing rather than blending:

| | Testing | Monitoring |
|---|---|---|
| Runs | Pre-deploy, in CI | Post-deploy, continuously |
| Against | Fixtures, ephemeral state | Real production infrastructure |
| Fails when | Code is wrong | The world is wrong — expired certs, dead upstreams, region outages |

**Checkly is the tool that bridges the two**, and the bridge is why it is worth considering here:
checks are authored as ordinary Playwright specs and deployed as production monitors. Given Playwright
is already the standard, this is a small increment rather than a new discipline — the same spec can
gate a deploy and then watch production.

**Not our codebase.** `self-host-stack/core/cal.diy` runs exactly this combination —
Vitest (`test`, `tdd` as `vitest watch`), Playwright, and Checkly with a `checkly.config.ts` plus a
`__checks__/` directory holding both `.check.js` monitors and Playwright `.spec.ts` files. It is
worth reading as a working reference, but it is **upstream Cal.com that we self-host** — the whole
point of `self-host-stack` is that its contents are other people's software. Every workspace in it is
`@calcom/*`. Treat it as evidence the combination works at scale, and as nothing at all about how
Lossless does things.

### Survey caveat — this was a partial tree

Any claim here about "what the family uses" is scoped to repos that happened to be cloned locally on
2026-08-23. Most were not. Uninitialized at the time of writing:

- **Monorepo level:** `analysis`, `content-farm`, `data`, `site_archive`, `tidyverse`,
  `studies/content-driven-website-engines`
- **Astro Knots sites:** `arthouse-site`, `banner-site`, `cilantro-site`, `coglet-shuffle`,
  `cogs-site`, `dark-matter`, `hypernova-site`, `learnstart-site`

Repos are brought into the working tree as work reaches them, so absence from a survey means *not
looked at*, never *does not exist*. `hypernova-site` in particular is cited elsewhere as a mode-switcher
and auth reference and has never been examined here. Re-run any "nobody does X" conclusion against a
fuller checkout before relying on it.

### The prior question

None of this is decidable until Q5 settles. If the toolkit **defers** a separate service and reads
content directly, there is no standalone API to test or monitor, and Vitest plus Playwright is the
whole answer. A dedicated API stack only earns its place if we **own** a deployable service.

Note also that the v2 OpenGraph health checker is a **monitoring** problem wearing testing clothes —
it checks external resources on a schedule, and fails because the world changed rather than because
our code did. Whatever handles monitoring should probably handle that too.

## The variant loop

The desired working rhythm: dispatch several agents to build competing full-stack variants of the
same slice, unattended and in parallel, then return and cherry-pick.

**Why TDD is what makes this work.** Without a test suite, "which variant is best" is a taste
judgment made by reading three codebases — expensive, and the comparison degrades as the variants
grow. With a shared suite, every variant reports against the same objective function, and the
conversation narrows to the parts taste actually decides: structure, readability, and feel. **The
tests are the scoring rubric that makes parallel variants comparable rather than merely numerous.**

So the ordering matters: a slice needs a spec and a test suite *before* variants are worth
generating. Three variants of an underspecified slice produce three different guesses.

**Mechanics that make it feasible**

- Agents can run in **isolated git worktrees**, so parallel variants edit the same paths without
  colliding.
- Variants should differ along a **named axis** — a stated hypothesis each — rather than being three
  undirected attempts. "Islands vs. no islands", "build-time vs. request-time collection",
  "one route vs. split routes" are comparisons. Three unlabelled tries are not.
- Cherry-picking implies variants stay **small enough to read**. A slice, not a phase.

**Composes with a decision already made.** The `lossless-site` rebuild ledger locked *green-per-phase
with a gate at each phase boundary* — autonomous within a phase, checkpoint between. The variant loop
fits inside that gate rather than replacing it: a phase runs to green N times in parallel, and the
gate becomes a cherry-pick instead of a yes/no.

**Open**

- How many variants? Three is the stated instinct; more than three is likely more than can be read
  carefully in one sitting.
- What is the merge mechanism — take one wholesale and port pieces in, or synthesize a fourth from
  the best of the three?
- What does an agent do when its variant fails the suite? Iterate to green unattended, or return
  red with a report?
- How is the axis chosen — by us up front, or proposed by the agents from the spec?

## Best-practice scaffolding as agent infrastructure

**Stated as a principle 2026-08-23:** do the best-practice artifacts *first*, and maintain them as a
matter of principle — a design-system landing page, a real component library, API documentation. Not
ceremony, and not deferred to "when there's time."

The justification is velocity rather than virtue. An agent that can read a component catalog builds
consistently; an agent that has to grep for prior art guesses, and its guesses diverge every session.
These artifacts are **machine-readable context** in exactly the sense `context-v/` already is — the
same discipline pointed at code instead of prose. Maintained, they compound. Skipped, every future
session re-derives the same answers slightly differently.

### The current state — several partial attempts, nothing converged

| Artifact | Where it exists |
|---|---|
| `/design-system` route | `fullstack-vc`, `mpstaton-site`, `twf_site` |
| `/brand-kit` route | `fullstack-vc`, `twf_site` |
| Static specimen pages | `lossless-changelog/design-system/` — `foundations/{type,color}.html`, `components/{entry-row,author,altitude,ledger-strip}.html` |
| Live-rendered catalog | `fullstack-vc/src/pages/design-system/` — 763-line index plus categorised sub-pages |
| Component-library route | `twf_site/src/pages/design-system/component-library.astro` |
| Standalone viewer app | `astro-knots/design-system-viewer` — one `index.astro` and a `global.css`; effectively a stub |
| Shared component package | `astro-knots/packages/ui` — contains only `theme-mode/` |
| Per-site `DESIGN.md` | `twf_site`, `lossless-changelog`, `fullstack-vc` |

Six shapes for one idea.

**`fullstack-vc` is the fullest attempt and the best convergence candidate.** Its
`/design-system/index.astro` runs 763 lines and — importantly — carries **live component imports**
rather than static specimens, so the page cannot drift from what the components actually do. It is
organised into categorised sub-pages:

```
design-system/
  index.astro          Card · WebinarCard · Buttons · TextLinkSpan ·
                       ContentPreviewNavCard · Effect tokens (--fx-*) ·
                       Sub-pages · Catalog index
  components/          jumbo-popdown-{more,projects,working-groups} · alert-display
  markdown/            markdown-reader · image-carousel · callouts
  sections/            project-gallery · working-group-gallery
  heroes/              hero-banner-with-message-hierarchy
brand-kit/index.astro
```

Three things worth stealing from it: **live rendering over specimens**, the **category split**
(components / markdown / sections / heroes), and an explicit **catalog index** so the page is
navigable rather than one long scroll.

`twf_site` is the second attempt — `/design-system/component-library.astro` plus a `/brand-kit/` with
`heros` and `heros-splitscreen`. Shallower, but it separates *component library* from *brand kit* as
distinct routes, which is a cleaner conceptual split than folding both into one page.

`lossless-changelog` contributes the **foundations vs components** vocabulary, which neither of the
other two names explicitly and which is worth carrying over.

Also worth noting: `fullstack-vc` documents a third token category, **effect tokens (`--fx-*`)**,
beyond colour and type. If the token system is being nailed down (Q3), effects are a category that
already exists in practice and should be decided on rather than discovered later.

**A find worth flagging back to the modes question:** `packages/ui/theme-mode/` already contains
`ModeToggle.astro`, `theme-switcher.js`, and `mode-switcher.js`. So the *switching plumbing* exists
as a shared package, and no site consumes it. Combined with `@knots/tokens` being the only place with
mode blocks, the picture is consistent: the three-mode system has been built in pieces, in packages,
and never wired into a site. This site could be the first to actually connect them.

### The component library is a pattern catalog, not a dependency

**Clarified 2026-08-23.** Development of `@knots/*` as *true packages in the dependency sense* was
stopped. They are **example patterns and starter code** — things a site copies from, not things a
site installs.

This dissolves the question I was about to ask. "How do sites consume `@knots/ui` when they are not
workspace members and each is its own repo?" is malformed under this model: they do not consume it,
they copy out of it. The distribution problem that forced the Q3 decision simply does not arise for
components.

**It also makes the token decision coherent rather than inconsistent.** Tokens get a shared runtime
URL while components get copied — and that split follows from what the artifacts are. CSS custom
properties can be shared over a URL with no build coupling whatsoever; components cannot, since they
need to participate in a build. So: **tokens are linked, components are copied.** One rule, derived,
not two arbitrary ones.

**The tradeoff, named so it stays a decision.** Copied code diverges. A fix to a pattern does not
propagate to the sites that already copied it, there is no upgrade path, and after a year the same
component exists in six subtly different forms. That is the price of each site being independently
deployable and free to diverge — a reasonable trade for this family, and the reason the catalog has
to be *good*: when copying is the distribution mechanism, the quality of what gets copied is the
whole game.

**This raises the stakes on live rendering.** If the design-system page is the thing people and
agents copy from, it is not documentation *about* a library — it **is** the library. A page rendering
live components cannot lie about what they do; a page of static specimens can drift silently into
being a catalog of code that no longer exists. `fullstack-vc` gets this right.

**Still open**

- **What earns a place in the catalog?** Without a rule, either everything drifts in or nothing does.
- **Astro or Svelte, or both?** The split bounds what the catalog can contain and how portable a copy
  is.
- **Does a copied pattern record where it came from?** A comment noting the source pattern and date
  is nearly free and makes later reconciliation possible instead of archaeological.

### API documentation

If an API exists — still gated behind Q5 — the documentation should be **generated from the same
schema that validates requests**, not hand-written alongside it. With Zod plus `@hono/zod-openapi`,
one definition produces validation, types, tests, and an OpenAPI document. Hand-maintained API docs
drift within weeks; generated ones cannot.

If Q5 resolves to "defer," this reduces to documenting the content interface the site codes against,
which is worth doing anyway as the seam's specification.

## Related

- [[Opening-Strategy-Questions-for-Architecture-and-Stack]] — what gets built.
- [[Surface-Inventory-and-Open-Product-Questions]] — the surfaces the slices come from.
- [[2026-08-03_Rebuild-Keep-Drop-Ledger]] — where green-per-phase was locked, at
  `lossless-monorepo/site/context-v/decisions/`.
