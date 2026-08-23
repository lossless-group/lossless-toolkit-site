/**
 * Share metadata. The primary distribution channel for this site is one person
 * texting one link to one executive, so the unfurl card IS the product surface
 * until someone taps through.
 *
 * Deliberate rule: **og:image is always a Lossless-owned asset**, never the
 * vendor's `og_image`. Vendor images are used for on-page display only. Two
 * reasons, both from the house `open-graph-share-seo-geo` skill:
 *
 *   1. `og:image:type` must match the bytes actually served. Vendor URLs in this
 *      corpus include `.avif`, content-negotiating CDNs, and one stringified
 *      empty array — we cannot assert a type for them truthfully.
 *   2. The sextet requires width and height, and an unfurler that is lied to
 *      about dimensions renders a broken card. We do not know the vendor's.
 *
 * So the card is ours: 1200x630, JPEG, dimensions known because we made it.
 */

export const SITE_ORIGIN = 'https://lossless-toolkit.vercel.app';

export interface OgImage {
  url: string;
  type: string;
  width: number;
  height: number;
  alt: string;
}

const slugifyCategory = (c: string) =>
  c
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Cards that exist in `public/og/`. Anything else falls back to the generic. */
const CATEGORY_CARDS = new Set([
  'ai-toolkit',
  'software-development',
  'enterprise-jobs-to-be-done',
  'productivity',
  'data-utilities',
  'creative',
  'hardware',
  'training',
  'products',
  'web-browsers',
  'verticals',
  'tags',
]);

export function cardFor(category: string | undefined, alt: string): OgImage {
  const key = category ? slugifyCategory(category) : '';
  const file = CATEGORY_CARDS.has(key) ? `${key}.jpg` : 'toolkit-card.jpg';
  return {
    url: abs(`/og/${file}`),
    type: 'image/jpeg',
    width: 1200,
    height: 630,
    alt,
  };
}

export function abs(pathname: string): string {
  return new URL(pathname, SITE_ORIGIN).href;
}

/** Canonical URL: always absolute, always trailing-slash-normalised. */
export function canonical(pathname: string): string {
  const p = pathname.endsWith('/') || pathname.includes('.') ? pathname : `${pathname}/`;
  return abs(p);
}

export function clamp(text: string, max = 160): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
