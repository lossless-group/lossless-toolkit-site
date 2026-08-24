---
title: "Use Spikes to Converge on Spec"
lede: "Two agents built competing toolkit implementations from the same guidance, and what they agreed on unprompted turned out to be worth more than which one won. This is where the next session picks up — starting with a refactor pass over code nobody has reviewed."
date_created: 2026-08-23
date_modified: 2026-08-23
authors:
  - Michael P. Staton
augmented_with:
  - Claude Code on Claude Opus 5 (1M context)
semantic_version: 0.0.0.1
tags:
  - Handoff
  - Toolkit-Rebuild
  - Agent-Workflow
  - Refactoring
status: Open
---

# Use Spikes to Converge on Spec

Two agents were given the same guidance, opposite architectural axes, and about forty minutes. Both
produced a building site. The useful output was not the winner — it was the set of decisions they
reached **independently and identically**, which is much stronger evidence than either variant
arguing for itself.

This document is where the next session starts.

## Start here — two things, before any new feature

### 1. Add the Ponytail agent harness for code refactoring

**Wanted: Ponytail wired in as the refactoring harness for this project.** Evaluate it, wire it, and
point it at the spike code below.

This has not been evaluated yet — it is recorded as intent, not as a decision. What it needs to
answer: how it takes direction, whether it operates per-file or per-symbol, whether its output is
reviewable as a diff, and whether it can be pointed at a named list of smells rather than turned
loose.

### 2. Treat the spike code as unreviewed

**No human has read this code.** It was produced by two agents in forty minutes and then iterated on
live through roughly a dozen bug-fix cycles, several of which were applied by find-and-replace
against a running app. It builds, it is driven by browser tests, and it is almost certainly messy.

Known mess, so a refactor pass has somewhere concrete to start — all in
`spike/variant-b`:

| Where | What |
|---|---|
| `ToolExplorer.svelte` | `currentPath()` is still defined and called once, although the atom now owns path building |
| `ToolExplorer.svelte` | `tagToSlug` duplicates the atom's `slugs` map — two sources for one lookup |
| `toolkit-state.svelte.js` | `pendingSlug` is written and never read. Dead code, added by me |
| `PagefindSearch.svelte` | Stray double-spacing and orphaned statement fragments left by blanket string replacement |
| both variants | `A` and `B` diverged during fixes; they no longer share a baseline |

The bridging between the shared atom and `ToolExplorer`'s local state is the part most worth a
second opinion. It works and it is tested, but it is a mirror rather than single ownership, and
mirrors are where the last three bugs came from.

## The thesis this session was testing

**Build several implementations, then read what they agree on.**

The convergences are the signal. Neither agent was told to do any of these, and both did:

- a real page per tag, with its own share card
- `src/lib/content-api.ts` as the single content boundary — *the same filename*
- two-tier design tokens, three modes, vibrant as dark-based
- a zero-byte-file fixture, to prove an empty document still renders
- `for_clients` absent from all built output

Two independent agents reaching the same filename is not a coincidence worth ignoring. Treat each of
these as close to settled and stop relitigating them.

Where they **diverged** is where the real decision lives — and there, `B` won on evidence rather than
taste: `A` declared `image/jpeg` for 112 pages whose images were not JPEG, and its ingest flattened
vault paths, which is precisely the input a wikilink resolver needs.

## What is settled

Pagefind for search. Timeline stays. OpenPanel for analytics. Vitest plus Playwright. No registry
publish for design tokens — self-hosted CSS instead, because tokens are shareable by URL and
components are not. `for_clients` is curation, not a gate. Staged domains: `vercel.app` first,
`toolkit.lossless.group` when it earns it.

## What is still open

- **The publish cascade.** Still the daily pain: five manual steps to get a typo live.
- **Light and vibrant modes.** No Lossless site has ever implemented modes. This is design work, not
  consolidation — nobody knows what they look like.
- **The tag join.** Two or more tags cannot be prerendered (255 tags = 32,385 pairs) but must stay
  shareable. Pagefind's filters may resolve this; the `all` operator's semantics are unverified.
- **`lfm`** has 1,622 lines staged and committed nowhere, on `main`. One `git submodule update`
  erases it. Park it or discard it — it should not stay in this state.
- **Wikilinks** render as literal `[[...]]` in both variants. Note that resolving them makes the
  client-name leak *worse*, by turning `[[Current Stack|Laerdal Tech Stack]]` into crawlable anchor
  text.

## Where everything is

| | |
|---|---|
| `spike/variant-a` | zero-JS, 531 pages, `35a0268` |
| `spike/variant-b` | islands + shared atom, 443 pages, `56b5c09` |
| `doc/wikilink-path-resolution` | docs only, on this repo and `lfm` |
| Browser drives | `tests/browser-drive.mjs`, `tests/chip-drive.mjs` in each working copy |
| Working copies | `/home/mps/code/lossless-toolkit-site-spike-variant-{a,b}` — outside the monorepo |

**NixOS note:** Playwright's bundled Chromium will not run. Point `executablePath` at
`/run/current-system/sw/bin/brave`.

## The lesson that cost the most

Every defect this session — a component that threw on init and never hydrated, an effect that
clobbered its own input on every keystroke, a search page nothing linked to, a chip that was a
`<span>` inside an `<a>`, an infinite effect loop that blanked a component — **passed `pnpm build`
and passed `curl`.** All were one page load from obvious.

Browser drives are not a polish-pass concern on this project. They are the only rung that sees this
class of defect, and they should exist before the next feature, not after it.

## Related

- [[Opening-Strategy-Questions-for-Architecture-and-Stack]]
- [[Surface-Inventory-and-Open-Product-Questions]]
- [[Build-Loop-and-Verification-Strategy]]
