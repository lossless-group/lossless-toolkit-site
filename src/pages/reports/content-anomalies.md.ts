import type { APIRoute } from 'astro';
import { listAnomalies, stats } from '../../lib/content-api';

/**
 * The anomaly report. The build never fails on a bad file — but every
 * assumption normalization had to make is written down here, grouped by
 * anomaly type, so the leniency produces a worklist instead of rot.
 *
 * Markdown, not JSON, because these files are fixed in Obsidian.
 */
export const prerender = true;

export const GET: APIRoute = () => {
  const anomalies = listAnomalies();
  const s = stats();

  const byKind = new Map<string, typeof anomalies>();
  for (const a of anomalies) {
    if (!byKind.has(a.kind)) byKind.set(a.kind, []);
    byKind.get(a.kind)!.push(a);
  }
  const kinds = [...byKind.entries()].sort((a, b) => b[1].length - a[1].length);

  const out: string[] = [];
  out.push('---');
  out.push('title: "Content Anomalies"');
  out.push(`lede: "Everything a hard validator would have rejected, recorded instead of thrown. ${anomalies.length} findings across ${s.tools} tools."`);
  out.push(`date_generated: ${new Date().toISOString().slice(0, 10)}`);
  out.push('generated_by: "lossless-toolkit-site build"');
  out.push('publish: false');
  out.push('---');
  out.push('');
  out.push('# Content Anomalies');
  out.push('');
  out.push(
    'The build is deliberately lenient: a nonconforming file drops the bad key and keeps the document. This report is the other half of that bargain — what would have failed, and what was assumed instead.'
  );
  out.push('');
  out.push('| Anomaly | Count |');
  out.push('|---|---:|');
  for (const [kind, items] of kinds) out.push(`| ${kind} | ${items.length} |`);
  out.push(`| **Total** | **${anomalies.length}** |`);
  out.push('');

  for (const [kind, items] of kinds) {
    out.push(`## ${kind} — ${items.length}`);
    out.push('');
    for (const a of items) {
      out.push(`- \`${a.file}\` — \`${a.field}\` ${a.found}; used ${a.assumed}`);
    }
    out.push('');
  }

  return new Response(out.join('\n'), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
};
