import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import { cacheVercel } from '@astrojs/vercel/cache';
import svelte from '@astrojs/svelte';

// The canonical origin. Every og:* URL is built absolute from this — unfurlers
// (iMessage, WhatsApp, Slack) will not resolve relative image paths. The
// custom domain is the default; SITE_URL overrides it (a preview, a move).
// The old value, lossless-toolkit.vercel.app, never existed: the project's
// generated host is lossless-toolkit-site.vercel.app.
export const SITE = process.env.SITE_URL ?? 'https://toolkit.lossless.group';

// Server output: pages render on demand from the live corpus (src/lib/corpus.ts),
// so a push to lossless-content reaches the site with no rebuild.
//
// Rendered pages sit on Vercel's CDN under one tag, `content`, and are purged
// on push via the org webhook → lossless-hook-relay → /api/content-hook. One
// tag rather than per-page tags because nearly every page lists or counts the
// whole corpus: a new tool changes the home page, its tag pages, and the
// explorer payload alike. maxAge (5 min) is the safety net for a missed
// delivery; GitHub does not retry.
//
// The sitemap is an endpoint (src/pages/sitemap-*.xml.ts) rather than
// @astrojs/sitemap, which only lists prerendered routes. Its old filter rules
// (no /client/, no non-HTML routes) live there now.
export default defineConfig({
  site: SITE,
  output: 'server',
  adapter: vercel(),
  integrations: [svelte()],
  cache: { provider: cacheVercel() },
  routeRules: {
    '/[...path]': { maxAge: 300, swr: 86400, tags: ['content'] },
  },
  build: { format: 'directory' },
  markdown: { shikiConfig: { theme: 'github-dark' } },
});
