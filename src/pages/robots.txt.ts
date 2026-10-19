// robots.txt, built so the Sitemap line follows `site` instead of hardcoding
// an origin (it pointed at a host that 404s until this moved here).
import type { APIRoute } from 'astro';

const RULES = `User-agent: *
Allow: /

# Answer engines are opted in deliberately — the default posture is that they
# are not, and being cited requires saying so.
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /`;

export const GET: APIRoute = ({ site }) =>
  new Response(`${RULES}\n\nSitemap: ${new URL('/sitemap-index.xml', site).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
