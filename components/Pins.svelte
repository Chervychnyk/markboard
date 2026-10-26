<script lang="ts">
  import { data, app } from '@/lib/store.svelte';
  import Icon from './Icon.svelte';

  const pins = $derived(data.flat.filter((n) => n.url && app.meta[n.id]?.pinned));
</script>

{#if pins.length}
  <nav id="pins" aria-label="Pinned">
    {#each pins as n (n.id)}
      <a class="pin" href={n.url} title={n.url}>
        <Icon {n} />
        <span class="title">{n.title}</span>
      </a>
    {/each}
  </nav>
{/if}
