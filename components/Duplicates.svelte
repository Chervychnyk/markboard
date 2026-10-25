<script lang="ts">
  import { data } from '@/lib/store.svelte';
  import type { BNode } from '@/lib/types';
  import Icon from './Icon.svelte';

  let { groups }: { groups: BNode[][] } = $props();
</script>

<ul class="plain">
  {#each groups as g (g[0]!.id)}
    <li class="row">
      <Icon n={g[0]!} m={{}} />
      <span class="title grow">{g[0]!.title || g[0]!.url}</span>
      <small>{g.map((n) => data.byId.get(n.parentId!)?.title).join(', ')}</small>
    </li>
  {/each}
</ul>
