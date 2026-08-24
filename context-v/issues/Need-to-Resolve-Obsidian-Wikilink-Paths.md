---
title: "Need to Resolve Obsidian Wikilink Paths"
lede: "Every tool page in both rebuild variants renders `[[Vocabulary/Build Systems|Build System]]` as literal text. The corpus is densely cross-linked and none of it survives to the reader — a quarter of it cannot survive without an index."
date_created: 2026-08-23
date_modified: 2026-08-23
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5 (1M context)
semantic_version: 0.0.0.1
tags:
  - Issue
  - Wikilinks
  - Extended-Markdown
  - Content-Pipeline
  - Obsidian
status: Open
---

# Need to Resolve Obsidian Wikilink Paths

The Lossless corpus is written in Obsidian and it is densely cross-linked — 13,846 wikilinks across 4,702 markdown files. On the rebuilt toolkit those links currently reach the reader as raw syntax: `[[Vocabulary/Build Systems|Build System]]`, printed literally in the middle of a sentence. Both rebuild variants do this, identically, because neither has configured wikilink resolution. Nothing is broken in the sense of throwing; the pipeline simply passes the syntax through untouched.

This matters more than a cosmetic defect. The cross-links *are* the value of an Obsidian vault — they are how a tool page reaches the concept that explains it. A rebuild that drops them ships the corpus with its connective tissue removed.

## Symptom

Observed on both variant preview servers, on the same page:

```
$ curl -s http://localhost:4321/tools/bazel/ | grep -oE '\[\[[^]]*\]\]'
[[Vocabulary/Build Systems|Build System]]
[[concepts/Explainers for AI/Large Codebase AI|Large Codebase AI]]
[[Vocabulary/Software Engineering Management|Software Engineering Management]]
[[organizations/Google|Google]]
[[Tooling/Software Development/Programming Languages/Python|Python]]
[[Vocabulary/Monorepo|Monorepos]]
```

Port 4322 (Variant B) returns byte-identical output. The rendered page shows the bracket syntax as prose.

## Environment

- `lossless-toolkit-site`, branches `spike/variant-a` and `spike/variant-b`
- Astro 5.16 / 5.18, both `output: "static"`
- `@lossless-group/lfm` 0.5.1 — **not currently a dependency of either variant**
- Source corpus: `lossless-monorepo/content` (read-only during the spike)

## Hypothesis log

### H1 — LFM is wired but misconfigured

**Reasoning:** LFM ships `remarkLfmWikilinks`; maybe it is on and failing.
**Test:** Check each variant's `package.json` and Astro markdown config.
**Result:** ❌
**Learned:** Neither variant depends on LFM at all. Both render through Astro's stock markdown pipeline, which has no concept of `[[...]]`. This is not a misconfiguration, it is an absence.

### H2 — Wiring LFM's wikilink plugin is sufficient

**Reasoning:** The plugin exists; turn it on.
**Test:** Read `src/plugins/remark-lfm-wikilinks.ts`.
**Result:** ❌ — necessary but not sufficient.
**Learned:** The plugin deliberately owns *syntax only* and throws unless the consumer supplies a `resolver` function. Destinations are per-site by design. So "turn on the plugin" is not a task; "decide where every vault path goes" is the task, and it has to be answered per site.

### H3 — A prefix-matching resolver covers the corpus

**Reasoning:** The README's worked example is a `PREFIX_RULES` array — match on `tooling/`, `vocabulary/`, etc. That is what the other sites in the family do.
**Test:** Extract all wikilink paths from the corpus and measure how many carry a resolvable prefix.
**Result:** ❌ for a large minority.
**Learned:** **3,839 of 13,846 wikilinks — 28% — have no folder segment at all.** They are bare: `[[DevOps]]`, `[[Bazel]]`. Obsidian resolves these by shortest-unique-path against the vault; a prefix matcher cannot see them by construction. Every hand-written resolver in the family fails that quarter of the corpus, and fails it *invisibly*, because an unresolved wikilink renders as ordinary prose rather than as an error.

### H4 — Bare names can be resolved by basename against a vault index

**Reasoning:** If basenames are near-unique, the last segment is enough.
**Test:** Build a basename index over all 4,702 files and count collisions.
**Result:** ✅ with a caveat.
**Learned:** 4,622 of 4,702 basenames are globally unique — **98.4%**. Only 73 basenames collide (153 files), and only **25 of 3,839 bare wikilinks (0.7%)** actually land on a collision. So basename resolution is safe far more often than it is dangerous — but the dangerous case must resolve to *nothing* rather than to a guess.

### H5 — Path drift will defeat exact matching

**Reasoning:** The vault has been reorganised over time.
**Test:** Count case and separator variants of the same directory.
**Result:** ✅ — confirmed, and it is significant.
**Learned:** `Tooling/` appears 3,591 times against `tooling/` 38 times; `Vocabulary/` 1,526 against `vocabulary/` 22; `lost-in-public/` 179 against `Lost in Public/` 8. Matching must fold case *and* treat space / hyphen / underscore as equivalent, or a few thousand links miss.

Separately: **there are zero literal `../` or `./` wikilinks in the corpus.** Relative-path support is a plausible authoring future, not a present source of breakage. Worth recording so nobody prioritises it off intuition.

## Root cause

Not a bug. **A required piece of per-site configuration that has never been written**, plus a resolution strategy (prefix matching) that is structurally incapable of covering 28% of the corpus even once it is written.

The fix therefore has two halves, and they belong to different repos:

1. **This site** must decide where each vault path family lands. Notably, `concepts/`, `vocabulary/`, `organizations/` and `sources/` are four folders in the vault and a single index on the web (`lossless.group/more-about/`), so the mapping is many-to-one, not one-to-one.
2. **LFM** would need a way to express that as configuration, including an index-backed path for bare names.

## Fix

**Not applied.** No fix has landed in either variant.

A prototype of the LFM half exists on disk — staged and uncommitted in `lossless-monorepo/lfm`, described in `LFM-RESOLVER-REVIEW.md` at this repo's root, and specified as a stub at `lfm/context-v/specs/Support-Obsidian-Wikilink-Relative-Paths-through-Path-Resolver.md`. It is unreviewed and should be treated as a proposal, not a solution. The measurements quoted above came from throwaway scripts that were not committed, and should be re-run before anyone relies on them.

The decision this issue is waiting on is not technical: it is whether wikilink resolution is in scope for the toolkit rebuild at all, or a separate piece of shared-library work that happens on its own schedule.

## Prevention

Open question rather than a resolved one — worth a reminder if the answer lands:

- Should a site that consumes Obsidian-authored content **fail loudly** when wikilinks are unresolved, rather than silently rendering bracket syntax to readers? A build-time count of unresolved links, surfaced as a warning, would have caught this on day one of both variants instead of on a spot-check of one page.

## Related

- [[Surface-Inventory-and-Open-Product-Questions]] — deep linking and share behaviour, which cross-links feed
- [[Opening-Strategy-Questions-for-Architecture-and-Stack]] — the content-source questions this sits under
- `lfm/context-v/specs/Support-Obsidian-Wikilink-Relative-Paths-through-Path-Resolver.md` — the library-side stub
- `LFM-RESOLVER-REVIEW.md` — review notes for the unreviewed prototype
