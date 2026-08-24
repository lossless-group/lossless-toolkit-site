# Review notes: unreviewed `lfm` changes staged on disk

**Status: STAGED, NOT COMMITTED, NOT PUSHED.** Nothing has landed anywhere.

**Location:** `/home/mps/code/lossless-monorepo/lfm`, branch `main`, tracking `origin/main`, working tree clean of commits (`main...origin/main`, 0 ahead).

This file exists so the staged diff can be reviewed without reconstructing
anyone's reasoning. It is a review note tied to one unreviewed changeset, not a
durable document — delete it once the prototype is accepted or discarded. It is
not part of the spike deliverable, which is why it sits on a docs branch rather
than on `spike/variant-a`.

## Scope warning, stated plainly

The brief for this session was a **self-contained creative spike** in
`lossless-toolkit-site`. The work described below is in `lfm` — a **shared,
published library** (`@lossless-group/lfm`, JSR + GitHub Packages) consumed by
several sites. That is a materially different kind of change from a spike, and
it should be reviewed as such.

It includes a **version bump 0.5.1 → 0.6.0** (`package.json`, `deno.json`).
That bump is staged. Reverting it is a two-line change.

Nothing in the staged diff is required for either variant to build or run.
Both variants currently render wikilinks as literal `[[...]]` and neither
consumes this code.

## How to discard, if that is the call

```bash
cd /home/mps/code/lossless-monorepo/lfm
git reset --hard HEAD && git clean -fd src/utils/resolve-path.ts \
  test/resolve-path.test.mjs changelog/2026-08-23_01.md \
  context-v/Maintain-Path-Resolution-for-Wikilinks.md
```

## What the change does

`remarkLfmWikilinks` already required each site to supply a `resolver`
function. This adds `createPathResolver(config)` — a way to express that
resolver as **configuration data** instead of hand-written `if/startsWith`
branches — and lets `wikilinks` accept it via a new `paths` option.

The existing `resolver` option is unchanged and still takes precedence when
both are supplied. **The change is additive; no existing behaviour changes.**

Resolution walks a configurable cascade of index tiers:

| Tier | Matches |
|---|---|
| `exact` | the normalised path is a vault file, verbatim |
| `suffix` | the path is a trailing run of segments of exactly one file |
| `basename` | the final segment names exactly one file |
| `route` | nothing in the index — fall through to prefix rules |

A tier matching more than one file stops and resolves to nothing, so the
wikilink renders as plain text rather than a possibly-wrong link.

## The 12 staged files

**New (4):**

| File | Lines | What |
|---|---|---|
| `src/utils/resolve-path.ts` | +806 | The resolver. All new code. ~45% is doc comment. |
| `test/resolve-path.test.mjs` | +370 | 39 assertions. |
| `changelog/2026-08-23_01.md` | +123 | Release note. |
| `context-v/Maintain-Path-Resolution-for-Wikilinks.md` | +99 | Design record. |

**Modified (8):**

| File | Lines | What |
|---|---|---|
| `src/plugins/remark-lfm-wikilinks.ts` | +36/-11 | Adds `selectResolver()`; accepts `paths` as an alternative to `resolver`. Error message reworded. Existing resolution path untouched. |
| `src/types/index.ts` | +38 | `WikilinkOptions.resolver` becomes optional; adds `paths`. **Note: `resolver` going from required to optional is a type-level relaxation — it cannot break an existing caller, but it is a public-API shape change.** |
| `src/index.ts` | +27 | Barrel exports for the new symbols and types. |
| `README.md` | +120 | New "Path resolution" section. Docs only. |
| `package.json` | +6/-2 | Version 0.5.1 → 0.6.0; adds `./resolve-path` export. |
| `deno.json` | +3/-1 | Same, for JSR. |
| `tsup.config.ts` | +1 | Registers the new entry. |
| `test/helpers.mjs` | +4/-2 | Re-exports `createPathResolver` for tests. |

Total: **+1,622 / -11 across 12 files.**

## Verification performed

- `pnpm build` — clean
- `tsc --noEmit` — clean
- `pnpm test` — **221/221 pass** (182 pre-existing + 39 new); no pre-existing test changed

## Claims that need independent checking

The measurements below were produced by throwaway scripts in a scratchpad
directory, against `/home/mps/code/lossless-monorepo/content` (read-only). They
were **not** independently reviewed, and the scripts are not committed. Treat
them as unverified until someone re-runs them.

- 4,702 markdown files in the vault; 13,846 wikilinks written against them
- 28% of wikilinks have no folder segment (`[[DevOps]]`)
- 98.4% of basenames are globally unique; 73 basenames collide (153 files)
- Resolution of the full corpus: ~70ms total, ~5µs per link, ~13ms one-time index build
- With four example routes and no catch-all: ~79% of wikilinks resolve

The performance figures are the load-bearing ones — they are the argument that
this belongs in the build rather than behind a queue. Worth re-running before
relying on them.

## Open items deliberately not done

- Neither variant is wired to this. Doing so was declined pending review.
- No commit, no push, no publish to JSR or GitHub Packages.
