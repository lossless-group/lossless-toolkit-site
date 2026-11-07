// The sitemap index robots.txt points at. One child sitemap: ~2,600 URLs is far
// under the 50,000-per-file limit.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${new URL('/sitemap-0.xml', site).href}</loc></sitemap>
</sitemapindex>
`,
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
