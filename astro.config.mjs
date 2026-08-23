// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

/**
 * Variant A — "materialize everything, zero JS".
 *
 * `output: "static"` is the whole thesis: every route in this site is a file
 * on disk before a reader ever asks for it. There is no adapter, no server,
 * no runtime. A CDN with no origin behind it can serve the entire product.
 */
export default defineConfig({
  site: "https://lossless-toolkit.pages.dev",
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [
    sitemap({
      // House filter: keep non-HTML routes out of the search index.
      filter: (page) => !/\/(llms\.txt|llms-full\.txt|404)\/?$/.test(page),
    }),
  ],
  markdown: {
    shikiConfig: { theme: "css-variables" },
  },
  devToolbar: { enabled: false },
});
