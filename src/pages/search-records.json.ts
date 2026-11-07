// The Pagefind corpus, prerendered at build from the vendored baseline.
//
// Pages render on demand now, so there is no built HTML for Pagefind to crawl.
// This endpoint hands `scripts/build-search-index.mjs` the same records instead:
// one per tool, tag and vertical page, with the tag filter the tool page used
// to carry in `data-pagefind-filter`. Client portals are left out: they are
// unlisted, and search is a listing.
//
// Search therefore reflects the corpus as of the last deploy, while pages
// reflect it as of the last push. Re-vendor and redeploy to catch it up.
import type { APIRoute } from 'astro';
import { listTools, listTags, listVerticals } from '../lib/content-api';

export const prerender = true;

const plain = (md: string) =>
  md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const GET: APIRoute = () => {
  const records = [
    ...listTools().map((t) => ({
      url: `/toolkit/${t.slug}/`,
      content: [t.title, t.summary, plain(t.body)].join('. '),
      meta: { title: t.title },
      filters: { tag: t.tags },
    })),
    ...listTags().map((f) => ({
      url: `/tags/${f.slug}/`,
      content: `${f.label} tools. ${listTools({ tag: f.tag }).map((t) => t.title).join(', ')}`,
      meta: { title: `${f.label} tools` },
    })),
    ...listVerticals().map((v) => ({
      url: `/verticals/${v.slug}/`,
      content: `${v.title}. ${v.summary} ${v.entries.map((e) => e.title).join(', ')}`,
      meta: { title: `${v.title} toolkit` },
    })),
  ];
  return new Response(JSON.stringify(records), { headers: { 'content-type': 'application/json' } });
};
