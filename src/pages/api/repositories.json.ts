import type { APIRoute } from 'astro';
import { listRepos, projectForClient, listTags } from '../../lib/content-api';

/**
 * The repo subset, scoped for the Explorer on /repositories/.
 *
 * `withRepo` opts this projection into the two repo fields. They are the reason
 * the page exists — a filtered repo list that dropped the source link would be a
 * worse version of /toolkit/ — and both are already-public URLs printed on the
 * page today, so the allowlist stays a deliberate list rather than a leak.
 *
 * Facets are computed against the repo subset, not the corpus, so a count here
 * describes the tools actually reachable on this page.
 */
export const prerender = true;

export const GET: APIRoute = () => {
  const repos = listRepos().sort((a, b) => b.depth - a.depth);
  return new Response(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      tools: projectForClient(repos, { withRepo: true }),
      tags: listTags(1, repos).map(({ tag, slug, label, count }) => ({ tag, slug, label, count })),
    }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=300, stale-while-revalidate=86400',
      },
    }
  );
};
