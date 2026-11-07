// Every public page, from the live corpus. Replaces @astrojs/sitemap, which only
// sees prerendered routes. Same filter as before: non-HTML routes and 404 stay
// out, and so does `/client/` — those portals carry `noindex, nofollow`, and
// listing them here would invite the exact indexing they avoid.
import type { APIRoute } from 'astro';
import { listTools, listTags, listVerticals } from '../lib/content-api';

const STATIC = ['/', '/toolkit/', '/tags/', '/verticals/', '/repositories/', '/curious-clients/'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = ({ site }) => {
  const paths = [
    ...STATIC,
    ...listTools().map((t) => `/toolkit/${t.slug}/`),
    ...listTags().map((t) => `/tags/${t.slug}/`),
    ...listVerticals().map((v) => `/verticals/${v.slug}/`),
  ];
  const urls = [...new Set(paths)].map((p) => `  <url><loc>${esc(new URL(p, site).href)}</loc></url>`);
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
};
