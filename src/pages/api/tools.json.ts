import type { APIRoute } from 'astro';
import { projectForClient, listTags } from '../../lib/content-api';

/**
 * The client projection, served as one static JSON file.
 *
 * It started life inlined into every page that mounts the Explorer, which was
 * correct and also produced a 59 MB `dist/` — 255 tag pages each carrying a
 * full copy of the catalogue. Hoisting it to a single URL means the browser
 * fetches it once and then has it cached across every page that needs it.
 *
 * It is also the honest shape of the boundary: this is exactly the response a
 * shared Lossless content service would return, so the day that service exists,
 * the island changes one URL and nothing else.
 *
 * Prerendered to a static file — no server required.
 */
export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      tools: projectForClient(),
      tags: listTags().map(({ tag, slug, label, count }) => ({ tag, slug, label, count })),
    }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=300, stale-while-revalidate=86400',
      },
    }
  );
