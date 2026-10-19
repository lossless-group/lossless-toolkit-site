import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

// The canonical origin. Every og:* URL is built absolute from this — unfurlers
// (iMessage, WhatsApp, Slack) will not resolve relative image paths. The
// custom domain is the default; SITE_URL overrides it (a preview, a move).
// The old value, lossless-toolkit.vercel.app, never existed: the project's
// generated host is lossless-toolkit-site.vercel.app.
export const SITE = process.env.SITE_URL ?? 'https://toolkit.lossless.group';

export default defineConfig({
  site: SITE,
  output: 'static',
  integrations: [
    svelte(),
    sitemap({
      // House filter: keep non-HTML routes out of the search index.
      // `/client/` is excluded for a different reason — those are per-client
      // portals carrying `noindex, nofollow`, and listing them in the sitemap
      // would be an open invitation to the exact indexing we are avoiding.
      filter: (page) =>
        !page.includes('/llms.txt') && !page.includes('/robots.txt') && !page.includes('/404') && !page.includes('/client/'),
    }),
  ],
  build: { format: 'directory' },
  markdown: { shikiConfig: { theme: 'github-dark' } },
});
