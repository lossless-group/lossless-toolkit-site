/**
 * A deliberately small markdown renderer.
 *
 * House hierarchy is "HTML and CSS before JavaScript, and web standards before
 * libraries". The bodies in this corpus use a narrow slice of markdown —
 * headings, lists, tables, bold, links, and bracketed citation markers — so a
 * ~90-line renderer covers them without pulling a parser into the dependency
 * tree. When LFM lands, this is the seam it replaces.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

function inline(s: string): string {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener nofollow">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|\W)\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // bare citation markers like [1][4] — the corpus is full of them
  out = out.replace(/\[(\d+)\]/g, '<sup class="cite">$1</sup>');
  return out;
}

export interface Heading {
  depth: number;
  text: string;
  id: string;
}

export function renderMarkdown(md: string): { html: string; headings: Heading[] } {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  const headings: Heading[] = [];
  let i = 0;
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (!t) {
      closeList();
      i++;
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) {
      closeList();
      const depth = h[1].length;
      const text = h[2].replace(/[*`]/g, '').trim();
      const id = headingId(text);
      if (depth <= 3) headings.push({ depth, text, id });
      out.push(`<h${depth} id="${id}">${inline(text)}</h${depth}>`);
      i++;
      continue;
    }

    // table
    if (t.startsWith('|') && /^\|[\s:|-]+\|$/.test((lines[i + 1] ?? '').trim())) {
      closeList();
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim());
      const head = cells(t);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        body.push(cells(lines[i]));
        i++;
      }
      out.push('<div class="table-wrap"><table><thead><tr>');
      out.push(head.map((c) => `<th>${inline(c)}</th>`).join(''));
      out.push('</tr></thead><tbody>');
      for (const row of body) out.push(`<tr>${row.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`);
      out.push('</tbody></table></div>');
      continue;
    }

    const ul = /^[-*+]\s+(.*)$/.exec(t);
    const ol = /^\d+[.)]\s+(.*)$/.exec(t);
    if (ul || ol) {
      const want = ul ? 'ul' : 'ol';
      if (listType !== want) {
        closeList();
        out.push(`<${want}>`);
        listType = want;
      }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
      i++;
      continue;
    }

    if (t.startsWith('>')) {
      closeList();
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`);
      continue;
    }

    if (t.startsWith('---') || t.startsWith('***')) {
      closeList();
      out.push('<hr />');
      i++;
      continue;
    }

    closeList();
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^([-*+]|\d+[.)]|#{1,6}\s|\||>)/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    else i++;
  }
  closeList();

  return { html: out.join('\n'), headings };
}
