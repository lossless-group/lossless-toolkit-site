import { getViteConfig } from "astro/config";

/**
 * Astro builds on Vite, so Vitest reuses the site's own resolution rather than
 * standing up a second toolchain. The tests here are pure — they exercise the
 * normalisation kernel, not rendering — so no browser or server is involved.
 */
export default getViteConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
