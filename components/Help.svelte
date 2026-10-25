<script lang="ts">
  import { COMMANDS } from '@/lib/commands';
  import { t } from '@/lib/i18n';
</script>

<ul class="plain">
  {#each COMMANDS.filter((c) => c.key) as c (c.id)}<li class="row"><kbd>{c.key}</kbd>{t(c.title)}</li>{/each}
</ul>
<p class="muted">{t('F opens the Tabkit palette: board commands start with “Markboard:”. Esc leaves selection mode.')}</p>
