<script>
  /**
   * ISLAND 3 — spill-out search. Results are an overlay anchored to the input,
   * not page content.
   *
   * The paradigm matters: this is a command palette, not a filtered index page.
   * You type, objects spill out beneath the bar — tags first as selectable
   * things, then tools with their metadata — and the page underneath is never
   * rearranged. Dismissing the panel returns you exactly where you were.
   *
   * Tags are objects, not text matches: typing "python" surfaces the
   * *Python Ecosystem* tag with its count, clickable. Selecting two or more
   * AND-s them via Pagefind's `all` operator.
   *
   * Index fragments are fetched on demand, so full-text over ~1,900 tools costs
   * a few KB per query rather than shipping the catalogue to the browser.
   */

  import TagChip from './TagChip.svelte';
  import { toolkit, toggleTag, popTag, setQuery, hydrateFromUrl } from '../lib/toolkit-state.svelte.js';

  let { bundlePath = '/pagefind/', placeholder = 'Search tools, or type a tag…' } = $props();

  let pagefind = $state(null);
  let ready = $state(false);
  let failed = $state(false);
  let open = $state(false);
  let allTags = $state([]);
  let results = $state([]);
  let searching = $state(false);
  let cursor = $state(-1);
  let rootEl;
  let inputEl;

  let tagMatches = $derived.by(() => {
    const q = toolkit.query.trim().toLowerCase();
    const pool = allTags.filter((t) => !toolkit.tags.includes(t.value));
    if (!q) return pool.slice(0, 12);
    // Tag matches are the strongest signal, so rank them: prefix beats substring.
    const pre = pool.filter((t) => t.value.toLowerCase().startsWith(q));
    const sub = pool.filter((t) => !t.value.toLowerCase().startsWith(q) && t.value.toLowerCase().includes(q));
    return [...pre, ...sub].slice(0, 12);
  });

  // The panel opens on focus, not on input: tag chips are the primary affordance
  // and must be visible before anything is typed.
  let hasPanel = $derived(open);

  // Warm the index without waiting for focus — it is a few KB and makes the
  // first keystroke feel instant rather than staged.
  if (typeof window !== 'undefined') {
    // requestIdleCallback and setTimeout do NOT share a signature: the second
    // argument is an options object for the former and a delay for the latter.
    // Passing `1` to requestIdleCallback throws, and because this runs during
    // component init the throw killed hydration outright — the box rendered
    // from SSR and then never bound to anything.
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => boot());
    } else {
      setTimeout(() => boot(), 1);
    }
  }

  async function boot() {
    if (pagefind || failed) return;
    try {
      const mod = await import(/* @vite-ignore */ `${bundlePath}pagefind.js`);
      await mod.options({ bundlePath });
      await mod.init();
      pagefind = mod;
      allTags = Object.entries((await mod.filters()).tag ?? {})
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
      ready = true;
      run();
    } catch (e) {
      console.error('pagefind boot failed', e);
      failed = true;
    }
  }

  async function run() {
    if (!pagefind) return;
    searching = true;
    cursor = -1;
    const q = toolkit.query.trim();
    const f = toolkit.tags.length ? { tag: { all: [...toolkit.tags] } } : undefined;
    try {
      let r;
      try { r = await pagefind.search(q || null, { filters: f }); }
      catch { r = await pagefind.search(q || null, { filters: toolkit.tags.length ? { tag: [...toolkit.tags] } : undefined }); }
      results = await Promise.all(r.results.slice(0, 8).map((x) => x.data()));
    } catch (e) { console.error(e); results = []; }
    finally { searching = false; }
  }

  function toggle(tag) {
    const adding = !toolkit.tags.includes(tag);
    toggleTag(tag);

    // Fold the query into the token. If you typed "AI Toolkit" to find the tag,
    // the text has done its job the moment the tag is chosen — leaving it behind
    // the pill reads as two competing filters and double-narrows the results.
    // Removing a tag leaves the query alone: that text was not spent on it.
    if (adding && toolkit.query) setQuery('');

    run();
    inputEl?.focus();
  }

  let debounce;
  function onInput() {
    open = true;
    boot();
    clearTimeout(debounce);
    debounce = setTimeout(() => { setQuery(toolkit.query); run(); }, 150);
  }


  function onKey(e) {
    if (e.key === 'Escape') { open = false; inputEl?.blur(); return; }

    // Token-input behaviour: with nothing typed, Backspace/Delete pops the last
    // selected tag off the bar. Matches how every chip input people already use
    // behaves, so it needs no affordance to be discoverable.
    if ((e.key === 'Backspace' || e.key === 'Delete') && toolkit.query === '' && toolkit.tags.length) {
      e.preventDefault();
      popTag();
      run();
      return;
    }
    if (!hasPanel) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(cursor + 1, results.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(cursor - 1, -1); }
    else if (e.key === 'Enter' && cursor >= 0 && results[cursor]) { window.location.href = results[cursor].url; }
  }

  function onDocClick(e) { if (rootEl && !rootEl.contains(e.target)) open = false; }

  // The palette and /tools/ share one state model (?q= & ?tags=), so handing off
  // is a link, not a re-query. Convergence rather than two search paradigms:
  // the palette is for jumping, the explorer is for browsing, same URL either way.
  function handoff() {
    const u = new URL('/tools/', window.location.origin);
    if (toolkit.query.trim()) u.searchParams.set('q', toolkit.query.trim());
    if (toolkit.tags.length) u.searchParams.set('tags', toolkit.tags.join(','));
    return u.pathname + u.search;
  }

  // Hydrate ONCE, at init, deliberately outside any $effect.
  //
  // This previously lived in an $effect that read toolkit.query — so every
  // keystroke re-ran it, re-read the URL, and overwrote what had just been
  // typed. On a clean URL that meant the box appeared dead; with ?q= already
  // present it appeared to work, because the value it clobbered with was the
  // one you wanted. Reading the URL is an initialisation concern, not a
  // reactive one.
  if (typeof window !== 'undefined') {
    hydrateFromUrl();
    if (toolkit.query || toolkit.tags.length) open = true;
  }

  $effect(() => {
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  });
</script>

