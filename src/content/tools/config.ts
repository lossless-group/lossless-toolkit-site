import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * The `tools` collection — schema colocated with the content it governs.
 *
 * THIS SCHEMA DOES NOT ENFORCE ANYTHING. It is documentation and typing.
 * Every field is optional, every field has a `.catch()` so a bad value yields
 * a fallback instead of throwing, and unknown keys pass through untouched.
 * There is exactly one real rule in this corpus — `publish: false` means the
 * page does not render — and it is applied at ingest, not here.
 *
 * The baseline for every entry is its FILENAME. Astro gives each entry an `id`
 * derived from its path, which is enough on its own to produce a title, a slug
 * and a URL. Frontmatter is an enhancement layered on top of that baseline,
 * never a prerequisite for it: a zero-byte markdown file is a valid page.
 * `src/content/tools/empty-tool-test.md` is exactly that, kept as a fixture so
 * the guarantee is exercised by every build.
 *
 * Note what is ABSENT: there is no `for_clients` field, and no way to add one,
 * because `scripts/ingest-content.mjs` consumes and discards that array at the
 * boundary. The no-emit rule is enforced by the shape of the data, not by
 * remembering to leave it out of a dozen templates.
 */
const str = () => z.string().optional().catch(undefined).default("");
const strList = () => z.array(z.string()).optional().catch([]).default([]);

export const toolsSchema = z
  .object({
    title: str(),
    slug: str(),
    description: str(),
    url: str(),
    og_image: str(),
    favicon: str(),
    section: str(),
    tags: strList(),
    /** Derived from `for_clients` at ingest. Carries no client name. */
    field_tested: z.boolean().optional().catch(false).default(false),
    date_modified: str(),
    date_created: str(),
  })
  // Unknown keys pass through rather than being rejected. A property this
  // schema has never heard of must not cost us the document.
  .passthrough();

export const tools = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/tools" }),
  schema: toolsSchema,
});
