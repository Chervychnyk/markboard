<script lang="ts">
  import { favicon } from '@/lib/core';
  import { metaOf } from '@/lib/store.svelte';
  import type { Meta, Row } from '@/lib/types';

  let { n, m }: { n: Row; m?: Meta } = $props();
  const icon = $derived((m ?? metaOf(n)).icon);
</script>

{#if icon}<span class="ico">{icon}</span>
{:else if n.url}<img class="ico" src={favicon(n.url)} alt="" />
{:else}<span class="ico">📁</span>{/if}
