<script lang="ts">
  import { dialogs, drop, note, type Dialog, type Field, type FormField } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import Glyph from './Glyph.svelte';

  const isField = (f: FormField): f is Field => !('heading' in f);
  const wide = (f: Field) => f.type === 'textarea' || f.type === 'file' || f.type === 'range';

  // Inputs are uncontrolled (values read on close): a re-render must not reset what the user typed.
  function closeForm(d: Extract<Dialog, { kind: 'form' }>, dlg: HTMLDialogElement) {
    const els = dlg.querySelector('form')!.elements;
    const read = (f: Field) => {
      const el = els.namedItem(f.name) as HTMLInputElement;
      return f.type === 'checkbox' ? el.checked : f.type === 'file' ? el.files?.[0] : el.value;
    };
    const values = dlg.returnValue === 'ok' ? Object.fromEntries(d.fields.filter(isField).map((f) => [f.name, read(f)])) : null;
    drop(d);
    d.resolve(values as never);
  }

  const extra = (e: Event, run: () => void) => {
    (e.currentTarget as Element).closest('dialog')!.close();
    run();
  };
</script>

{#each dialogs as d (d.id)}
  {#if d.kind === 'form'}
    <dialog {@attach (el) => el.showModal()} onclose={(e) => closeForm(d, e.currentTarget)}>
      <form method="dialog" class="dialog-form">
        <header class="dialog-head">
          <h3>{d.title}</h3>
          <button type="submit" value="cancel" formnovalidate class="dialog-x" title={t('Close')} aria-label={t('Close')}>
            <Glyph name="x" size={15} />
          </button>
        </header>
        <div class="dialog-body">
          <div class="fields">
            {#each d.fields as f, i (i)}
              {#if !isField(f)}
                <div class="field-head">{f.heading}</div>
              {:else if f.type === 'checkbox'}
                <label class="field check">
                  <input type="checkbox" name={f.name} checked={!!f.value} onchange={f.onchange} />
                  <span>{f.label}</span>
                </label>
              {:else}
                <label class="field" class:wide={wide(f)}>
                  <span>{f.label}</span>
                  {#if f.type === 'textarea'}
                    <textarea name={f.name} required={f.required} rows={4}>{f.value ?? ''}</textarea>
                  {:else if f.type === 'select'}
                    <select name={f.name} required={f.required}>
                      {#each f.options ?? [] as [v, label] (v)}
                        <option value={v} selected={v === String(f.value ?? '')}>{label ?? v}</option>
                      {/each}
                    </select>
                  {:else}
                    <input type={f.type ?? 'text'} name={f.name} required={f.required} maxlength={f.maxlength} accept={f.accept}
                      min={f.min} max={f.max} value={f.type === 'file' ? undefined : (f.value ?? '')} />
                  {/if}
                </label>
              {/if}
            {/each}
            {#if d.extra.length}
              <div class="extras">
                {#each d.extra as [label, run] (label)}<button type="button" class="btn" onclick={(e) => extra(e, run)}>{label}</button>{/each}
              </div>
            {/if}
          </div>
        </div>
        <footer class="dialog-foot">
          <button value="cancel" class="btn" formnovalidate>{t('Cancel')}</button>
          <button value="ok" class="btn primary">{t('Save')}</button>
        </footer>
      </form>
    </dialog>
  {:else if d.props?.bare}
    <dialog class="dialog-bare" {@attach (el) => el.showModal()} onclose={() => drop(d)}>
      <d.body {...d.props} close={() => drop(d)} />
    </dialog>
  {:else}
    <dialog {@attach (el) => el.showModal()} onclose={() => drop(d)}>
      <div class="dialog-form">
        <header class="dialog-head">
          <h3>{d.title}</h3>
          <button type="button" class="dialog-x" title={t('Close')} aria-label={t('Close')} onclick={(e) => e.currentTarget.closest('dialog')!.close()}>
            <Glyph name="x" size={15} />
          </button>
        </header>
        <div class="dialog-body"><d.body {...d.props} close={() => drop(d)} /></div>
        <footer class="dialog-foot">
          {#each d.buttons as [label, run] (label)}<button type="button" class="btn" onclick={(e) => extra(e, run)}>{label}</button>{/each}
          <button type="button" class="btn primary" onclick={(e) => e.currentTarget.closest('dialog')!.close()}>{t('Close')}</button>
        </footer>
      </div>
    </dialog>
  {/if}
{/each}

{#if note.v}
  {@const n = note.v}
  <div id="toast" role="status">
    {n.msg}
    {#if n.label}<button type="button" class="btn" onclick={() => { note.v = null; n.fn?.(); }}>{n.label}</button>{/if}
  </div>
{/if}
