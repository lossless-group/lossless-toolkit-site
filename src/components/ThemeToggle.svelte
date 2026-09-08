<script>
  /**
   * ISLAND 2 — Mode switcher. `client:idle`.
   *
   * Why it earns its JS: mode is a persisted, cross-page user preference, and
   * there is no CSS-only way to persist a three-way choice. It is ~1 KB and
   * hydrates at idle, after everything that matters has painted.
   *
   * What it deliberately does NOT do: apply the mode on load. That happens in a
   * blocking inline script in Base.astro, because an island hydrates after first
   * paint and would flash the wrong theme on every navigation.
   */
  const MODES = /** @type {const} */ (['light', 'dark', 'vibrant']);
  const LABEL = { light: 'Light', dark: 'Dark', vibrant: 'Vibrant' };
  const GLYPH = { light: '☀', dark: '☾', vibrant: '✦' };

  let mode = $state('dark');
  let open = $state(false);

  $effect(() => {
    const current = document.documentElement.dataset.mode;
    if (current && MODES.includes(current)) mode = current;
  });

  function set(next) {
    mode = next;
    document.documentElement.dataset.mode = next;
    try {
      localStorage.setItem('ltk:mode', next);
    } catch {}
    open = false;
  }
</script>

<div class="modes" role="group" aria-label="Colour mode">
  <button
    class="trigger"
    aria-expanded={open}
    aria-haspopup="true"
    onclick={() => (open = !open)}
    title="Colour mode"
  >
    <span aria-hidden="true">{GLYPH[mode]}</span>
    <span class="sr">Colour mode: {LABEL[mode]}</span>
  </button>

  {#if open}
    <ul class="menu">
      {#each MODES as m}
        <li>
          <button class:active={m === mode} onclick={() => set(m)}>
            <span aria-hidden="true">{GLYPH[m]}</span> {LABEL[m]}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .modes { position: relative; }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .trigger {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    border: 1px solid var(--clr-line);
    background: var(--clr-surface);
    color: var(--clr-ink);
    cursor: pointer;
    font-size: 0.95rem;
    line-height: 1;
  }
  .trigger:hover { border-color: var(--clr-line-strong); }
  .menu {
    position: absolute;
    inset-inline-end: 0;
    top: calc(100% + 0.4rem);
    margin: 0;
    padding: 0.25rem;
    list-style: none;
    background: var(--clr-ground-raised);
    border: 1px solid var(--clr-line);
    border-radius: var(--radius-sm);
    box-shadow: 0 12px 32px -18px var(--clr-shadow);
    min-width: 8.5rem;
    z-index: 40;
  }
  .menu button {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    padding: 0.35rem 0.5rem;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--clr-ink-muted);
    font: inherit;
    font-size: var(--step--1);
    cursor: pointer;
    text-align: start;
  }
  .menu button:hover { background: var(--clr-surface-hover); color: var(--clr-ink); }
  .menu button.active { color: var(--clr-accent); }
</style>
