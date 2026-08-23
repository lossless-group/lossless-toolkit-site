/**
 * Deliberately NOT a YAML parser.
 *
 * House rule: never run a strict YAML parser over content frontmatter. A bad key
 * must drop that key and keep the document — it must never fail the build. This
 * corpus contains double frontmatter blocks, stringified empty arrays
 * (`og_image: "[]"`), unquoted colons in values, smart quotes, and both inline
 * and block list syntax. A strict parser throws on several of those; this one
 * shrugs and moves on.
 *
 * It is also the security boundary for the `for_clients` no-emit rule: the field
 * is dropped HERE, at parse time, so no downstream code can leak it even by
 * accident. Nothing further down the pipeline has ever seen it.
 */

/** Keys that must never leave this module, no matter what asks for them. */
const DENY = new Set(['for_clients', 'for_client', 'clients']);

export type Scalar = string | number | boolean | null;
export type FMValue = Scalar | string[];
export type Frontmatter = Record<string, FMValue>;

export interface ParsedDoc {
  data: Frontmatter;
  body: string;
}

const isFence = (l: string) => {
  const t = l.trim();
  return t === '---' || t === '...';
};

function unquote(raw: string): string {
  let v = raw.trim();
  // strip trailing inline comments only when clearly not part of a URL
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) v = v.slice(1, -1);
  else if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) v = v.slice(1, -1);
  return v.trim();
}

/** `[a, b, c]` / `[]` / `"[]"` -> string[] | null when not an inline list. */
function inlineList(raw: string): string[] | null {
  const v = unquote(raw);
  if (!v.startsWith('[') || !v.endsWith(']')) return null;
  const inner = v.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(',')
    .map((s) => unquote(s))
    .filter(Boolean);
}

function coerce(raw: string): FMValue {
  const list = inlineList(raw);
  if (list) return list;
  const v = unquote(raw);
  if (v === '') return '';
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  return v;
}

/**
 * Parse zero or more leading frontmatter blocks. Files in `vertical-toolkits/`
 * routinely carry two stacked blocks; later blocks win on key collision because
 * they are the more recently written enrichment pass.
 */
export function parseFrontmatter(raw: string): ParsedDoc {
  const lines = raw.split(/\r?\n/);
  const data: Frontmatter = {};
  let i = 0;

  const skipBlank = () => {
    while (i < lines.length && lines[i].trim() === '') i++;
  };

  skipBlank();

  while (i < lines.length && lines[i].trim() === '---') {
    i++; // consume opening fence
    while (i < lines.length && !isFence(lines[i])) {
      const line = lines[i];

      // block-list continuation: "  - value"
      const item = /^\s*-\s+(.*)$/.exec(line);
      if (item) {
        i++;
        continue; // handled by the key branch below via lookahead
      }

      const m = /^([A-Za-z0-9_][A-Za-z0-9_ -]*?)\s*:\s?(.*)$/.exec(line);
      if (!m) {
        i++;
        continue; // unparseable line: drop the line, keep the document
      }

      const key = m[1].trim();
      const rest = m[2];
      i++;

      if (rest.trim() === '') {
        // possible block list
        const items: string[] = [];
        while (i < lines.length && !isFence(lines[i])) {
          const it = /^\s*-\s+(.*)$/.exec(lines[i]);
          if (!it) break;
          items.push(unquote(it[1]));
          i++;
        }
        if (!DENY.has(key)) data[key] = items.length ? items : '';
        continue;
      }

      if (DENY.has(key)) continue;
      data[key] = coerce(rest);
    }
    i++; // consume closing fence
    skipBlank();
  }

  return { data, body: lines.slice(i).join('\n') };
}

/** Read a key as a clean string, treating junk sentinels as absent. */
export function str(data: Frontmatter, key: string): string | undefined {
  const v = data[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t || t === '[]' || t === '{}' || t === 'undefined' || t === 'null') return undefined;
  return t;
}

/** Read a key as a string[], accepting inline arrays, block lists, or a lone scalar. */
export function list(data: Frontmatter, key: string): string[] {
  const v = data[key];
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  const s = str(data, key);
  return s ? [s] : [];
}
