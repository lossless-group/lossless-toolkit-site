import type { APIRoute } from 'astro';
import { allTools, projectForClient, listTags } from '../../../lib/content-api';
import { toolPathsForClient } from '../../../lib/client-tags';
import clientsData from '../../../data/clients.json';

/**
 * One scoped catalogue per client, so the portal's Explorer filters that
 * engagement's tools rather than all 1,915.
 *
 * Why a per-client file instead of reusing /api/tools.json and narrowing in the
 * browser: the full projection is ~1 MB, and a portal listing fourteen tools has
 * no business shipping the whole corpus to show them. The facet counts also have
 * to be computed against the subset — see listTags(minCount, tools).
 *
 * On exposure: this is the same list the portal page already renders as HTML, in
 * the same shape, so it reveals nothing the page does not. `for_clients` itself
 * still never appears — client-tags returns tool slugs, and the projection is an
 * explicit allowlist. The sitemap filter in astro.config.mjs excludes anything
 * containing `/client/`, which covers this path too.
 *
 * Prerendered: one static file per client, no server.
 */
export const prerender = true;

export function getStaticPaths() {
  return clientsData.clients.map((c) => ({ params: { slug: c.id } }));
}

export const GET: APIRoute = ({ params }) => {
  const paths = toolPathsForClient(String(params.slug));
  const tools = allTools()
    .filter((t) => paths.has(t.sourcePath))
    .sort((a, b) => b.depth - a.depth);

  return new Response(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      tools: projectForClient(tools),
      tags: listTags(1, tools).map(({ tag, slug, label, count }) => ({ tag, slug, label, count })),
    }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=300, stale-while-revalidate=86400',
      },
    }
  );
};
