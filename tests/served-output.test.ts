/**
 * Acceptance tests over the SERVED OUTPUT.
 *
 * The site renders on demand, so there is no `dist/` of HTML to grep any more.
 * These request pages from a running server instead, pinned to the vendored
 * baseline so the assertions are reproducible:
 *
 *     CONTENT_SOURCE=baseline pnpm dev --port 4321 &
 *     pnpm build && pnpm test          # build: the search index in rule 5
 *
 * BASE_URL points them elsewhere (a preview deploy, for instance).
 *
 * Still deliberately black-box: importing `content-api.ts` directly would need
 * Vite, and rule 5 ("`for_clients` must never reach the browser") is only truly
 * verified by checking the bytes a browser can fetch.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:4321';

async function get(p: string): Promise<{ status: number; text: string }> {
  const res = await fetch(new URL(p, BASE));
  return { status: res.status, text: await res.text() };
}
async function read(p: string): Promise<string> {
  const { status, text } = await get(p);
  assert.equal(status, 200, `${p} answered ${status}`);
  return text;
}

before(async () => {
  try {
    await fetch(BASE);
  } catch {
    assert.fail(`no server at ${BASE} — start one with CONTENT_SOURCE=baseline pnpm dev --port 4321`);
  }
});

test('1. `publish: false` is excluded from the site entirely', async () => {
  assert.equal((await get('/toolkit/publish-false-test/')).status, 404, 'a publish:false entry rendered');
  const payload = await read('/api/tools.json');
  assert.ok(!payload.includes('Publish False Test'), 'a publish:false entry reached the client');
});

test('2. missing `publish` is INCLUDED — the silent-drop trap', async () => {
  const { tools } = JSON.parse(await read('/api/tools.json'));
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
  walk(path.join(ROOT, 'src', 'content', 'tooling'));

  const optedOut = files.filter((f) => /^publish:\s*false\s*$/m.test(fs.readFileSync(f, 'utf8')));
  assert.ok(optedOut.length > 0, 'expected at least one publish:false fixture');
  // Everything except the deliberate opt-outs must be present.
  assert.equal(
    tools.length,
    files.length - optedOut.length,
    `${files.length - optedOut.length - tools.length} entries were silently dropped`
  );
});

test('3. an empty file still yields a page with a filename-derived title', async () => {
  const html = await read('/toolkit/empty-tool-test/');
  assert.match(html, /<h1[^>]*>Empty Tool Test<\/h1>/);
  assert.match(html, /<title>Empty Tool Test · Lossless Toolkit<\/title>/);
  assert.match(html, /og:image" content="https:\/\//);
});

test('4. title precedence resolves title > og_title > site_name', async () => {
  const html = await read('/toolkit/precedence-test/');
  assert.match(html, /<h1[^>]*>Precedence Test Winner<\/h1>/);
  assert.ok(!html.includes('Should Lose To Title'));
  assert.ok(!html.includes('Should Also Lose'));
});

test('5. `for_clients` never reaches ANY served byte — html, json, txt, or static asset', async () => {
  // Every page the sitemap lists, every client portal and its JSON, and the
  // machine-readable surfaces.
  const sitemap = await read('/sitemap-0.xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const clients = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'clients.json'), 'utf8')).clients;
  urls.push(
    '/api/tools.json',
    '/api/repositories.json',
    '/llms.txt',
    '/reports/content-anomalies.md',
    ...clients.flatMap((c: { id: string }) => [`/client/${c.id}/`, `/api/client/${c.id}.json`]),
  );
  assert.ok(urls.length > 1000, `only ${urls.length} URLs to check`);

  const offenders: string[] = [];
  for (let i = 0; i < urls.length; i += 16) {
    await Promise.all(
      urls.slice(i, i + 16).map(async (u) => {
        if ((await get(u)).text.includes('for_client')) offenders.push(u);
      }),
    );
  }

  // And every static file a browser can fetch: the search index included.
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(html|json|txt|md|js|xml)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('for_client'))
        offenders.push(p);
    }
  };
  walk(path.join(ROOT, '.vercel', 'output', 'static'));

  assert.deepEqual(offenders, [], `for_clients leaked into: ${offenders.join(', ')}`);
});

test('6. `og_image: "[]"` never becomes an image URL', async () => {
  const { tools } = JSON.parse(await read('/api/tools.json'));
  for (const t of tools) {
    assert.ok(!t.i.includes('[]'), `${t.t} shipped a stringified empty array as an image`);
    assert.match(t.i, /^(https?:\/\/|\/og\/)/, `${t.t} has an unusable image: ${t.i}`);
  }
  const fixture = tools.find((t: any) => t.s === 'precedence-test');
  assert.equal(fixture.i, '/og/toolkit-card.jpg', 'the fallback card was not used');
});

test('7. both tag syntaxes reach the client as the same array shape', async () => {
  const { tools } = JSON.parse(await read('/api/tools.json'));
  const blockList = tools.find((t: any) => t.s === 'precedence-test');
  assert.deepEqual(blockList.g, ['Fixture', 'Block-List-Syntax']);
  // and inline-flow tags are present across the corpus
  assert.ok(tools.filter((t: any) => t.g.length > 0).length > 50);
  for (const t of tools) assert.ok(Array.isArray(t.g), `${t.t} shipped a non-array tag field`);
});

test('8. untagged entries ship as valid items, never as errors', async () => {
  const { tools } = JSON.parse(await read('/api/tools.json'));
  const untagged = tools.filter((t: any) => t.g.length === 0);
  assert.ok(untagged.length > 0, 'expected untagged entries in the sample');
  for (const t of untagged) {
    assert.ok(t.t.trim().length > 0, 'an untagged entry shipped with an empty label');
    assert.ok(t.s.trim().length > 0);
  }
});

test('every shipped item has a non-empty label and a real URL', async () => {
  const { tools } = JSON.parse(await read('/api/tools.json'));
  for (const t of tools) {
    assert.ok(t.t && t.t.trim(), `empty title on ${t.s}`);
    assert.ok(t.s && /^[a-z0-9-]+$/.test(t.s), `bad slug: ${t.s}`);
  }
});

test('share metadata: the full sextet plus the twitter pair, absolute', async () => {
  const html = await read('/toolkit/precedence-test/');
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

test('single-tag filters have real, server-rendered, unfurlable routes', async () => {
  const index = await read('/tags/');
  const tags = [...new Set([...index.matchAll(/href="\/tags\/([^"/]+)\/"/g)].map((m) => m[1]))];
  assert.ok(tags.length > 50, `only ${tags.length} tag routes are linked`);
  const sample = await read(`/tags/${tags[0]}/`);
  assert.match(sample, /<h1[^>]*>/);
  assert.match(sample, /property="og:image" content="https:\/\//);
  assert.match(sample, /application\/ld\+json/);
  assert.equal((await get('/tags/no-such-tag-anywhere/')).status, 404);
});

test('the anomaly report exists and is grouped by kind', async () => {
  const md = await read('/reports/content-anomalies.md');
  assert.match(md, /# Content Anomalies/);
  assert.match(md, /\| Anomaly \| Count \|/);
  assert.match(md, /## /);
});

test('verticals group by the folder a file sits in, so umbrella folders keep old URLs', async () => {
  // vertical-toolkits/Alternatives/Venture-Capital-Firms/ must still publish at
  // /verticals/venture-capital-firms/, not fold into /verticals/alternatives/.
  assert.equal((await get('/verticals/venture-capital-firms/')).status, 200);
  assert.equal((await get('/verticals/alternatives/')).status, 404);
});

test('the content hook refuses an unsigned wake-up', async () => {
  const res = await fetch(new URL('/api/content-hook', BASE), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-relay-signature-256': 'sha256=forged' },
    body: JSON.stringify({ repo: 'lossless-group/lossless-content', ref: 'refs/heads/master' }),
  });
  assert.equal(res.status, 401);
});
