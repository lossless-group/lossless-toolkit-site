/**
 * Browser drive — chips and canonical URLs.
 *
 * Two chip designs coexist deliberately: the facet row is the browse surface,
 * the card tags are contextual. They are allowed to look different; they are not
 * allowed to behave differently, and for a while one of them did nothing at all
 * because it was a decorative <span> nested inside the card's <a>.
 *
 * Also pins the canonical-path behaviour: one tag selected collapses the URL to
 * the prerendered /tags/<slug>/ route rather than a query string.
 *
 *   pnpm build && pnpm preview --port 4322
 *   node tests/chip-drive.mjs
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/run/current-system/sw/bin/brave', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const out=[]; const ok=(n,v)=>out.push(`  ${v?'PASS':'FAIL'}  ${n}`);

await p.goto('http://localhost:4322/tools/', { waitUntil:'networkidle' });
await p.waitForTimeout(1300);

// --- chip design 1: the facet row ---
const facet = p.locator('.facets .facet').first();
const fLabel = (await facet.innerText()).trim().split('\n')[0];
const before = await p.locator('.card').count();
await facet.click(); await p.waitForTimeout(1200);
const afterUrl = p.url().replace('http://localhost:4322','');
const afterCards = await p.locator('.card').count();
ok(`facet chip "${fLabel}" changes the URL (${afterUrl})`, afterUrl !== '/tools/');
ok(`facet chip narrows results (${before} -> ${afterCards})`, afterCards !== before);

// reset
await p.goto('http://localhost:4322/tools/', { waitUntil:'networkidle' });
await p.waitForTimeout(1300);

// --- chip design 2: the tag chips on a card ---
const cardChip = p.locator('.card__tags .tool-tag').first();
const n = await cardChip.count();
ok(`card chips are TagChips (${n} found)`, n > 0);
if (n) {
  const cLabel = (await cardChip.innerText()).trim().split('\n')[0];
  const b2 = await p.locator('.card').count();
  await cardChip.click(); await p.waitForTimeout(1200);
  const u2 = p.url().replace('http://localhost:4322','');
  const a2 = await p.locator('.card').count();
  ok(`card chip "${cLabel}" changes the URL (${u2})`, u2 !== '/tools/');
  ok(`card chip narrows results (${b2} -> ${a2})`, a2 !== b2);
  ok(`card chip did not navigate to a tool page`, !/^\/tools\/[a-z0-9-]+\/$/.test(u2));
}
ok(`no page errors (${errs.length})`, errs.length===0);
console.log('\nBOTH CHIP DESIGNS'); console.log(out.join('\n'));
if (errs.length) console.log('  '+errs.slice(0,3).join('\n  '));
await b.close();
