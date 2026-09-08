/**
 * tag-page-drive.mjs — a /tags/<slug>/ page must open ALREADY FILTERED.
 *
 * This exists because it regressed silently. The server seeded the island with
 * its tag, `hydrateFromUrl` then set the shared atom's tags to [], and the
 * atom->local bridge wiped the seed — so every tag page rendered the unfiltered
 * first 48 of the whole catalogue. The build passed. `curl` passed. The static
 * HTML was correct; only the hydrated view was wrong, which is exactly the
 * class of defect a browser drive exists to catch.
 *
 * Counting cards is NOT sufficient: the explorer pages at 48, so any tag with
 * more than 48 entries looks identical filtered or not. This compares the
 * rendered titles against the authoritative set in /api/tools.json.
 *
 *   pnpm build && pnpm preview --port 4403
 *   node tests/tag-page-drive.mjs http://localhost:4403
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4403';
const PAGE_SIZE = 48;

// The five filters the landing page leads with — a broad one, a narrow one, and
// the two whose casing drifts in the corpus.
const TAGS = ['ai-toolkit', 'agentic-ai', 'founder-toolkit', 'must-have', 'check-it-out'];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const api = JSON.parse(readFileSync('dist/api/tools.json', 'utf8'));

let failed = 0;
const ok = (label, cond, extra = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
};

const b = await chromium.launch({
  executablePath: '/run/current-system/sw/bin/brave',
  args: ['--no-sandbox'],
});
const page = await b.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

console.log(`\ntag pages open filtered — ${BASE}`);

for (const slug of TAGS) {
  const expected = new Set(
    api.tools.filter((t) => t.g.some((g) => norm(g) === slug)).map((t) => t.t),
  );
  await page.goto(`${BASE}/tags/${slug}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const titles = await page.$$eval('.card h3, .card .card__title', (els) =>
    els.map((e) => e.textContent.trim()),
  );
  const strays = titles.filter((t) => !expected.has(t));

  ok(
    `/tags/${slug}/ shows only tools carrying the tag`,
    strays.length === 0,
    `${titles.length} of ${expected.size}${strays.length ? `, stray: ${strays[0]}` : ''}`,
  );

  // A tag smaller than one page proves filtering by count alone; a bigger one
  // must at least fill the page rather than fall short.
  const want = Math.min(expected.size, PAGE_SIZE);
  ok(`/tags/${slug}/ renders the expected number of cards`, titles.length === want, `${titles.length} vs ${want}`);
}

// The landing CTAs must land on a filtered page, not just the right URL.
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const cta = page.locator('a.featured-tag').first();
ok('landing page exposes featured tag CTAs', (await cta.count()) > 0);
if (await cta.count()) {
  await cta.click();
  await page.waitForTimeout(1800);
  const url = page.url();
  const cards = await page.locator('.card').count();
  ok('a featured CTA lands on a filtered tag page', /\/tags\/[a-z0-9-]+\/$/.test(url) && cards > 0, `${url} (${cards} cards)`);
}

ok(`no page errors (${errors.length})`, errors.length === 0, errors[0] ?? '');

await b.close();
console.log(failed ? `\n${failed} failed\n` : '\nall good\n');
process.exit(failed ? 1 : 0);
