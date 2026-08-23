/**
 * Acceptance tests over the BUILT OUTPUT.
 *
 * Deliberate choice: these assert against `dist/` rather than importing
 * `content-api.ts` directly, because that module reads content through
 * `import.meta.glob`, which only exists inside Vite. Testing the artifact is
 * also the stronger claim — rule 5 in particular ("`for_clients` must never
 * reach the browser") is only truly verified by grepping the bytes that ship.
 *
 *     pnpm build && pnpm test
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const read = (p: string) => fs.readFileSync(path.join(DIST, p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(DIST, p));

before(() => {
  assert.ok(fs.existsSync(DIST), 'run `pnpm build` before `pnpm test`');
});

test('1. `publish: false` is excluded from the site entirely', () => {
  assert.ok(!exists('tools/publish-false-test/index.html'), 'a publish:false entry rendered');
  const payload = read('api/tools.json');
  assert.ok(!payload.includes('Publish False Test'), 'a publish:false entry reached the client');
});

test('2. missing `publish` is INCLUDED — the silent-drop trap', () => {
  const { tools } = JSON.parse(read('api/tools.json'));
  // Most of the corpus carries no `publish` key at all. If the filter were
  // `publish === true` this number would collapse.
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) files.push(p);
    }
  };
  walk(path.join(DIST, '..', 'src', 'content', 'tooling'));

  const optedOut = files.filter((f) => /^publish:\s*false\s*$/m.test(fs.readFileSync(f, 'utf8')));
  assert.ok(optedOut.length > 0, 'expected at least one publish:false fixture');
  // Everything except the deliberate opt-outs must be present.
  assert.equal(
    tools.length,
    files.length - optedOut.length,
    `${files.length - optedOut.length - tools.length} entries were silently dropped`
  );
});

test('3. an empty file still yields a page with a filename-derived title', () => {
  const html = read('tools/empty-tool-test/index.html');
  assert.match(html, /<h1[^>]*>Empty Tool Test<\/h1>/);
  assert.match(html, /<title>Empty Tool Test · Lossless Toolkit<\/title>/);
  assert.match(html, /og:image" content="https:\/\//);
});

test('4. title precedence resolves title > og_title > site_name', () => {
  const html = read('tools/precedence-test/index.html');
  assert.match(html, /<h1[^>]*>Precedence Test Winner<\/h1>/);
  assert.ok(!html.includes('Should Lose To Title'));
  assert.ok(!html.includes('Should Also Lose'));
});

test('5. `for_clients` never reaches ANY built byte — html, json, or llms.txt', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(html|json|txt|md|js|xml)$/.test(e.name)) {
        if (fs.readFileSync(p, 'utf8').includes('for_client')) offenders.push(p);
      }
    }
  };
  walk(DIST);
  assert.deepEqual(offenders, [], `for_clients leaked into: ${offenders.join(', ')}`);

  // Strongest form: the client projection is view-source readable.
  assert.ok(!read('api/tools.json').includes('for_client'));
});

test('6. `og_image: "[]"` never becomes an image URL', () => {
  const { tools } = JSON.parse(read('api/tools.json'));
  for (const t of tools) {
    assert.ok(!t.i.includes('[]'), `${t.t} shipped a stringified empty array as an image`);
    assert.match(t.i, /^(https?:\/\/|\/og\/)/, `${t.t} has an unusable image: ${t.i}`);
  }
  const fixture = tools.find((t: any) => t.s === 'precedence-test');
  assert.equal(fixture.i, '/og/toolkit-card.jpg', 'the fallback card was not used');
});

test('7. both tag syntaxes reach the client as the same array shape', () => {
  const { tools } = JSON.parse(read('api/tools.json'));
  const blockList = tools.find((t: any) => t.s === 'precedence-test');
  assert.deepEqual(blockList.g, ['Fixture', 'Block-List-Syntax']);
  // and inline-flow tags are present across the corpus
  assert.ok(tools.filter((t: any) => t.g.length > 0).length > 50);
  for (const t of tools) assert.ok(Array.isArray(t.g), `${t.t} shipped a non-array tag field`);
});

test('8. untagged entries ship as valid items, never as errors', () => {
  const { tools } = JSON.parse(read('api/tools.json'));
  const untagged = tools.filter((t: any) => t.g.length === 0);
  assert.ok(untagged.length > 0, 'expected untagged entries in the sample');
  for (const t of untagged) {
    assert.ok(t.t.trim().length > 0, 'an untagged entry shipped with an empty label');
    assert.ok(t.s.trim().length > 0);
  }
});

test('every shipped item has a non-empty label and a real URL', () => {
  const { tools } = JSON.parse(read('api/tools.json'));
  for (const t of tools) {
    assert.ok(t.t && t.t.trim(), `empty title on ${t.s}`);
    assert.ok(t.s && /^[a-z0-9-]+$/.test(t.s), `bad slug: ${t.s}`);
  }
});

test('share metadata: the full sextet plus the twitter pair, absolute', () => {
  const html = read('tools/precedence-test/index.html');
  for (const prop of [
    'og:image',
    'og:image:secure_url',
    'og:image:type',
    'og:image:width',
    'og:image:height',
    'og:image:alt',
  ]) {
    assert.ok(html.includes(`property="${prop}"`), `missing ${prop}`);
  }
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="twitter:image" content="https:\/\//);
  assert.match(html, /property="og:image:type" content="image\/jpeg"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  // absolute, never relative
  const rel = html.match(/property="og:image" content="(?!https:\/\/)[^"]*"/);
  assert.equal(rel, null, 'og:image is not absolute');
});

test('single-tag filters have real, prerendered, unfurlable routes', () => {
  const tagDirs = fs.readdirSync(path.join(DIST, 'tags')).filter((d) => d !== 'index.html');
  assert.ok(tagDirs.length > 50, `only ${tagDirs.length} tag routes were prerendered`);
  const sample = read(`tags/${tagDirs[0]}/index.html`);
  assert.match(sample, /<h1[^>]*>/);
  assert.match(sample, /property="og:image" content="https:\/\//);
  assert.match(sample, /application\/ld\+json/);
});

test('the anomaly report exists and is grouped by kind', () => {
  const md = read('reports/content-anomalies.md');
  assert.match(md, /# Content Anomalies/);
  assert.match(md, /\| Anomaly \| Count \|/);
  assert.match(md, /## /);
});
