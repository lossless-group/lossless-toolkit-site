<script>
  /**
   * TagChip — the one way a tag is drawn anywhere on this site.
   *
   * Prop API deliberately mirrors site/src/components/toolkit/TagChip.svelte so
   * the two are recognisably the same component and either can be ported onto
   * the other. Differences here: Svelte 5 runes, no debug logging, no global
   * CustomEvent side-channel, and colours from the Tier-2 semantic tokens.
   *
   * Train-Case is the storage form (`Design-Tools`); Normal Case is the display
   * form (`Design Tools`). Callers always pass the stored value — converting on
   * render means the two can never drift.
   */

  let {
    tagString,
    count = 0,
    isSelected = false,
    showCount = false,
    removable = false,
    title = '',
    onclick,
  } = $props();

  const normalCase = $derived(
    typeof tagString === 'string'
      ? tagString.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : String(tagString)
  );

  const effectiveTitle = $derived(
    title || (removable ? `Remove ${normalCase}` : `Filter by ${normalCase}`)
  );

  const ariaLabel = $derived(
    removable
      ? `Remove filter ${normalCase}`
      : `Filter by ${normalCase}${isSelected ? ' (currently selected)' : ''}`
  );

  function fire(e) {
    e.preventDefault();
    onclick?.({ tag: tagString, selected: !isSelected });
  }

  function onKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') fire(e);
  }
</script>

<span
  class="tool-tag"
  class:selected={isSelected}
  class:removable
  title={effectiveTitle}
  aria-label={ariaLabel}
  data-tag={tagString}
  data-count={count}
  role="button"
  tabindex="0"
  onclick={fire}
  onkeydown={onKeydown}
>
  <span class="tool-tag__label">{normalCase}</span>
  {#if showCount && count > 0}<span class="tool-tag__count">{count}</span>{/if}
  {#if removable}<span class="tool-tag__x" aria-hidden="true">×</span>{/if}
</span>

<style>
  .tool-tag {
    display: inline-flex; align-items: center; gap: .3em;
    white-space: nowrap; cursor: pointer;
    padding: .15em .6em; border-radius: 999px;
    background: var(--clr-chip); color: var(--clr-chip-ink);
    border: 1px solid var(--clr-line-strong);
    font-size: .8rem; line-height: 1.6;
    transition: border-color .15s ease, background .15s ease, color .15s ease;
  }
  .tool-tag:hover { border-color: var(--clr-accent); color: var(--clr-ink); }
  .tool-tag:focus-visible { outline: 2px solid var(--clr-accent); outline-offset: 2px; }
  .tool-tag__count { color: var(--clr-ink-faint); font-size: .8em; }
  .tool-tag.selected,
  .tool-tag.removable {
    background: var(--clr-accent); color: var(--clr-accent-ink); border-color: transparent;
  }
  .tool-tag.removable .tool-tag__x { font-size: 1.05em; opacity: .75; }
  .tool-tag.removable:hover .tool-tag__x { opacity: 1; }
  @media (prefers-reduced-motion: reduce) { .tool-tag { transition: none; } }
</style>
