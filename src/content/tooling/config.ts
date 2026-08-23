import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * The `tooling` collection config, colocated with the content it governs
 * rather than buried in a root mega-config.
 *
 * READ THIS BEFORE ADDING A REQUIRED FIELD: the schema below is DOCUMENTATION
 * AND TYPING, not enforcement. Every field is `.optional()` and wrapped in
 * `.catch()`, so a malformed value yields a fallback instead of throwing.
 * `.passthrough()` keeps keys we did not anticipate rather than stripping them.
 *
 * The one real rule is `publish: false` → the page does not render, and that is
 * enforced in `src/lib/content-api.ts`, not here. Normalization (title
 * precedence, slug derivation, image fallback, the `for_clients` strip) also
 * lives there. This file only describes the shape.
 *
 * Measured variance across the 1,764 upstream files, which is why nothing is
 * required: title 1232, site_name 970, og_title 821, og_site_name 92, url 1669,
 * og_image 1277 (6 of which are the literal string "[]"), slug 468, publish 443,
 * tags 1703 — split 895 inline-flow / 810 block-list. An empty file with only a
 * filename is a legitimate entry and must still render.
 */
const looseString = z.string().optional().catch(undefined);
const looseStrings = z.array(z.string()).optional().catch([]);

export const toolingSchema = z
  .object({
    // the only field with any teeth, and only when it is exactly `false`
    publish: z.boolean().optional().catch(undefined),

    // title-ish, in precedence order — see content-api.ts
    title: looseString,
    og_title: looseString,
    site_name: looseString,
    og_site_name: looseString,

    slug: looseString,
    url: looseString,
    site_url: looseString,

    tags: looseStrings,

    // description-ish, in precedence order
    zinger: looseString,
    og_description: looseString,
    description_site_cp: looseString,
    description: looseString,

    og_image: looseString,
    og_favicon: looseString,

    // NOTE: `for_clients` is deliberately absent. It exists in the source files
    // and is a valid INPUT, but it is dropped at the parse boundary and must
    // never appear in output. Do not add it here.
  })
  .passthrough();

export const tooling = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tooling' }),
  schema: toolingSchema,
});
