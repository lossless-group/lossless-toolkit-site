<script>
  /**
   * ISLAND 1 — the Explorer. `client:visible`.
   *
   * Why it earns its JS, stated as a falsifiable claim: the catalogue is ~1,900
   * tools across ~600 tags. Page-per-tag navigation can express exactly one
   * facet at a time, so "agentic AI tools that are also open source and that I
   * can self-host" is three round-trips and a mental join. Reactive multi-select
   * answers it in one gesture, with live counts telling you which next click is
   * even non-empty. That is a genuine interaction problem, not decoration.
   *
   * What it is careful about:
   *  - `client:visible` — it sits below the fold on the landing page, so the
   *    bundle is not fetched until it is about to be seen.
   *  - The payload is an explicit allowlist built server-side (`clientPayload`).
   *    Markdown bodies are excluded, and `for_clients` was dropped at parse
   *    time, two layers up. Nothing in this file could leak it if it tried.
   *  - Filter state is written to the URL on every change, so any view a user
   *    reaches is a link they can text to someone. See `syncUrl` below.
   */

  let { endpoint = '/api/tools.json', initial = {} } = $props();

  let tools = $state([]);
  let tagIndex = $state([]);
  let loading = $state(true);
  let failed = $state(false);

  const slugToTag = $derived(new Map(tagIndex.map((t) => [t.slug, t.tag])));
  const tagToSlug = $derived(new Map(tagIndex.map((t) => [t.tag, t.slug])));

  // One fetch, cached by the browser across every page that mounts this island.
  $effect(() => {
    let cancelled = false;
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        tools = d.tools ?? [];
        tagIndex = d.tags ?? [];
        // Tag slugs from the URL can only be resolved once the index has landed.
        const pending = [
          ...(initial.tags ?? []),
          ...(fromUrl.tagSlugs ?? []).map((s) => d.tags?.find((t) => t.slug === s)?.tag),
        ].filter(Boolean);
        if (pending.length) selected = new Set(pending);
        loading = false;
      })
      .catch(() => {
        if (!cancelled) {
          failed = true;
          loading = false;
        }
      });
    return () => {
      cancelled = true;
    };
  });

  /**
   * Initial state comes from the URL, not from props, because these pages are
   * prerendered: the same static HTML is served for `/tools/` and
   * `/tools/?tags=llm-gateways,open-source`. Reading the query string on hydrate
   * is what makes a filtered link restore the filter it advertises.
   *
   * `initial` from the server still wins where it exists — `/tags/<slug>/` is a
   * real route and passes its tag down, so that page is correct before any JS.
   */
  const fromUrl = (() => {
    if (typeof location === 'undefined') return {};
    const p = new URLSearchParams(location.search);
    const tagSlugs = (p.get('tags') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return {
      q: p.get('q') ?? '',
      cat: p.get('cat') ?? '',
      sort: p.get('sort') ?? 'depth',
      tagSlugs,
    };
  })();

  let query = $state(initial.q ?? fromUrl.q ?? '');
  let selected = $state(new Set(initial.tags ?? []));
  let category = $state(initial.cat ?? fromUrl.cat ?? '');
  let sort = $state(initial.sort ?? fromUrl.sort ?? 'depth');
  let compare = $state(new Set());
  let limit = $state(48);
  let copied = $state(false);

  const categories = $derived([...new Set(tools.map((t) => t.c))].sort());

  const needle = $derived(query.trim().toLowerCase());

  /** Everything that survives the query + category, before tag narrowing. */
  const preTag = $derived(
    tools.filter((t) => {
      if (category && t.c !== category) return false;
      if (!needle) return true;
      return needle.split(/\s+/).every((w) => t.k.includes(w));
    })
  );

  const results = $derived(
    preTag.filter((t) => {
      for (const tag of selected) if (!t.g.includes(tag)) return false;
      return true;
    })
  );

  const sorted = $derived(
    sort === 'name'
      ? [...results].sort((a, b) => a.t.localeCompare(b.t))
      : sort === 'tags'
        ? [...results].sort((a, b) => b.g.length - a.g.length || a.t.localeCompare(b.t))
        : results
  );

  /**
   * Live facet counts, computed against the CURRENT result set rather than the
   * whole corpus. This is the single most useful thing the island does: a facet
   * showing "0" is a dead end you can see before you click it.
   */
  const facets = $derived.by(() => {
    const counts = new Map();
    for (const t of results) for (const g of t.g) counts.set(g, (counts.get(g) ?? 0) + 1);
    const out = [];
    for (const f of tagIndex) {
      const n = counts.get(f.tag) ?? 0;
      if (n === 0 && !selected.has(f.tag)) continue;
      out.push({ ...f, live: n });
    }
    out.sort((a, b) => Number(selected.has(b.tag)) - Number(selected.has(a.tag)) || b.live - a.live);
    return out;
  });

  const visible = $derived(sorted.slice(0, limit));

  /**
   * Filter state -> URL. The tension this resolves: a view assembled purely in
   * the client has no address, cannot be texted to anyone, and cannot unfurl —
   * and texting one precise link is this site's primary distribution channel.
   *
   * Two-level answer:
   *   1. A single-tag view has a REAL prerendered route (`/tags/<slug>/`) with
   *      its own <title>, description and OG card. When the filter collapses to
   *      exactly one tag we swap the URL to that route, so the shared link is
   *      the server-rendered one and unfurls properly.
   *   2. Everything richer becomes `/tools/?q=&tags=&cat=`. `/tools/` is itself
   *      prerendered, so the link still unfurls (with the index card) and still
   *      restores the exact filter state on arrival. The card is generic; the
   *      page is not.
   */
  function currentPath() {
    const tags = [...selected].map((t) => tagToSlug.get(t) ?? t);
    if (tags.length === 1 && !needle && !category && sort === 'depth') return `/tags/${tags[0]}/`;
    const p = new URLSearchParams();
    if (needle) p.set('q', query.trim());
    if (tags.length) p.set('tags', tags.join(','));
    if (category) p.set('cat', category);
    if (sort !== 'depth') p.set('sort', sort);
    const qs = p.toString();
    return `/tools/${qs ? `?${qs}` : ''}`;
  }

  $effect(() => {
    if (loading || failed) return;
    const next = currentPath();
    if (location.pathname + location.search !== next) {
      history.replaceState(null, '', next);
    }
    limit;
  });

  function toggleTag(tag) {
    const s = new Set(selected);
    s.has(tag) ? s.delete(tag) : s.add(tag);
    selected = s;
    limit = 48;
  }

  function toggleCompare(slug) {
    const s = new Set(compare);
    if (s.has(slug)) s.delete(slug);
    else if (s.size < 4) s.add(slug);
    compare = s;
  }

  function reset() {
    query = '';
    selected = new Set();
    category = '';
    sort = 'depth';
    limit = 48;
  }

  async function share() {
    const url = new URL(currentPath(), location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      /* clipboard denied — the URL bar already holds the same link */
    }
  }

  const compared = $derived(tools.filter((t) => compare.has(t.s)));

  /** Human label for the current filter, in the house "X and 3 more" style. */
  const filterLabel = $derived.by(() => {
    const names = [...selected].map((t) => t.replace(/-/g, ' '));
    if (!names.length) return category || (needle ? `“${query.trim()}”` : 'Everything');
    if (names.length === 1) return names[0];
    return `${names[0]} and ${names.length - 1} more`;
  });
</script>

<section class="explorer">
  {#if failed}
    <p class="notice">
      The catalogue index could not be loaded. Every tool still has its own page — start from
      <a href="/tags/">the tag index</a>.
    </p>
  {/if}

  <div class="bar" aria-busy={loading}>
    <label class="search">
      <span class="sr">Search the toolkit</span>
      <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <input
        type="search"
        bind:value={query}
        placeholder={loading
          ? 'Loading the catalogue…'
          : `Search ${tools.length} tools — name, description, tag, domain…`}
        autocomplete="off"
        oninput={() => (limit = 48)}
      />
    </label>

    <label class="sel">
      <span class="sr">Category</span>
      <select bind:value={category} onchange={() => (limit = 48)}>
        <option value="">All categories</option>
        {#each categories as c}<option value={c}>{c}</option>{/each}
      </select>
    </label>

    <label class="sel">
      <span class="sr">Sort</span>
      <select bind:value={sort}>
        <option value="depth">Best documented</option>
        <option value="name">A–Z</option>
        <option value="tags">Most tagged</option>
      </select>
    </label>
  </div>

  <div class="status">
    <p>
      <strong>{results.length}</strong>
      {results.length === 1 ? 'tool' : 'tools'} · <span class="dim">{filterLabel}</span>
    </p>
    <div class="status__actions">
      <button class="btn" onclick={share}>{copied ? '✓ Link copied' : 'Copy shareable link'}</button>
      {#if selected.size || needle || category || sort !== 'depth'}
        <button class="btn" onclick={reset}>Clear</button>
      {/if}
    </div>
  </div>

  <div class="facets" role="group" aria-label="Filter by tag">
    {#each facets.slice(0, 60) as f (f.tag)}
      <button
        class="facet"
        class:on={selected.has(f.tag)}
        aria-pressed={selected.has(f.tag)}
        onclick={() => toggleTag(f.tag)}
      >
        {f.label}<span class="facet__n">{f.live}</span>
      </button>
    {/each}
  </div>

  {#if compared.length}
    <aside class="tray" aria-label="Comparison tray">
      <h3>Comparing {compared.length}</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Tool</th>
              <th scope="col">Category</th>
              <th scope="col">Tags</th>
              <th scope="col">Site</th>
              <th><span class="sr">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {#each compared as t (t.s)}
              <tr>
                <th scope="row"><a href={`/tools/${t.s}/`}>{t.t}</a></th>
                <td>{t.c}</td>
                <td class="dim">{t.g.slice(0, 4).map((g) => g.replace(/-/g, ' ')).join(', ') || '—'}</td>
                <td class="dim">{t.h ?? '—'}</td>
                <td><button class="x" onclick={() => toggleCompare(t.s)} aria-label={`Remove ${t.t}`}>×</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </aside>
  {/if}

  {#if visible.length}
    <div class="card-grid">
      {#each visible as t (t.s)}
        <article class="card">
          <a class="card__link" href={`/tools/${t.s}/`}>
            <div class="card__media">
              <img src={t.i} alt="" loading="lazy" decoding="async" width="1200" height="630" />
            </div>
            <div class="card__body">
              <h3 class="card__title">{t.t}</h3>
              {#if t.h}<span class="card__host">{t.h}</span>{/if}
              <p class="card__sum">{t.d}</p>
              <div class="card__tags">
                {#each t.g.slice(0, 3) as g}<span class="chip">{g.replace(/-/g, ' ')}</span>{/each}
              </div>
            </div>
          </a>
          <button
            class="pin"
            class:on={compare.has(t.s)}
            aria-pressed={compare.has(t.s)}
            onclick={() => toggleCompare(t.s)}
            title="Add to comparison"
          >
            {compare.has(t.s) ? '✓' : '+'}
          </button>
        </article>
      {/each}
    </div>

    {#if sorted.length > limit}
      <div class="more">
        <button class="btn btn--primary" onclick={() => (limit += 48)}>
          Show {Math.min(48, sorted.length - limit)} more
        </button>
      </div>
    {/if}
  {:else if loading}
    <p class="empty">Loading the catalogue…</p>
  {:else}
    <p class="empty">
      Nothing matches <strong>{filterLabel}</strong>. <button class="link" onclick={reset}>Clear the filters</button>
    </p>
  {/if}
</section>

<style>
  .explorer { display: grid; gap: 1.1rem; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .dim { color: var(--clr-ink-faint); }

  .bar { display: flex; gap: 0.6rem; flex-wrap: wrap; }
  .search {
    flex: 1 1 22rem;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.55rem 0.85rem;
    background: var(--clr-ground-raised);
    border: 1px solid var(--clr-line);
    border-radius: 999px;
    color: var(--clr-ink-faint);
  }
  .search:focus-within { border-color: var(--clr-line-strong); box-shadow: var(--glow); }
  .search input {
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--clr-ink);
    font: inherit;
    outline: none;
    min-width: 0;
  }
  .search input::-webkit-search-cancel-button { filter: invert(0.5); }

  .sel select {
    padding: 0.55rem 0.8rem;
    border-radius: 999px;
    border: 1px solid var(--clr-line);
    background: var(--clr-ground-raised);
    color: var(--clr-ink);
    font: inherit;
    font-size: var(--step--1);
  }

  .status {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    flex-wrap: wrap;
    border-block-end: 1px solid var(--clr-line);
    padding-block-end: 0.6rem;
  }
  .status p { margin: 0; font-family: var(--font-mono); font-size: var(--step--1); }
  .status strong { color: var(--clr-accent); font-size: 1.15em; }
  .status__actions { margin-inline-start: auto; display: flex; gap: 0.4rem; }
  .status__actions .btn { padding: 0.3rem 0.7rem; }

  .facets { display: flex; flex-wrap: wrap; gap: 0.35rem; max-height: 9.5rem; overflow-y: auto; }
  .facet {
    display: inline-flex;
    gap: 0.4rem;
    align-items: baseline;
    padding: 0.22rem 0.65rem;
    border-radius: 999px;
    border: 1px solid var(--clr-line);
    background: transparent;
    color: var(--clr-ink-muted);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--step--1);
    cursor: pointer;
    white-space: nowrap;
  }
  .facet:hover { border-color: var(--clr-line-strong); color: var(--clr-ink); }
  .facet.on {
    background: var(--clr-accent);
    color: var(--clr-accent-ink);
    border-color: transparent;
    font-weight: 600;
  }
  .facet__n { opacity: 0.6; font-size: 0.85em; }

  .card { position: relative; }
  .card__link { display: flex; flex-direction: column; flex: 1; color: inherit; text-decoration: none; }
  .pin {
    position: absolute;
    inset-block-start: 0.5rem;
    inset-inline-end: 0.5rem;
    width: 1.7rem;
    height: 1.7rem;
    border-radius: 999px;
    border: 1px solid var(--clr-line-strong);
    background: color-mix(in oklab, var(--clr-ground) 70%, transparent);
    backdrop-filter: blur(6px);
    color: var(--clr-ink);
    cursor: pointer;
    font-size: 0.85rem;
    line-height: 1;
  }
  .pin.on { background: var(--clr-accent); color: var(--clr-accent-ink); }

  .tray {
    background: var(--clr-ground-raised);
    border: 1px solid var(--clr-line-strong);
    border-radius: var(--radius);
    padding: 0.9rem 1rem;
  }
  .tray h3 { margin: 0 0 0.5rem; font-size: var(--step-0); font-family: var(--font-sans); }
  .tray table { width: 100%; border-collapse: collapse; font-size: var(--step--1); }
  .tray th, .tray td { text-align: start; padding: 0.35rem 0.5rem; border-block-end: 1px solid var(--clr-line); }
  .x { border: 0; background: transparent; color: var(--clr-ink-faint); cursor: pointer; font-size: 1.1rem; }

  .more { display: grid; place-items: center; padding-block: 1rem; }
  .empty { padding-block: 3rem; text-align: center; color: var(--clr-ink-muted); }
  .link { border: 0; background: transparent; color: var(--clr-accent); font: inherit; cursor: pointer; text-decoration: underline; }

  @container (min-width: 340px) {
    .card__title { font-size: var(--step-1); }
  }
</style>
