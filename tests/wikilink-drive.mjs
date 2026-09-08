/**
 * wikilink-drive.mjs — proves resolved wikilinks are real, clickable links to
 * pages that exist, and that unresolved ones are inert text.
 *
 * This is a browser drive rather than a build assertion because the failure
 * modes that matter here are navigational: an anchor whose href 404s, or an
 * anchor nested inside another anchor. Neither shows up in `pnpm build`.
 *
 * The click-path, named up front:
 *   1. open a tool page known to contain a resolved wikilink
 *   2. assert the anchor exists and carries a `data-via` tier
 *   3. CLICK it and assert we land on a real page (not the 404 route)
 *   4. assert unresolved wikilinks render with no anchor at all
 *   5. assert no literal [[...]] survives anywhere in the body
 *
 * NixOS: Playwright's bundled Chromium will not run — use the Nix Brave.
 *
 *   pnpm build && pnpm preview --port 4322
 *   node tests/wikilink-drive.mjs http://localhost:4322
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4322';
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

console.log(`\nwikilinks — ${base}`);

// 1. Find a page that actually has one, rather than hardcoding a slug that
//    could vanish with the corpus.
await page.goto(`${base}/toolkit/obsidian/`, { waitUntil: 'networkidle' });

const links = await page.$$('a.wikilink');
ok('resolved wikilinks render as anchors', links.length > 0, `${links.length} found`);

if (links.length) {
  const via = await links[0].getAttribute('data-via');
  ok('the anchor reports which cascade tier answered', !!via, `via=${via}`);

  // No anchor may sit inside another anchor — that was a real bug on this
  // surface with tag chips, and wikilinks are the same shape of risk.
  const nested = await page.$$eval('a.wikilink', (as) =>
    as.filter((a) => a.parentElement?.closest('a')).length,
  );
  ok('no wikilink is nested inside another anchor', nested === 0, `${nested} nested`);

  // 3. Click it and confirm a real page, not the 404 route.
  const href = await links[0].getAttribute('href');
  const resp = await page.goto(new URL(href, base).href, { waitUntil: 'domcontentloaded' });
  ok('a resolved wikilink navigates to a real page', resp?.status() === 200, `${href} → ${resp?.status()}`);
}

// 4 & 5. Unresolved links are inert, and nothing leaks raw syntax.
await page.goto(`${base}/toolkit/`, { waitUntil: 'networkidle' });
const bodies = await page.$$eval('main', (els) => els.map((e) => e.textContent ?? '').join(' '));
ok('no literal [[wikilink]] syntax leaks to the page', !/\[\[[^\]]+\]\]/.test(bodies));

const unresolvedAreInert = await page.$$eval('.wikilink--unresolved', (els) =>
  els.every((e) => e.tagName !== 'A' && !e.querySelector('a')),
);
ok('unresolved wikilinks carry no anchor', unresolvedAreInert);

await b.close();
console.log(failed ? `\n${failed} failed\n` : '\nall good\n');
process.exit(failed ? 1 : 0);
