---
title: "Security Overkill for Avoiding Brand Rank"
date_created: 2026-09-13
date_modified: 2026-09-13
authors:
  - Michael P. Staton
augmented_with:
  - Claude Code on Claude Opus 5 (1M context)
semantic_version: 0.0.0.1
tags:
  - Reminder
  - Client-Surfaces
  - SEO
  - Scope-Discipline
status: Active
---

# Security Overkill for Avoiding Brand Rank

**The threat model is one sentence: somebody in marketing at a client company
finds our page on the third page of search results for their own brand, and it
starts an awkward conversation their colleague never briefed them on.**

That is the whole thing. We are not trying to pass a security audit. There is no
adversary. Every client is a friend; the risk is *ambient discoverability*, not
attack.

## The proportionate answer

`noindex, nofollow` · out of the sitemap · no client name in rendered text · no
public path in except a link they were sent. **Unlisted, not protected.** That
meets the actual goal at roughly zero cost.

Gating comes later if it is ever wanted, and it is a real project — an adapter,
`output: 'server'`, middleware, and `prerender = false` on every protected route.
Do not smuggle it in as "while we're here".

## Why this needs writing down

Because we do context engineering, the rules are already loaded before the ask
arrives — house skills, blueprints, reminders, and hard-stop rules in the
codebase itself. They are good rules. They were written for real failures. **They
were also calibrated for a threat model that may not be the one in front of you.**

When a loaded rule meets a request it was not written for, the failure mode is
not ignoring the rule. It is *escalating*: treating the collision as a security
finding, following it outward, and producing an audit nobody asked for while the
actual task sits unbuilt.

## What to do at the collision

1. Name the collision in **one sentence**. Not a section, not a table.
2. State the minimum that satisfies the **stated** goal.
3. Build that.
4. Park everything else in `context-v/` and move on.

If the collision is genuinely load-bearing — someone will get hurt, money will be
lost, a credential will leak — say so once, plainly, and keep going. Say it once.

## The incident this came from

2026-09-13. The ask was one per-client page, filtered by `for_clients`. Loaded
rules made it look like a security problem: the field is stripped at parse and
asserted against every built byte; the astro-knots skill carries a hard-stop on
prerendered gated routes. Both are good rules.

What followed was a threat-model expansion — repo visibility, indexed source,
OAuth patterns across sibling projects, CDN prerender bypass — none of it
requested, all of it delaying the one page. It ended with the operator typing
**SHUT UP**, which was the correct review.

The page, once actually built, was small: filter by tag, `noindex`, drop it from
the sitemap, keep the client's real name out of the markup.

## Related

- `src/lib/client-tags.ts` — the single reader of `for_clients`, returns paths not names
- `src/pages/client/[slug].astro` — the portal, unlisted rather than gated
