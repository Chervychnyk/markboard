<script lang="ts">
  import { t } from '@/lib/i18n';
  import { allTags, clearFilters, COLORS, hasActiveFilter, ui } from '@/lib/store.svelte';
  import Glyph from './Glyph.svelte';

  let open = $state(false);
  const tags = $derived(allTags());
  const count = $derived(Number(ui.filterFav) + Number(!!ui.filterColor) + Number(!!ui.filterTag));

  function close(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    e.stopPropagation(); // the board's Escape would clear the filters too
    open = false;
  }
</script>

<div class="filter">
  <button
    type="button"
    class="tool-icon filter-btn"
    class:on={hasActiveFilter()}
    aria-expanded={open}
    aria-haspopup="dialog"
    title={t('Filter')}
    aria-label={t('Filter')}
    onclick={() => (open = !open)}
  >
    <Glyph name="sliders" size={15} />
    {#if count}<span class="filter-count">{count}</span>{/if}
  </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="filter-backdrop" onclick={() => (open = false)}></div>
    <div class="filter-pop" role="dialog" tabindex="-1" aria-label={t('Filter')} onkeydown={close}>
      <button type="button" class="filter-row" class:on={ui.filterFav} aria-pressed={ui.filterFav} onclick={() => (ui.filterFav = !ui.filterFav)}>
        <Glyph name={ui.filterFav ? 'star-fill' : 'star'} size={14} />
        <span class="grow">{t('Favorites')}</span>
        {#if ui.filterFav}<Glyph name="check" size={14} />{/if}
      </button>

      <div class="filter-label">{t('Color label')}</div>
      <div class="im-swatches" role="group" aria-label={t('Color label')}>
        {#each COLORS as c (c)}
          <button
            type="button"
            class="im-swatch {c ? 'sw-' + c : 'sw-none'}"
            class:on={ui.filterColor === c}
            title={c || t('None')}
            aria-label={c || t('None')}
            aria-pressed={ui.filterColor === c}
            onclick={() => (ui.filterColor = c)}
          >
            {#if !c}<Glyph name="slash" size={13} />{/if}
          </button>
        {/each}
      </div>

      {#if tags.length}
        <div class="filter-label">{t('Tags')}</div>
        <div class="filter-tags">
          {#each tags as tag (tag)}
            <button type="button" class="im-tag" class:on={ui.filterTag === tag} aria-pressed={ui.filterTag === tag} onclick={() => (ui.filterTag = ui.filterTag === tag ? '' : tag)}>
              #{tag}
            </button>
          {/each}
        </div>
      {/if}

      {#if hasActiveFilter()}
        <button type="button" class="btn sm filter-clear" onclick={clearFilters}>{t('Clear filters')}</button>
      {/if}
    </div>
  {/if}
</div>
