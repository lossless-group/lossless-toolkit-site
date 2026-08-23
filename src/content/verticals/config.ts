import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { toolsSchema } from "../tools/config";

/**
 * The `verticals` collection — toolkits assembled around an industry rather
 * than a capability. Same non-enforcing posture as the tools schema.
 *
 * It reuses that shape today because the ingest script emits one normalised
 * form for both. It is defined separately, next to its own content, so that
 * the moment a vertical needs a field a tool does not have (a sector code, an
 * ordered tool manifest), it gets one here without anyone reopening the tools
 * schema.
 */
export const verticalsSchema = toolsSchema;

export const verticals = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/verticals" }),
  schema: verticalsSchema,
});
