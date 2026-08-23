/**
 * Thin by design. Schemas live next to the content they govern —
 * `src/content/<collection>/config.ts` — so that working on a collection means
 * touching that collection's folder, and the schema is discoverable from the
 * directory rather than by scrolling a mega-config.
 *
 * A deliberate divergence from the sibling Astro Knots sites, which each carry
 * one large content.config.ts. Noted in VARIANT-NOTES.md.
 */
import { tools } from "./content/tools/config";
import { verticals } from "./content/verticals/config";

export const collections = { tools, verticals };
