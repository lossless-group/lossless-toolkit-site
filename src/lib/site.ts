export const SITE = {
  origin: "https://lossless-toolkit.pages.dev",
  name: "The Lossless Toolkit",
  short: "Lossless Toolkit",
  tagline: "A catalogue of the tools we actually reach for.",
  description:
    "The Lossless Toolkit is a browsable catalogue of software, services and hardware, organised by capability tag and by vertical. Every view is a real URL, prerendered at build time.",
  twitter: "@losslessgroup",
  /** OG fallback family. Deterministically assigned, never random. */
  ogFallbackCount: 6,
} as const;

/** OpenGraph and canonical URLs must be absolute. No exceptions, no relatives. */
export function abs(pathname: string): string {
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return new URL(pathname, SITE.origin + "/").href;
}

/**
 * ~28% of the corpus has no `og_image`, and a handful carry a stringified
 * empty array. A link with no preview image is, for our primary distribution
 * channel, a broken product — so every page resolves to SOMETHING.
 *
 * The fallback is chosen by a stable hash of the slug, so a given tool always
 * unfurls with the same card and the unfurler's per-URL cache stays coherent.
 */
export function ogImageFor(slug: string, declared?: string): string {
  const d = (declared ?? "").trim();
  const unusable = !d || d === "[]" || d === "{}" || d === "undefined" || !/^https?:\/\//i.test(d);
  if (!unusable) return d;
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = (Math.abs(h) % SITE.ogFallbackCount) + 1;
  return abs(`/og/fallback-${n}.jpg`);
}

/** Tag slugs are URLs; they must round-trip and never collide with each other. */
export function tagSlug(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A CSS-safe token for the `:has()` facet filter (must be a valid ident). */
export function facetToken(tag: string): string {
  return tagSlug(tag);
}

export function excerpt(md: string, max = 200): string {
  const cleaned = md
    .replace(/^---[\s\S]*?---/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+.*$/gm, " ")
    .replace(/[*_`>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\-]$/, "") + "…";
}
