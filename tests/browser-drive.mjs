import { chromium } from 'playwright';

const base = process.argv[2];
const label = process.argv[3];
const b = await chromium.launch({ executablePath: '/run/current-system/sw/bin/brave', args: ['--no-sandbox'] });
const page = await b.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

const out = [];
const ok = (n, v) => out.push(`  ${v ? 'PASS' : 'FAIL'}  ${n}`);

await page.goto(base + '/', { waitUntil: 'networkidle' });
const summary = page.locator('.search-compact__trigger');
if (await summary.count()) { await summary.first().click(); await page.waitForTimeout(700); }

// 1. a search input exists in the header
const input = page.locator(
  'header input[type="search"], .site-head input[type="search"], .masthead input[type="search"], ' +
  '.pagefind-ui__search-input, .search-compact__panel input'
).first();
const hasInput = await input.count() > 0;
ok('header has a search input', hasInput);

if (hasInput) {
  // 2. THE BUG: can you type, and does the value stick?
  await input.click();
  await input.type('design', { delay: 40 });
  await page.waitForTimeout(600);
  const val = await input.inputValue();
  ok(`typing sticks (got "${val}")`, val === 'design');

  // 3. does something pop out of the bar?
  await page.waitForTimeout(800);
  const panel = page.locator('.pfs__panel, .search-compact__panel, .pagefind-ui__results');
  ok('results/tags panel pops out', await panel.count() > 0 && await panel.first().isVisible());

  // 4. are tag chips rendered as objects?
  const chips = page.locator('.pfs__panel .tool-tag, .search-compact__panel .tool-tag');
  const chipCount = await chips.count();
  ok(`tag chips present (${chipCount})`, chipCount > 0);

  // 5. selecting a chip pops it into the bar
  if (chipCount > 0) {
    const first = (await chips.first().innerText()).trim();
    await chips.first().click();
    await page.waitForTimeout(500);
    const pills = await page.locator('.pfs__bar .tool-tag.removable').count();
    ok(`selected chip becomes a pill in the bar (${pills})`, pills > 0);

    // 6. backspace on empty input evaporates it
    await input.click();
    await input.fill('');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(400);
    const after = await page.locator('.pfs__bar .tool-tag.removable').count();
    ok(`backspace removes the tag (${pills} -> ${after})`, after < pills);
  }

  // 7. no bright-yellow default marks
  const yellow = await page.evaluate(() => {
    const m = document.querySelector('.pfs__panel mark, .pagefind-ui mark');
    if (!m) return 'no-mark';
    return getComputedStyle(m).backgroundColor;
  });
  ok(`highlight is not default yellow (${yellow})`, yellow === 'no-mark' || !/255,\s*255,\s*0/.test(yellow));
}

ok(`no console errors (${errors.length})`, errors.length === 0);
console.log(`\n${label} — ${base}`);
console.log(out.join('\n'));
if (errors.length) console.log('  errors:\n' + errors.slice(0,4).map(e=>'    '+e).join('\n'));
await b.close();
