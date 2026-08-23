import type { APIRoute } from 'astro';
import { listTools, listTags, listVerticals, stats } from '../lib/content-api';
import { abs } from '../lib/seo';

/**
 * /llms.txt — a curated markdown index for generative engines.
 *
 * Same publish predicate as the rendered HTML, and the same `for_clients`
 * carve-out: the field never survives `content-api.ts`, so it cannot reach this
 * surface. That matters more here than in HTML — feeding a client-name
 * association straight into a model corpus is exactly the linkage being
 * suppressed, and it would be invisible in a page review.
 */
export const GET: APIRoute = () => {
  const s = stats();
  const tools = listTools();
  const lines: string[] = [];

  lines.push('# Lossless Toolkit');
  lines.push('');
  lines.push(
    `> A catalogue of ${s.tools} software tools and ${s.verticalEntries} vertical-toolkit entries maintained by The Lossless Group. Each entry records what a tool is for, who it is aimed at, and how it is tagged within our working taxonomy.`
  );
  lines.push('');
  lines.push(`Canonical site: ${abs('/')}`);
  lines.push('');

  lines.push('## Catalogue');
  lines.push('');
  for (const t of tools) {
    const desc = t.summary.replace(/\s+/g, ' ').slice(0, 200);
    lines.push(`- [${t.title}](${abs(`/tools/${t.slug}/`)}): ${desc}${t.url ? ` — ${t.url}` : ''}`);
  }
  lines.push('');

  lines.push('## Tags');
  lines.push('');
  for (const f of listTags()) {
    lines.push(`- [${f.label}](${abs(`/tags/${f.slug}/`)}): ${f.count} entries`);
  }
  lines.push('');

  lines.push('## Verticals');
  lines.push('');
  for (const v of listVerticals()) {
    lines.push(`- [${v.title}](${abs(`/verticals/${v.slug}/`)}): ${v.entries.length} entries`);
  }
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
