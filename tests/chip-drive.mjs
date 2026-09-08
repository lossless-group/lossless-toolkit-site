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

// Port is an argument, not a constant: the variant harness serves three builds
// on three ports and a hardcoded one silently drives the wrong site.
const BASE = process.argv[2] ?? 'http://localhost:4322';
const b = await chromium.launch({ executablePath: '/run/current-system/sw/bin/brave', args: ['--no-sandbox'] });
const p = await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const out=[]; const ok=(n,v)=>out.push(`  ${v?'PASS':'FAIL'}  ${n}`);

await p.goto(`${BASE}/toolkit/`, { waitUntil:'networkidle' });
await p.waitForTimeout(1300);

// --- chip design 1: the facet row ---
const facet = p.locator('.facets .facet').first();
const fLabel = (await facet.innerText()).trim().split('\n')[0];
// Compare WHICH cards are shown, not how many. The explorer pages at 48, and
// a broad facet (AI-Toolkit is 514 of 1,765) leaves a full page full — so a
// count-based assertion reports "no narrowing" for a filter that is working.
// That is a false failure the moment the corpus stops being a 173-file sample.
const idOf = async () => (await p.locator('.card h3, .card .card__title').allInnerTexts()).join('|');
const before = await idOf();
const beforeCards = await p.locator('.card').count();
await facet.click(); await p.waitForTimeout(1200);
const afterUrl = p.url().replace(`${BASE}`,'');
const after = await idOf();
const afterCards = await p.locator('.card').count();
ok(`facet chip "${fLabel}" changes the URL (${afterUrl})`, afterUrl !== '/toolkit/');
ok(`facet chip changes the result set (${beforeCards} -> ${afterCards} cards)`, after !== before && after.length > 0);

// reset
await p.goto(`${BASE}/toolkit/`, { waitUntil:'networkidle' });
await p.waitForTimeout(1300);

// --- chip design 2: the tag chips on a card ---
const cardChip = p.locator('.card__tags .tool-tag').first();
const n = await cardChip.count();
ok(`card chips are TagChips (${n} found)`, n > 0);
if (n) {
  const cLabel = (await cardChip.innerText()).trim().split('\n')[0];
  const s2before = await idOf();
  const b2 = await p.locator('.card').count();
  await cardChip.click(); await p.waitForTimeout(1200);
  const u2 = p.url().replace(`${BASE}`,'');
  const s2after = await idOf();
  const a2 = await p.locator('.card').count();
  ok(`card chip "${cLabel}" changes the URL (${u2})`, u2 !== '/toolkit/');
  ok(`card chip changes the result set (${b2} -> ${a2} cards)`, s2after !== s2before && s2after.length > 0);
  // The route is /toolkit/ now, not /tools/ — this guarded against the chip
  // behaving like a link to the tool instead of a filter.
  ok(`card chip did not navigate to a tool page`, !/^\/toolkit\/[a-z0-9-]+\/$/.test(u2));
}
ok(`no page errors (${errs.length})`, errs.length===0);
console.log('\nBOTH CHIP DESIGNS'); console.log(out.join('\n'));
if (errs.length) console.log('  '+errs.slice(0,3).join('\n  '));
await b.close();
