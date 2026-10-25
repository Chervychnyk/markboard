<script lang="ts">
  import { dialogs, drop, note, type Dialog, type Field, type FormField } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';

  const isField = (f: FormField): f is Field => !('heading' in f);

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
      <form method="dialog">
        <h3>{d.title}</h3>
        {#each d.fields as f, i (i)}
          {#if !isField(f)}
            <h4>{f.heading}</h4>
          {:else}
            <label class={f.type === 'checkbox' ? 'check' : null}>
              {f.label}
              {#if f.type === 'textarea'}
                <textarea name={f.name} required={f.required} rows={4}>{f.value ?? ''}</textarea>
              {:else if f.type === 'select'}
                <select name={f.name} required={f.required}>
                  {#each f.options ?? [] as [v, label] (v)}
                    <option value={v} selected={v === String(f.value ?? '')}>{label ?? v}</option>
                  {/each}
                </select>
              {:else if f.type === 'checkbox'}
                <input type="checkbox" name={f.name} checked={!!f.value} onchange={f.onchange} />
              {:else}
                <input type={f.type ?? 'text'} name={f.name} required={f.required} maxlength={f.maxlength} accept={f.accept} min={f.min} max={f.max}
                  value={f.type === 'file' ? undefined : (f.value ?? '')} />
              {/if}
            </label>
          {/if}
        {/each}
        {#if d.extra.length}
          <div class="row wrap">
            {#each d.extra as [label, run] (label)}<button type="button" class="btn" onclick={(e) => extra(e, run)}>{label}</button>{/each}
          </div>
        {/if}
        <menu>
          <button value="cancel" class="btn" formnovalidate>{t('Cancel')}</button>
          <button value="ok" class="btn primary">{t('Save')}</button>
        </menu>
      </form>
    </dialog>
  {:else}
    <dialog {@attach (el) => el.showModal()} onclose={() => drop(d)}>
      <h3>{d.title}</h3>
      <d.body {...d.props} close={() => drop(d)} />
      <menu>
        {#each d.buttons as [label, run] (label)}<button type="button" class="btn" onclick={(e) => extra(e, run)}>{label}</button>{/each}
        <button type="button" class="btn primary" onclick={(e) => e.currentTarget.closest('dialog')!.close()}>{t('Close')}</button>
      </menu>
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