<div class="pfs" bind:this={rootEl}>
  <div class="pfs__bar">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    {#each toolkit.tags as t}
      <TagChip tagString={t} removable onclick={() => toggle(t)} />
    {/each}
    <input
      bind:this={inputEl}
      bind:value={toolkit.query}
      oninput={onInput}
      onfocus={() => { open = true; boot(); }}
      onkeydown={onKey}
      type="search"
      {placeholder}
      aria-label="Search the toolkit"
      autocomplete="off"
    />
  </div>

  {#if hasPanel}
    <div class="pfs__panel" role="listbox">
      {#if failed}
        <p class="pfs__msg">Index unavailable — run <code>pnpm build &amp;&amp; pnpm preview</code>.</p>
      {:else}
        {#if tagMatches.length}
          <div class="pfs__sec">
            <span class="pfs__hd">Tags</span>
            <div class="pfs__tags">
              {#each tagMatches as t}
                <TagChip tagString={t.value} count={t.count} showCount onclick={() => toggle(t.value)} />
              {/each}
            </div>
          </div>
        {/if}

        <div class="pfs__sec">
          <span class="pfs__hd">
            {searching ? 'Searching…' : `${results.length} tool${results.length === 1 ? '' : 's'}`}
            {#if toolkit.tags.length > 1}<em> · all {toolkit.tags.length} tags must match</em>{/if}
          </span>
          {#each results as r, i}
            <a class="pfs__hit" class:pfs__hit--on={i === cursor} href={r.url}>
              <strong>{r.meta?.title ?? r.url}</strong>
              {#if r.excerpt}<span class="pfs__ex">{@html r.excerpt}</span>{/if}
              {#if r.filters?.tag?.length}
                <span class="pfs__meta">{r.filters.tag.slice(0, 4).join(' · ')}</span>
              {/if}
            </a>
          {/each}
          {#if results.length}
            <a class="pfs__all" href={handoff()}>
              See all in the catalogue — filter, sort and compare →
            </a>
          {/if}
          {#if !searching && !results.length}
            <p class="pfs__msg">
              {toolkit.query.trim() || toolkit.tags.length
                ? 'Nothing matches. Try removing a tag.'
                : 'Pick a tag, or start typing.'}
            </p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Anchored spill-out panel, after the house pattern in
     ai-labs/context-vigilance-kit/splash/src/components/SearchBox.astro —
     absolute panel under the bar on desktop, fixed sheet on small screens.
     Colours come from the Tier-2 semantic tokens, never raw hex. */

  .pfs { position: relative; width: 100%; }

  .pfs__bar {
    display: flex; align-items: center; gap: .4rem; flex-wrap: wrap;
    padding: .55rem .75rem;
    border-radius: var(--radius-lg);
    border: 1px solid var(--clr-line-strong);
    background: var(--clr-surface);
    transition: border-color .15s ease;
  }
  .pfs__bar:focus-within { border-color: var(--clr-accent); }
  .pfs__bar svg { width: 16px; height: 16px; color: var(--clr-ink-faint); flex: none; }
  .pfs__bar input {
    flex: 1 1 8rem; min-width: 6rem; border: 0; background: none;
    color: var(--clr-ink); font: inherit; outline: none;
  }
  .pfs__bar input::placeholder { color: var(--clr-ink-faint); }

  .pfs__pill {
    cursor: pointer; font: inherit; font-size: .78rem; padding: .1rem .5rem;
    border-radius: 999px; border: 0;
    background: var(--clr-accent); color: var(--clr-accent-ink);
  }

  .pfs__panel {
    position: absolute; left: 0; right: 0; top: calc(100% + .45rem); z-index: 80;
    max-height: min(60vh, 30rem); overflow-y: auto;
    padding: .5rem;
    border-radius: var(--radius-lg);
    background: var(--clr-ground-raised);
    border: 1px solid var(--clr-line-strong);
    box-shadow: 0 18px 50px var(--clr-shadow);
  }

  .pfs__sec + .pfs__sec {
    margin-top: .5rem; padding-top: .5rem;
    border-top: 1px solid var(--clr-line);
  }
  .pfs__hd {
    display: block; font-size: .68rem; text-transform: uppercase;
    letter-spacing: .09em; color: var(--clr-ink-faint);
    padding: .2rem .35rem .35rem;
  }
  .pfs__hd em { font-style: normal; text-transform: none; letter-spacing: 0; color: var(--clr-ink-muted); }

  .pfs__tags { display: flex; flex-wrap: wrap; gap: .35rem; padding: 0 .35rem .2rem; }
  .pfs__tag {
    cursor: pointer; font: inherit; font-size: .8rem; padding: .15rem .55rem;
    border-radius: 999px; border: 1px solid var(--clr-line-strong);
    background: var(--clr-chip); color: var(--clr-chip-ink);
  }
  .pfs__tag:hover { border-color: var(--clr-accent); color: var(--clr-ink); }
  .pfs__tag span { color: var(--clr-ink-faint); font-size: .8em; margin-left: .3rem; }

  .pfs__hit {
    display: block; padding: .4rem .35rem; border-radius: var(--radius-sm);
    text-decoration: none; color: var(--clr-ink);
  }
  .pfs__hit:hover, .pfs__hit--on { background: var(--clr-surface-hover); }
  .pfs__hit strong { display: block; font-size: .92rem; }
  .pfs__ex { display: block; font-size: .8rem; color: var(--clr-ink-muted); margin-top: .1rem; }
  .pfs__meta { display: block; font-size: .7rem; color: var(--clr-ink-faint); margin-top: .15rem; }
  .pfs__msg { padding: .5rem .35rem; font-size: .84rem; color: var(--clr-ink-muted); }

  /* Pagefind returns excerpts containing <mark>. Those arrive through {@html},
     which Svelte's scoped styles cannot reach — hence :global(). Left alone the
     browser default paints them bright yellow, which is not a colour this brand
     owns. Tint with the house accent instead. */
  .pfs__ex :global(mark),
  .pfs__hit :global(mark) {
    background: color-mix(in oklab, var(--clr-accent) 22%, transparent);
    color: var(--clr-ink);
    border-radius: 2px;
    padding: 0 .15em;
    font-weight: 600;
  }
  .pfs__all { display: block; margin-top: .35rem; padding: .45rem .35rem;
    font-size: .82rem; color: var(--clr-accent); text-decoration: none;
    border-top: 1px solid var(--clr-line); }
  .pfs__all:hover { background: var(--clr-surface-hover); }

  /* Small screens: the panel becomes a sheet rather than a dropdown. */
  @media (max-width: 720px) {
    .pfs__panel {
      position: fixed; inset: auto .5rem .5rem .5rem; top: auto;
      max-height: 70vh;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pfs__bar { transition: none; }
  }
</style>
