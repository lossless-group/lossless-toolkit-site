# lossless-toolkit-site

Astro site for the Lossless Toolkit — a rebuild of the `/toolkit` surface currently served by
[lossless-site](https://github.com/lossless-group/lossless-site).

## Why this exists

The toolkit surface at <https://lossless.group/toolkit> accumulated bloat, unideal UI, and
performance problems that are cheaper to correct in a focused rebuild than to unwind in place.

This is one stage of a **multistage refactor of `lossless-site`**, in which distinct surfaces are
extracted into their own Astro Knots sites. [`lossless-changelog`](https://github.com/lossless-group/lossless-changelog)
was the first stage; the toolkit is the next.

## Status

**Scaffold.** Architecture is still under discussion — specifically how far this site should follow
established `astro-knots` and `lossless-site` patterns versus deliberately diverging from them.
Nothing here is settled until that lands as a spec in `astro-knots/context-v/specs/`.

## Place in the tree

A submodule of [`astro-knots`](https://github.com/lossless-group/astro-knots) at
`sites/lossless-toolkit-site`. Sites are not pnpm workspace members — this site installs and
builds on its own.

## Conventions

Built under the Astro Knots conventions: Astro first, HTML and CSS before JavaScript, Svelte only
where reactivity genuinely earns it, and no React or JSX. Content is authored in Lossless Flavored
Markdown.
