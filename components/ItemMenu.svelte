<script lang="ts">
  import { toast } from '@/lib/dialogs.svelte';
  import { locale, t } from '@/lib/i18n';
  import {
    bm, closeItemMenu, COLORS, data, deleteFromMenu, folderOptions, hideFromMenu, isFav, isHidden, mark, metaOf, moveStep, setMeta, setRemind, ui,
  } from '@/lib/store.svelte';
  import Glyph from './Glyph.svelte';

  const n = $derived(ui.menuId ? data.byId.get(ui.menuId) : undefined);
  const m = $derived(n ? metaOf(n) : {});

  let subview = $state<'main' | 'remind'>('main');
  let showComment = $state(false);
  let addingTag = $state(false);
  let tagInput = $state('');
  let el = $state<HTMLElement>();
  let height = $state(390);
  // Re-measure whenever the content changes, so the menu flips above the row by its real height.
  $effect(() => {
    void subview; void showComment; // their content swaps the observed children
    if (!el) return;
    const ro = new ResizeObserver(() => (height = el!.scrollHeight)); // full content height, even while capped
    for (const c of [el, ...el.children]) ro.observe(c);
    return () => ro.disconnect();
  });

  $effect(() => {
    void ui.menuId;
    subview = 'main';
    showComment = !!(n && metaOf(n).comment);
    addingTag = false;
    tagInput = '';
  });

  const pos = $derived.by(() => {
    const r = ui.menuRect;
    if (!r) return { top: '80px', left: '80px' };
    const w = Math.min(Math.max(r.right - r.left, 308), 400, innerWidth - 24);
    const left = Math.max(12, Math.min(innerWidth - w - 12, r.left));
    const below = innerHeight - r.bottom - 18, above = r.top - 18;
    // Prefer below, then above; if neither fits, take the roomier side and scroll inside it.
    const down = height <= below || (height > above && below >= above);
    const max = Math.max(160, down ? below : above);
    const top = down ? r.bottom + 6 : r.top - 6 - Math.min(height, max);
    return { top: `${Math.round(top)}px`, left: `${Math.round(left)}px`, width: `${Math.round(w)}px`, max: `${Math.round(max)}px` };
  });

  function toLocalIso(d: Date) {
    const pad = (x: number) => String(x).padStart(2, '0'); // taste-skill-ignore: ISO date-time digits
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function presetRemind(kind: 'later' | 'tomorrow' | 'monday') {
    if (!n) return;
    const cur = new Date();
    const y = cur.getFullYear(), mo = cur.getMonth(), day = cur.getDate();
    const target = kind === 'later'
      ? new Date(cur.getTime() + 3 * 3600e3)
      : kind === 'tomorrow'
        ? new Date(y, mo, day + 1, 9, 0, 0, 0)
        : new Date(y, mo, day + (((8 - cur.getDay()) % 7) || 7), 9, 0, 0, 0);
    setRemind(n.id, toLocalIso(target));
  }

  function commitTag() {
    if (!n) return;
    const clean = tagInput.trim().replace(/^#/, '');
    if (clean) {
      const tags = [...new Set([...(m.tags ?? []), clean])];
      setMeta(n.id, { tags });
    }
    tagInput = '';
    addingTag = false;
  }

  function removeTag(tag: string) {
    if (!n) return;
    setMeta(n.id, { tags: (m.tags ?? []).filter((x) => x !== tag) });
  }

  async function onMoveFolder(e: Event & { currentTarget: HTMLSelectElement }) {
    const folderId = e.currentTarget.value;
    e.currentTarget.value = '';
    if (!n || !folderId || folderId === n.parentId) return;
    await bm.move(n.id, { parentId: folderId }).catch((err) => toast(err.message));
    closeItemMenu();
  }

  function copyUrl() {
    if (!n?.url) return;
    navigator.clipboard.writeText(n.url).then(() => toast(t('Copied')));
  }
</script>

{#if n}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="im-backdrop" onclick={closeItemMenu}></div>
  <div
    bind:this={el}
    class="item-menu"
    role="dialog"
    tabindex="-1"
    aria-label={n.title || t('Edit bookmark')}
    style:top={pos.top}
    style:left={pos.left}
    style:width={pos.width}
    style:max-height={pos.max}
    onkeydown={(e) => e.key === 'Escape' && (e.stopPropagation(), closeItemMenu())}
  >
    {#if subview === 'remind'}
      <div class="im-remind-head">
        <button type="button" class="im-back" onclick={() => (subview = 'main')}>
          <Glyph name="chevron-left" size={15} />
          <span>{t('Remind')}</span>
        </button>
        <div class="im-remind-sub">{n.title}</div>
      </div>

      <div class="im-remind-status">
        {#if m.remind}
          {t('Reminder for {0}', new Date(m.remind).toLocaleString(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}
        {:else}
          {t('Remind me at')}
        {/if}
      </div>

      <div class="im-presets">
        <button type="button" class="im-preset" onclick={() => presetRemind('tomorrow')}>
          <Glyph name="sun" size={14} /><span>{t('Tomorrow')}</span><span class="im-preset-time">09:00</span>
        </button>
        <button type="button" class="im-preset" onclick={() => presetRemind('later')}>
          <Glyph name="clock" size={14} /><span>{t('Later today')}</span><span class="im-preset-time">+3h</span>
        </button>
        <button type="button" class="im-preset" onclick={() => presetRemind('monday')}>
          <Glyph name="calendar" size={14} /><span>{t('Next week')}</span><span class="im-preset-time">Mon 09:00</span>
        </button>
      </div>

      <label class="im-date-pick">
        <span>{t('Pick a date and time')}</span>
        <input
          type="datetime-local"
          value={m.remind ?? ''}
          onchange={(e) => setRemind(n.id, e.currentTarget.value)}
        />
      </label>

      <input
        class="im-input"
        placeholder={t('Note to self…')}
        aria-label={t('Note to self…')}
        value={m.comment ?? ''}
        oninput={(e) => setMeta(n.id, { comment: e.currentTarget.value })}
      />

      <div class="im-remind-foot">
        <span class="im-saves">{t('Saves as you type')}</span>
        {#if m.remind}
          <button type="button" class="im-btn danger" onclick={() => setRemind(n.id, '')}>
            <Glyph name="trash" size={13} /><span>{t('Remove reminder')}</span>
          </button>
        {/if}
      </div>
    {:else}
      <div class="im-top">
        <div class="im-title-row">
          <input
            class="im-input grow"
            value={n.title}
            aria-label={t('Title')}
            placeholder={t('Title')}
            onchange={(e) => bm.update(n.id, { title: e.currentTarget.value }).catch((err) => toast(err.message))}
          />
          <input
            class="im-icon-input"
            value={m.icon ?? ''}
            maxlength={4}
            title={t('Custom icon (emoji or character)')}
            aria-label={t('Custom icon (emoji or character)')}
            placeholder="◇"
            oninput={(e) => setMeta(n.id, { icon: e.currentTarget.value.trim() })}
          />
          {#if n.url}
            <button type="button" class="im-icon-btn" title={t('Copy')} aria-label={t('Copy')} onclick={copyUrl}>
              <Glyph name="copy" size={14} />
            </button>
          {/if}
        </div>
        {#if n.url}
          <input
            class="im-input im-url"
            value={n.url}
            aria-label={t('URL')}
            placeholder={t('URL')}
            onchange={(e) => bm.update(n.id, { url: e.currentTarget.value }).catch((err) => toast(err.message))}
          />
        {/if}
      </div>

      <div class="im-group">
        <div class="im-label">{t('Remember')}</div>
        <div class="im-grid2">
          <button type="button" class="im-act" class:on={isFav(n.id)} onclick={() => mark('favs', [n.id], !isFav(n.id))}>
            <Glyph name={isFav(n.id) ? 'star-fill' : 'star'} size={14} /><span>{t('Favorite')}</span>
          </button>
          <button type="button" class="im-act" class:on={showComment || !!m.comment} onclick={() => (showComment = !showComment)}>
            <Glyph name="comment" size={14} /><span>{t('Comment')}</span>
          </button>
          <button type="button" class="im-act" class:on={!!m.remind} onclick={() => (subview = 'remind')}>
            <Glyph name="bell" size={14} /><span>{t('Remind')}</span>
          </button>
          <button type="button" class="im-act" class:on={m.pinned} onclick={() => setMeta(n.id, { pinned: !m.pinned })}>
            <Glyph name="pin" size={14} /><span>{t('Pin')}</span>
          </button>
        </div>
        {#if showComment}
          <textarea
            class="im-textarea"
            rows={2}
            placeholder={t('Comment (shown on hover)')}
            aria-label={t('Comment (shown on hover)')}
            value={m.comment ?? ''}
            oninput={(e) => setMeta(n.id, { comment: e.currentTarget.value })}
          ></textarea>
        {/if}
      </div>

      <div class="im-group">
        <div class="im-label">{t('Color & tags')}</div>
        <div class="im-swatches" role="group" aria-label={t('Color label')}>
          {#each COLORS as c (c)}
            <button
              type="button"
              class="im-swatch {c ? 'sw-' + c : 'sw-none'}"
              class:on={(m.color ?? '') === c}
              title={c || t('None')}
              aria-label={c || t('None')}
              aria-pressed={(m.color ?? '') === c}
              onclick={() => setMeta(n.id, { color: c })}
            >
              {#if !c}<Glyph name="slash" size={13} />{/if}
            </button>
          {/each}
        </div>
        <div class="im-tags">
          {#each m.tags ?? [] as tag (tag)}
            <button type="button" class="im-tag" onclick={() => removeTag(tag)} title={t('Remove')}>
              #{tag} <span aria-hidden="true">×</span>
            </button>
          {/each}
          {#if addingTag}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="im-tag-input"
              autofocus
              placeholder="tag…"
              bind:value={tagInput}
              onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTag(); } else if (e.key === 'Escape') { e.stopPropagation(); addingTag = false; } }}
              onblur={commitTag}
            />
          {:else}
            <button type="button" class="im-tag-add" onclick={() => (addingTag = true)}>+ {t('Tag')}</button>
          {/if}
        </div>
      </div>

      <div class="im-group">
        <div class="im-label">{t('Arrange')}</div>
        <div class="im-arrange">
          <div class="im-arrows">
            <button type="button" title={t('Move up')} aria-label={t('Move up')} onclick={() => moveStep(n.id, 'up')}><Glyph name="up" size={14} /></button>
            <button type="button" title={t('Move down')} aria-label={t('Move down')} onclick={() => moveStep(n.id, 'down')}><Glyph name="down" size={14} /></button>
            <button type="button" title={t('Move left')} aria-label={t('Move left')} onclick={() => moveStep(n.id, 'left')}><Glyph name="left" size={14} /></button>
            <button type="button" title={t('Move right')} aria-label={t('Move right')} onclick={() => moveStep(n.id, 'right')}><Glyph name="right" size={14} /></button>
          </div>
          <div class="im-move menu-select">
            <Glyph name="folder" size={14} />
            <span>{t('Move to…')}</span>
            <select aria-label={t('Move to folder')} onchange={onMoveFolder}>
              <option value="" hidden>{t('Move to…')}</option>
              {#each folderOptions().filter(([id]) => id !== n.id) as [id, label] (id)}
                <option value={id}>{label}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <div class="im-foot">
        <div class="im-foot-btns">
          <button type="button" class="im-btn" onclick={hideFromMenu}>
            <Glyph name={isHidden(n.id) ? 'eye' : 'eye-off'} size={14} />
            <span>{isHidden(n.id) ? t('Show') : t('Hide')}</span>
            <kbd>H</kbd>
          </button>
          <button
            type="button"
            class="im-btn danger"
            title={t('Shared across workspaces: deleting removes it everywhere. Hide it to keep it in just this one')}
            onclick={deleteFromMenu}
          >
            <Glyph name="trash" size={14} />
            <span>{t('Delete')}</span>
            <kbd>Del</kbd>
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}
