/**
 * Content-shaped tests. The build-loop exploration argues these matter more
 * than component tests on a corpus like this, and it is right: the invariants
 * that actually break this site are properties of 1,900 markdown files, not of
 * any component.
 *
 * Run against the FULL upstream corpus, not just the copied subset, by pointing
 * CORPUS at it:
 *
 *     CORPUS=/path/to/content/tooling node --test tests/
 *
 * With no CORPUS set it runs against `src/content/`, which is what CI has.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, str, list } from '../src/lib/frontmatter.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.CORPUS ?? path.join(here, '..', 'src', 'content');

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);

test('the corpus is non-empty', () => {
  assert.ok(files.length > 0, `no markdown found under ${ROOT}`);
});

test('no file throws — a bad key drops the key, never the document', () => {
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    assert.doesNotThrow(() => parseFrontmatter(raw), `threw on ${f}`);
  }
});

test('both tag syntaxes parse — inline flow AND block list', () => {
  let inline = 0;
  let block = 0;
  let parsed = 0;
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const isInline = /^tags:\s*\[/m.test(raw);
    const isBlock = /^tags:\s*$/m.test(raw) && /^\s*-\s+\S/m.test(raw);
    if (!isInline && !isBlock) continue;
    if (isInline) inline++;
    else block++;
    const tags = list(parseFrontmatter(raw).data, 'tags');
    if (tags.length) parsed++;
  }
  // Both forms must be represented and essentially all of them must yield tags.
  assert.ok(inline > 0, 'no inline-flow tag files seen');
  assert.ok(block > 0, 'no block-list tag files seen');
  assert.ok(
    parsed >= Math.floor((inline + block) * 0.98),
    `only ${parsed} of ${inline + block} tagged files produced tags`
  );
});

test('every document resolves a non-empty title through the precedence chain', () => {
  for (const f of files) {
    const { data } = parseFrontmatter(fs.readFileSync(f, 'utf8'));
    const title =
      str(data, 'title') ||
      str(data, 'og_title') ||
      str(data, 'site_name') ||
      str(data, 'og_site_name') ||
      path.basename(f, '.md');
    assert.ok(title.trim().length > 0, `empty title for ${f}`);
  }
});

test('`og_image: "[]"` is never treated as a URL', () => {
  for (const f of files) {
    const { data } = parseFrontmatter(fs.readFileSync(f, 'utf8'));
    const v = str(data, 'og_image');
    if (v === undefined) continue;
    assert.ok(!v.includes('[]'), `stringified empty array survived as an image in ${f}`);
  }
});

test('for_clients never survives the parse — it is dropped at the boundary', () => {
  let carriers = 0;
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    if (!/^for_clients:/m.test(raw)) continue;
    carriers++;
    const { data } = parseFrontmatter(raw);
    assert.equal(data.for_clients, undefined, `for_clients leaked from ${f}`);
    assert.ok(
      !JSON.stringify(data).includes('for_client'),
      `for_clients leaked into parsed data for ${f}`
    );
  }
  assert.ok(carriers > 0, 'expected at least one for_clients carrier in the sample');
});
