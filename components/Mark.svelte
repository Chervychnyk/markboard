<script lang="ts">
  let { size = 20 }: { size?: number } = $props();
</script>

<!-- Three board columns; the right one is a bookmark ribbon. -->
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <rect x="3" y="3.2" width="4.6" height="17.6" rx="1.3" fill="currentColor" />
  <rect x="9.7" y="3.2" width="4.6" height="12.2" rx="1.3" fill="currentColor" />
  <path d="M16.4 3.2h4.6v16.6l-2.3-2-2.3 2z" fill="currentColor" />
</svg>
