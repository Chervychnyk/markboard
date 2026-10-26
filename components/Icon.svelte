<script lang="ts">
  import { favicon } from '@/lib/core';
  import { metaOf } from '@/lib/store.svelte';
  import type { Meta, Row } from '@/lib/types';
  import Glyph from './Glyph.svelte';

  let { n, m }: { n: Row; m?: Meta } = $props();
  const icon = $derived((m ?? metaOf(n)).icon);
</script>

{#if icon}<span class="ico">{icon}</span>
{:else if n.url}<img class="ico" src={favicon(n.url)} alt="" loading="lazy" decoding="async" />
{:else}<span class="ico"><Glyph name="folder" size={15} /></span>{/if}
