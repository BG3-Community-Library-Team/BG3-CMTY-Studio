<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import { configStore } from "../lib/stores/configStore.svelte.js";

  let format = $derived(configStore.format);
</script>

<div class="inline-flex rounded-md overflow-hidden border border-zinc-600 text-xs font-medium" role="radiogroup" aria-label={m.format_toggle_aria()}>
  <button
    class="px-3 py-1.5 transition-colors {format === 'Yaml'
      ? 'bg-sky-600 text-white'
      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}"
    onclick={() => { if (format !== 'Yaml') configStore.toggleFormat(); }}
    role="radio"
    aria-checked={format === 'Yaml'}
  >
    {m.format_toggle_yaml()}
  </button>
  <button
    class="px-3 py-1.5 transition-colors border-l border-zinc-600 {format === 'Json'
      ? 'bg-sky-600 text-white'
      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}"
    onclick={() => { if (format !== 'Json') configStore.toggleFormat(); }}
    role="radio"
    aria-checked={format === 'Json'}
  >
    {m.format_toggle_json()}
  </button>
</div>
