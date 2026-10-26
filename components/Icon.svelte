<script module lang="ts">
  // Per icon URL, how it needs help on dark themes: a dark glyph on a transparent ground gets a light tile,
  // an opaque near-black square gets a faint ring so its edge shows.
  type Fix = '' | 'tile' | 'ring';
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a plain cache; `fix` carries the reactive state
  const fixes = new Map<string, Fix>();

  function measure(img: HTMLImageElement): Fix {
    try {
      const c = Object.assign(document.createElement('canvas'), { width: 16, height: 16 });
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, 16, 16);
      const px = ctx.getImageData(0, 0, 16, 16).data;
      let clear = 0, ink = 0, lum = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3]! < 24) { clear++; continue; }
        ink++;
        lum += 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!;
      }
      if (!ink || lum / ink >= 70) return '';
      return clear / 256 > 0.25 ? 'tile' : clear / 256 < 0.05 && lum / ink < 40 ? 'ring' : '';
    } catch {
      return ''; // a cross-origin icon can't be read; leave it as is
    }
  }
</script>

<script lang="ts">
  import { favicon } from '@/lib/core';
  import { metaOf } from '@/lib/store.svelte';
  import type { Meta, Row } from '@/lib/types';
  import Glyph from './Glyph.svelte';

  let { n, m }: { n: Row; m?: Meta } = $props();
  const icon = $derived((m ?? metaOf(n)).icon);
  const src = $derived(n.url ? favicon(n.url) : '');
  let fix = $derived(fixes.get(src) ?? '');

  function onload(e: Event) {
    if (!fixes.has(src)) fixes.set(src, measure(e.currentTarget as HTMLImageElement));
    fix = fixes.get(src)!;
  }
</script>

{#if icon}<span class="ico">{icon}</span>
{:else if n.url}<img class="ico" class:tiled={fix === 'tile'} class:ringed={fix === 'ring'} {src} alt="" loading="lazy" decoding="async" {onload} />
{:else}<span class="ico"><Glyph name="folder" size={15} /></span>{/if}
