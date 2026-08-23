import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { toolingSchema } from '../tooling/config';

/**
 * The `vertical-toolkits` collection. Same shape as `tooling` — these are tool
 * entries grouped by industry rather than by capability — with one extra
 * hazard worth recording: files here routinely carry TWO stacked frontmatter
 * blocks, e.g. a `date_created`/`date_modified` pair followed by a second block
 * with the OpenGraph enrichment. The lenient parser in `src/lib/frontmatter.ts`
 * merges both, later block winning; a strict parser sees the second `---` as
 * the end of frontmatter and treats the rest as body.
 *
 * Same rule as the sibling: this is documentation and typing, not enforcement.
 */
export const verticalToolkits = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/vertical-toolkits' }),
  schema: toolingSchema,
});
