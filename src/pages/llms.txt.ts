import type { APIRoute } from "astro";
import { listTools, listTags, listVerticals } from "../lib/content-api";
import { SITE, abs } from "../lib/site";

export const prerender = true;

/**
 * /llms.txt — a curated markdown index for generative engines.
 *
 * The same publish predicate as the rendered HTML, and the same suppression:
 * because `for_clients` never reaches the content collection, it cannot reach
 * this file either. That matters — feeding the client-name association to a
 * model would defeat the SEO carve-out we enforce in HTML.
 */
export const GET: APIRoute = async () => {
  const tools = await listTools();
  const tags = await listTags();
  const verticals = await listVerticals();

  const lines: string[] = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    `${tools.length} tools, ${tags.length} capability tags and ${verticals.length} vertical toolkits.`,
    "Every entry below is a prerendered page at a stable URL. The full text of every entry is",
    `available in one fetch at ${abs("/llms-full.txt")}.`,
    "",
    "## Tools",
    "",
    ...tools.map(
      (t) => `- [${t.title}](${abs(t.href)})${t.description ? `: ${t.description}` : ""}`
    ),
    "",
    "## Capability tags",
    "",
    ...tags.map((t) => `- [${t.tag}](${abs(`/tags/${t.slug}/`)}): ${t.count} tools`),
    "",
    "## Vertical toolkits",
    "",
    ...verticals.map(
      (v) => `- [${v.title}](${abs(v.href)})${v.description ? `: ${v.description}` : ""}`
    ),
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
