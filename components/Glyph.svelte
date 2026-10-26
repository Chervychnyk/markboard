<script lang="ts">
  export type GlyphName =
    | 'search' | 'note' | 'tabs' | 'more' | 'chevron' | 'chevron-left' | 'star' | 'star-fill' | 'bell'
    | 'trash' | 'folder' | 'sessions' | 'check' | 'external' | 'grid' | 'masonry' | 'extended' | 'list'
    | 'x' | 'plus' | 'sliders' | 'panel' | 'eye' | 'eye-off' | 'tag' | 'swatch' | 'pin' | 'comment'
    | 'clock' | 'calendar' | 'hash' | 'copy' | 'up' | 'down' | 'left' | 'right' | 'settings'
    | 'sun' | 'moon' | 'monitor' | 'contrast' | 'layers' | 'archive' | 'keyboard' | 'slash' | 'sort';

  let { name, size = 16, stroke = 1.6 }: { name: GlyphName; size?: number; stroke?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'search'}
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.4 4.4" />
  {:else if name === 'note'}
    <path d="M5.5 3.5h8.2L19 8.8v11.7h-13.5z" />
    <path d="M13.4 3.7v5.2h5.3M8.5 12.5h7M8.5 15.7h5" />
  {:else if name === 'tabs'}
    <path d="M4 8.6A2.6 2.6 0 0 1 6.6 6H16v10.4a2.6 2.6 0 0 1-2.6 2.6H6.6A2.6 2.6 0 0 1 4 16.4z" />
    <path d="M8 6V5.6A2.6 2.6 0 0 1 10.6 3H18a2 2 0 0 1 2 2v9.6a2.6 2.6 0 0 1-2.6 2.6H19" />
  {:else if name === 'more'}
    <g fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="1.45" /><circle cx="12" cy="12" r="1.45" /><circle cx="12" cy="19" r="1.45" />
    </g>
  {:else if name === 'chevron'}
    <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
  {:else if name === 'chevron-left'}
    <path d="m14.5 6.5-5.5 5.5 5.5 5.5" />
  {:else if name === 'star' || name === 'star-fill'}
    <path d="M12 3.9l2.5 5.07 5.6.82-4.05 3.94.96 5.57L12 16.66l-5.01 2.64.96-5.57L3.9 9.79l5.6-.82z"
      fill={name === 'star-fill' ? 'currentColor' : 'none'} />
  {:else if name === 'bell'}
    <path d="M6 8.2a6 6 0 0 1 12 0c0 6.8 2.7 8.6 2.7 8.6H3.3S6 15 6 8.2" />
    <path d="M10.3 20.3a1.95 1.95 0 0 0 3.4 0" />
  {:else if name === 'trash'}
    <path d="M3.5 6h17M9 6V4h6v2M18.5 6l-1 14h-11l-1-14M10 10.5v6M14 10.5v6" />
  {:else if name === 'folder'}
    <path d="M3.2 7.2A2.2 2.2 0 0 1 5.4 5h4l2 2h7.2a2.2 2.2 0 0 1 2.2 2.2v8.6a2.2 2.2 0 0 1-2.2 2.2H5.4a2.2 2.2 0 0 1-2.2-2.2z" />
  {:else if name === 'sessions'}
    <rect x="3.2" y="4.3" width="17.6" height="15.4" rx="2" />
    <path d="M3.2 8.7h17.6" />
    <circle cx="6.3" cy="6.5" r=".7" fill="currentColor" stroke="none" />
    <circle cx="8.8" cy="6.5" r=".7" fill="currentColor" stroke="none" />
  {:else if name === 'check'}
    <path d="m4.5 12.4 5 5L20 6.6" />
  {:else if name === 'external'}
    <path d="M14 4h6v6M20 4l-9.5 9.5" />
    <path d="M19.5 14.2v4.3a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8V6.1a1.8 1.8 0 0 1 1.8-1.8h4.4" />
  {:else if name === 'grid'}
    <rect x="3.6" y="3.6" width="7" height="7" rx="1" /><rect x="13.4" y="3.6" width="7" height="7" rx="1" />
    <rect x="3.6" y="13.4" width="7" height="7" rx="1" /><rect x="13.4" y="13.4" width="7" height="7" rx="1" />
  {:else if name === 'masonry'}
    <rect x="3.5" y="4.5" width="5" height="7.5" rx="1" /><rect x="3.5" y="14.5" width="5" height="5" rx="1" />
    <rect x="9.5" y="4.5" width="5" height="5" rx="1" /><rect x="9.5" y="12" width="5" height="7.5" rx="1" />
    <rect x="15.5" y="4.5" width="5" height="10" rx="1" /><rect x="15.5" y="17" width="5" height="2.5" rx="1" />
  {:else if name === 'extended'}
    <rect x="3.4" y="4.2" width="17.2" height="15.6" rx="2" />
    <path d="M3.4 9.1h17.2M8 13.5h8M8 16.3h5" />
  {:else if name === 'list'}
    <path d="M8 6h12M8 12h12M8 18h12" />
    <g fill="currentColor" stroke="none"><circle cx="4.4" cy="6" r=".9" /><circle cx="4.4" cy="12" r=".9" /><circle cx="4.4" cy="18" r=".9" /></g>
  {:else if name === 'x'}
    <path d="m6 6 12 12M18 6 6 18" />
  {:else if name === 'plus'}
    <path d="M12 5v14M5 12h14" />
  {:else if name === 'sliders'}
    <path d="M4 7h5M13 7h7M4 12h10M18 12h2M4 17h2M10 17h10" />
    <circle cx="11" cy="7" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="17" r="2" />
  {:else if name === 'panel'}
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M14.5 4.5v15" />
  {:else if name === 'eye'}
    <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  {:else if name === 'eye-off'}
    <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
    <path d="M9.4 5.8A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4.2M6.2 6.3C3.9 8.1 2.5 12 2.5 12s3.5 6.5 9.5 6.5a10 10 0 0 0 4.2-.9" />
  {:else if name === 'tag'}
    <path d="M20.4 13.4l-7 7a2 2 0 0 1-2.8 0L3.5 13.3V4.5h8.8l8.1 6.1a2 2 0 0 1 0 2.8z" />
    <circle cx="8" cy="9" r="1.2" fill="currentColor" stroke="none" />
  {:else if name === 'swatch'}
    <circle cx="13.5" cy="6.5" r=".8" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".8" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".8" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".8" fill="currentColor" />
    <path d="M12 3a9 9 0 1 0 0 18 1.8 1.8 0 0 0 1.8-1.8c0-.45-.17-.86-.45-1.18-.29-.32-.45-.72-.45-1.17a1.8 1.8 0 0 1 1.8-1.8H16a5 5 0 0 0 5-5c0-4.42-4.03-8.05-9-8.05z" />
  {:else if name === 'pin'}
    <path d="M9 4h6l-1 6 3 2.5v1.5H7v-1.5L10 10 9 4zM12 14v6" />
  {:else if name === 'comment'}
    <path d="M4 5.5A2 2 0 0 1 6 3.5h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4.5 3.8V16.5H6a2 2 0 0 1-2-2z" />
  {:else if name === 'clock'}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.2V12l3.2 2" />
  {:else if name === 'calendar'}
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" />
  {:else if name === 'hash'}
    <path d="M4.5 9.5h15M4.5 14.5h15M9.5 4.5l-1.5 15M16 4.5l-1.5 15" />
  {:else if name === 'copy'}
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M5.5 15.5h-1a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4.5 3.5h9A1.5 1.5 0 0 1 15 5v1" />
  {:else if name === 'up'}
    <path d="m6.5 14.5 5.5-5.5 5.5 5.5" />
  {:else if name === 'down'}
    <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
  {:else if name === 'left'}
    <path d="m14.5 6.5-5.5 5.5 5.5 5.5" />
  {:else if name === 'right'}
    <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />
  {:else if name === 'settings'}
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.02 1.41 1.09H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  {:else if name === 'sun'}
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  {:else if name === 'moon'}
    <path d="M20.4 14.5A8 8 0 0 1 9.5 3.6a8.2 8.2 0 1 0 10.9 10.9z" />
  {:else if name === 'monitor'}
    <rect x="3" y="4" width="18" height="12.5" rx="2" />
    <path d="M8.5 20h7M12 16.5V20" />
  {:else if name === 'contrast'}
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
  {:else if name === 'layers'}
    <path d="m12 3.5 8.5 4.7L12 13 3.5 8.2zM3.5 12.2 12 17l8.5-4.8M3.5 16.2 12 21l8.5-4.8" />
  {:else if name === 'archive'}
    <rect x="3" y="4" width="18" height="4.5" rx="1" />
    <path d="M5 8.5v10a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-10M10 12.5h4" />
  {:else if name === 'keyboard'}
    <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
    <path d="M6.5 9.5h1M10 9.5h1M13.5 9.5h1M17 9.5h.5M6.5 12.5h1M10 12.5h4M17 12.5h.5M8 15.5h8" />
  {:else if name === 'slash'}
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6 6 12 12" />
  {:else if name === 'sort'}
    <path d="M7 4.5v15M4 16.5l3 3 3-3M17 19.5v-15M14 7.5l3-3 3 3" />
  {/if}
</svg>
