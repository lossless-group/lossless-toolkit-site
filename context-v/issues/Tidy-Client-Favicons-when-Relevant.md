---
title: "Tidy Client Favicons when Relevant"
date_created: 2026-09-13
date_modified: 2026-09-13
authors:
  - Michael P. Staton
augmented_with:
  - Claude Code on Claude Opus 5 (1M context)
semantic_version: 0.0.0.1
tags:
  - Issue
  - Client-Surfaces
  - Assets
  - Low-Priority
status: Open
priority: Low
---

# Tidy Client Favicons when Relevant

**Nothing here is mission critical.** The quick-access rail and the client cards
on `/curious-clients/` both degrade cleanly — a missing icon renders as a
monogram tile, never as a broken image. This is a cosmetic backlog to work
through when the mood strikes, not a defect to schedule.

## Current state

Five of eleven render a real mark. Six fall back to a monogram.

| Client | Rail shows | Why |
|---|---|---|
| laerdal | ✅ icon | Derived from the trademark lockup |
| avalanche | ✅ icon | Real SVG |
| flourish | ✅ icon | Real SVG |
| the-water-foundation | ✅ icon | Real SVG |
| obsidian-plugin-community | ✅ icon | Real SVG |
| **param** | `RF` | appIcon is an LFS pointer — **`wordmark__Param-Tech.svg` is real and unused** |
| **hypernova** | `CF` | appIcon is an LFS pointer — **`trademark__Hypernova.svg` is real and unused** |
| tonguc | `BE` | Both candidate assets are LFS pointers |
| colearn | `PL` | LFS pointer |
| reach | `AU` | LFS pointer |
| humain | `LH` | LFS pointer |

## Two kinds of work

**Cheap — no network, no config.** Param and Hypernova already have real vector
trademarks sitting in `lossless-monorepo/site/public/visuals/`, unused. Same
treatment Laerdal got: copy in, point the data at it, and if it is a wide
lockup rather than a square mark, set `logo-shape: wordmark` so the card widens
the slot and puts a light tile behind it. Parslee has a real SVG too, though it
is not on the site yet.

**Needs a decision — Tonguc, Colearn, Reach, Humain.** Their only assets are
git-lfs pointer files and there is no cached object locally. Fixing them means
`git lfs install` in `lossless-monorepo/site` plus a fetch, which changes another
repo's git config. Operator's call, not an agent's.

## Also worth a look while in there

- **Aspect ratios are inconsistent.** Laerdal is a wide lockup cropped to a
  square roundel; the others are native square app icons. They read fine side by
  side, but a wordmark dropped into the rail without `logo-shape: wordmark` will
  render as an illegible smudge at 28px.
- **Monograms come from the stealth name**, so `Beloved Education Brand` yields
  `BE`. That is intentional and quietly better for confidentiality than the real
  mark — worth deciding per client whether the real icon is even wanted.
- **The Avalanche stealth description contains the word "avalanche"**
  ("...in the middle of a market avalanche"), which undoes its own codename. A
  data fix, not an asset fix, but it is in the same file.

## Verification, when you do get to it

Do not trust a `200`. Seven of these assets returned `200` with an
`image/png` content-type while being 130 bytes of ASCII. The rail validates on
disk at build time, so the honest check is whether a monogram or an image
renders — or:

```bash
file public/visuals/<asset>      # "SVG"/"PNG image" good, "ASCII text" is a pointer
```

## Related

- `src/components/ClientPortalQuickAccess.astro` — build-time icon validation, monogram fallback
- `src/data/clients.json` — `app-icon` and `logo-shape` per client
- [[2026-09-13_01]] — the LFS-pointer discovery
