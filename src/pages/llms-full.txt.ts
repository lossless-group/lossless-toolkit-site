import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { listTools } from "../lib/content-api";
import { SITE, abs } from "../lib/site";

export const prerender = true;

/**
 * /llms-full.txt — the concatenated bodies, one fetch instead of N pages.
 *
 * A corpus of this shape is far more useful to a model as a single document
 * than as several hundred HTML pages it has to crawl. Frontmatter is stripped;
 * only the prose ships.
 */
export const GET: APIRoute = async () => {
  const tools = await listTools();
  const raw = await getCollection("tools");
  const bodies = new Map(raw.map((e) => [e.data.slug || e.id, e.body ?? ""]));

  const parts: string[] = [
    `# ${SITE.name} — full corpus`,
    "",
    `> ${SITE.description}`,
    "",
    `${tools.length} entries, concatenated. Index: ${abs("/llms.txt")}`,
    "",
    "---",
    "",
  ];

  for (const t of tools) {
    parts.push(`## ${t.title}`);
    parts.push("");
    parts.push(`URL: ${abs(t.href)}`);
    if (t.url) parts.push(`Homepage: ${t.url}`);
    if (t.tags.length) parts.push(`Tags: ${t.tags.join(", ")}`);
    parts.push("");
    parts.push((bodies.get(t.slug) ?? "").trim());
    parts.push("");
    parts.push("---");
    parts.push("");
  }

  return new Response(parts.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
