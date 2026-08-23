import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import sitemap from '@astrojs/sitemap';

// The canonical origin. Every og:* URL is built absolute from this — unfurlers
// (iMessage, WhatsApp, Slack) will not resolve relative image paths.
export const SITE = 'https://lossless-toolkit.vercel.app';

export default defineConfig({
  site: SITE,
  output: 'static',
  integrations: [
    svelte(),
    sitemap({
      // House filter: keep non-HTML routes out of the search index.
      filter: (page) => !page.includes('/llms.txt') && !page.includes('/404'),
    }),
  ],
  build: { format: 'directory' },
  markdown: { shikiConfig: { theme: 'github-dark' } },
});
