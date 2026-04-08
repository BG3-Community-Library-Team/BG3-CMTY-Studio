<!--
  SeTestGuidePanel: Step-by-step guide for manual Script Extender test setup.
  Provides collapsible sections with personalized code snippets and copy-to-clipboard.
-->
<script lang="ts">
  import { m } from "../paraglide/messages.js";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import ExternalLink from "@lucide/svelte/icons/external-link";

  interface Props {
    modName?: string;
    modFolder?: string;
    modUuid?: string;
  }

  let { modName = "MyMod", modFolder = "MyModFolder", modUuid = "00000000-0000-0000-0000-000000000000" }: Props = $props();

  let openSections: Record<string, boolean> = $state({});
  let copiedKey: string | null = $state(null);

  function toggle(key: string): void {
    openSections[key] = !openSections[key];
  }

  async function copyToClipboard(text: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      copiedKey = key;
      setTimeout(() => { copiedKey = null; }, 2000);
    } catch {
      // Clipboard API not available
    }
  }

  let configSnippet = $derived(`{
  "SchemaVersion": 1,
  "ModTable": "${modName}",
  "Mods": [
    {
      "UUID": "${modUuid}",
      "ModName": "${modName}",
      "ModFolder": "${modFolder}"
    }
  ]
}`);

  let bootstrapSnippet = $derived(`-- ${modName} BootstrapServer.lua
Ext.Utils.Print("============================")
Ext.Utils.Print("  ${modName} loaded!")
Ext.Utils.Print("  UUID: ${modUuid}")
Ext.Utils.Print("============================")

-- Add your server-side scripts here
Ext.Events.SessionLoaded:Add(function()
    Ext.Utils.Print("[${modName}] Session loaded successfully")
end)`);

  let assertionSnippet = $derived(`-- Example: Check if a passive was applied
local function CheckPassive(charGuid, passiveName)
    local entity = Ext.Entity.Get(charGuid)
    if entity and entity.PassiveContainer then
        for _, p in ipairs(entity.PassiveContainer.Passives) do
            if p.Passive.PassiveId == passiveName then
                Ext.Utils.Print("[${modName}] PASS: " .. passiveName .. " found on entity")
                return true
            end
        end
    end
    Ext.Utils.Print("[${modName}] FAIL: " .. passiveName .. " NOT found on entity")
    return false
end

-- Usage in SessionLoaded:
Ext.Events.SessionLoaded:Add(function()
    -- Replace with your target character and passive
    CheckPassive("S_Player_eb44de19-dfc6-b48c-ae1f-0fe1e4b2045b", "YourPassiveName")
end)`);

  let consoleConfigSnippet = $derived(`{
  "CreateConsole": true,
  "LogDirectory": "Script Extender Logs",
  "LogLevel": "INFO"
}`);
</script>

<div class="h-full overflow-y-auto scrollbar-thin bg-[var(--th-bg-900)]">
  <div class="px-4 pt-3 pb-2">
    <h2 class="text-sm font-semibold tracking-wide uppercase text-[var(--th-text-primary,var(--th-text-200))]">{m.se_test_guide_title()}</h2>
  </div>

  <div class="px-3 pb-4 space-y-1">

    <!-- Section 1: Installing Script Extender -->
    <div class="rounded border border-[var(--th-border-subtle,var(--th-border-700))]">
      <button
        class="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--th-text-primary,var(--th-text-200))] hover:bg-[var(--th-bg-800)] rounded-t transition-colors text-left"
        onclick={() => toggle("s1")}
        aria-expanded={!!openSections["s1"]}
        aria-controls="se-guide-s1"
      >
        {#if openSections["s1"]}
          <ChevronDown size={16} class="shrink-0 opacity-60" />
        {:else}
          <ChevronRight size={16} class="shrink-0 opacity-60" />
        {/if}
        {m.se_test_guide_section1_title()}
      </button>
      {#if openSections["s1"]}
        <div id="se-guide-s1" class="px-4 pb-3 text-sm text-[var(--th-text-secondary,var(--th-text-300))] space-y-2">
          <p>{m.se_test_guide_section1_desc()}</p>
          <a
            href="https://www.nexusmods.com/baldursgate3/mods/2172"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-[var(--th-accent-500,#0ea5e9)] hover:underline"
          >
            {m.se_test_guide_nexus_link()}
            <ExternalLink size={12} class="shrink-0" />
          </a>
          <h4 class="font-medium text-[var(--th-text-primary,var(--th-text-200))] pt-1">Installation methods:</h4>
          <ul class="list-disc list-inside space-y-1 text-xs">
            <li><strong>Manual:</strong> Extract the SE zip into your BG3 <code class="bg-[var(--th-bg-700)] px-1 rounded text-[var(--th-text-primary,var(--th-text-200))]">bin/</code> folder</li>
            <li><strong>Vortex:</strong> Install the SE mod through Vortex like any other mod</li>
            <li><strong>BG3MM:</strong> Drag the .zip into BG3 Mod Manager</li>
          </ul>
        </div>
      {/if}
    </div>

    <!-- Section 2: Setting up Config.json -->
    <div class="rounded border border-[var(--th-border-subtle,var(--th-border-700))]">
      <button
        class="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--th-text-primary,var(--th-text-200))] hover:bg-[var(--th-bg-800)] rounded-t transition-colors text-left"
        onclick={() => toggle("s2")}
        aria-expanded={!!openSections["s2"]}
        aria-controls="se-guide-s2"
      >
        {#if openSections["s2"]}
          <ChevronDown size={16} class="shrink-0 opacity-60" />
        {:else}
          <ChevronRight size={16} class="shrink-0 opacity-60" />
        {/if}
        {m.se_test_guide_section2_title()}
      </button>
      {#if openSections["s2"]}
        <div id="se-guide-s2" class="px-4 pb-3 text-sm text-[var(--th-text-secondary,var(--th-text-300))] space-y-2">
          <p>Use the Config Editor above to create or edit your Config.json. The expected structure for <strong class="text-[var(--th-text-primary,var(--th-text-200))]">{modName}</strong>:</p>
          <div class="relative">
            <pre class="bg-[var(--th-bg-700)] rounded p-3 text-xs overflow-x-auto text-[var(--th-text-primary,var(--th-text-200))]"><code>{configSnippet}</code></pre>
            <button
              class="absolute top-2 right-2 p-1 rounded hover:bg-[var(--th-bg-800)] text-[var(--th-text-secondary,var(--th-text-400))] transition-colors"
              onclick={() => copyToClipboard(configSnippet, "config")}
              aria-label={m.common_copy()}
            >
              {#if copiedKey === "config"}
                <Check size={14} class="text-emerald-400" />
              {:else}
                <Copy size={14} />
              {/if}
            </button>
          </div>
          <p class="text-xs">Place this at <code class="bg-[var(--th-bg-700)] px-1 rounded text-[var(--th-text-primary,var(--th-text-200))]">Mods/{modFolder}/ScriptExtender/Config.json</code></p>
        </div>
      {/if}
    </div>

    <!-- Section 3: Creating BootstrapServer.lua -->
    <div class="rounded border border-[var(--th-border-subtle,var(--th-border-700))]">
      <button
        class="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--th-text-primary,var(--th-text-200))] hover:bg-[var(--th-bg-800)] rounded-t transition-colors text-left"
        onclick={() => toggle("s3")}
        aria-expanded={!!openSections["s3"]}
        aria-controls="se-guide-s3"
      >
        {#if openSections["s3"]}
          <ChevronDown size={16} class="shrink-0 opacity-60" />
        {:else}
          <ChevronRight size={16} class="shrink-0 opacity-60" />
        {/if}
        {m.se_test_guide_section3_title()}
      </button>
      {#if openSections["s3"]}
        <div id="se-guide-s3" class="px-4 pb-3 text-sm text-[var(--th-text-secondary,var(--th-text-300))] space-y-2">
          <p>Create <code class="bg-[var(--th-bg-700)] px-1 rounded text-[var(--th-text-primary,var(--th-text-200))]">Mods/{modFolder}/ScriptExtender/Lua/BootstrapServer.lua</code>:</p>
          <div class="relative">
            <pre class="bg-[var(--th-bg-700)] rounded p-3 text-xs overflow-x-auto text-[var(--th-text-primary,var(--th-text-200))]"><code>{bootstrapSnippet}</code></pre>
            <button
              class="absolute top-2 right-2 p-1 rounded hover:bg-[var(--th-bg-800)] text-[var(--th-text-secondary,var(--th-text-400))] transition-colors"
              onclick={() => copyToClipboard(bootstrapSnippet, "bootstrap")}
              aria-label={m.common_copy()}
            >
              {#if copiedKey === "bootstrap"}
                <Check size={14} class="text-emerald-400" />
              {:else}
                <Copy size={14} />
              {/if}
            </button>
          </div>
          <p class="text-xs"><code class="bg-[var(--th-bg-700)] px-1 rounded text-[var(--th-text-primary,var(--th-text-200))]">Ext.Utils.Print()</code> writes to the SE console — use it for debugging and test output.</p>
        </div>
      {/if}
    </div>

    <!-- Section 4: Writing Test Assertions -->
    <div class="rounded border border-[var(--th-border-subtle,var(--th-border-700))]">
      <button
        class="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--th-text-primary,var(--th-text-200))] hover:bg-[var(--th-bg-800)] rounded-t transition-colors text-left"
        onclick={() => toggle("s4")}
        aria-expanded={!!openSections["s4"]}
        aria-controls="se-guide-s4"
      >
        {#if openSections["s4"]}
          <ChevronDown size={16} class="shrink-0 opacity-60" />
        {:else}
          <ChevronRight size={16} class="shrink-0 opacity-60" />
        {/if}
        {m.se_test_guide_section4_title()}
      </button>
      {#if openSections["s4"]}
        <div id="se-guide-s4" class="px-4 pb-3 text-sm text-[var(--th-text-secondary,var(--th-text-300))] space-y-2">
          <p>Use <code class="bg-[var(--th-bg-700)] px-1 rounded text-[var(--th-text-primary,var(--th-text-200))]">Ext.Utils.Print()</code> with PASS/FAIL prefixes to create simple test assertions:</p>
          <div class="relative">
            <pre class="bg-[var(--th-bg-700)] rounded p-3 text-xs overflow-x-auto text-[var(--th-text-primary,var(--th-text-200))]"><code>{assertionSnippet}</code></pre>
            <button
              class="absolute top-2 right-2 p-1 rounded hover:bg-[var(--th-bg-800)] text-[var(--th-text-secondary,var(--th-text-400))] transition-colors"
              onclick={() => copyToClipboard(assertionSnippet, "assertion")}
              aria-label={m.common_copy()}
            >
              {#if copiedKey === "assertion"}
                <Check size={14} class="text-emerald-400" />
              {:else}
                <Copy size={14} />
              {/if}
            </button>
          </div>
          <p class="text-xs">Look for <code class="bg-[var(--th-bg-700)] px-1 rounded text-[var(--th-text-primary,var(--th-text-200))]">[{modName}] PASS:</code> or <code class="bg-[var(--th-bg-700)] px-1 rounded text-[var(--th-text-primary,var(--th-text-200))]">[{modName}] FAIL:</code> in the SE console output.</p>
        </div>
      {/if}
    </div>

    <!-- Section 5: Reading Console Output -->
    <div class="rounded border border-[var(--th-border-subtle,var(--th-border-700))]">
      <button
        class="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--th-text-primary,var(--th-text-200))] hover:bg-[var(--th-bg-800)] rounded-t transition-colors text-left"
        onclick={() => toggle("s5")}
        aria-expanded={!!openSections["s5"]}
        aria-controls="se-guide-s5"
      >
        {#if openSections["s5"]}
          <ChevronDown size={16} class="shrink-0 opacity-60" />
        {:else}
          <ChevronRight size={16} class="shrink-0 opacity-60" />
        {/if}
        {m.se_test_guide_section5_title()}
      </button>
      {#if openSections["s5"]}
        <div id="se-guide-s5" class="px-4 pb-3 text-sm text-[var(--th-text-secondary,var(--th-text-300))] space-y-2">
          <p>Enable the SE console by adding this to your SE settings:</p>
          <div class="relative">
            <pre class="bg-[var(--th-bg-700)] rounded p-3 text-xs overflow-x-auto text-[var(--th-text-primary,var(--th-text-200))]"><code>{consoleConfigSnippet}</code></pre>
            <button
              class="absolute top-2 right-2 p-1 rounded hover:bg-[var(--th-bg-800)] text-[var(--th-text-secondary,var(--th-text-400))] transition-colors"
              onclick={() => copyToClipboard(consoleConfigSnippet, "console")}
              aria-label={m.common_copy()}
            >
              {#if copiedKey === "console"}
                <Check size={14} class="text-emerald-400" />
              {:else}
                <Copy size={14} />
              {/if}
            </button>
          </div>
          <h4 class="font-medium text-[var(--th-text-primary,var(--th-text-200))] pt-1">Finding logs:</h4>
          <ul class="list-disc list-inside space-y-1 text-xs">
            <li>The SE console window opens automatically when <code class="bg-[var(--th-bg-700)] px-1 rounded text-[var(--th-text-primary,var(--th-text-200))]">CreateConsole</code> is <code class="bg-[var(--th-bg-700)] px-1 rounded text-[var(--th-text-primary,var(--th-text-200))]">true</code></li>
            <li>Log files are saved to <code class="bg-[var(--th-bg-700)] px-1 rounded text-[var(--th-text-primary,var(--th-text-200))]">%LOCALAPPDATA%/Larian Studios/Baldur's Gate 3/Script Extender Logs/</code></li>
            <li>Filter output by searching for <code class="bg-[var(--th-bg-700)] px-1 rounded text-[var(--th-text-primary,var(--th-text-200))]">[{modName}]</code> in the log</li>
          </ul>
        </div>
      {/if}
    </div>

    <!-- Section 6: Installing Dribble (Optional) -->
    <div class="rounded border border-[var(--th-border-subtle,var(--th-border-700))]">
      <button
        class="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--th-text-primary,var(--th-text-200))] hover:bg-[var(--th-bg-800)] rounded-t transition-colors text-left"
        onclick={() => toggle("s6")}
        aria-expanded={!!openSections["s6"]}
        aria-controls="se-guide-s6"
      >
        {#if openSections["s6"]}
          <ChevronDown size={16} class="shrink-0 opacity-60" />
        {:else}
          <ChevronRight size={16} class="shrink-0 opacity-60" />
        {/if}
        {m.se_test_guide_section6_title()}
      </button>
      {#if openSections["s6"]}
        <div id="se-guide-s6" class="px-4 pb-3 text-sm text-[var(--th-text-secondary,var(--th-text-300))] space-y-2">
          <p>Dribble provides a Jest-like testing framework for BG3 mods.</p>
          <a
            href="https://github.com/BG3-Community-Library-Team/Dribble"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-[var(--th-accent-500,#0ea5e9)] hover:underline"
          >
            {m.se_test_guide_dribble_link()}
            <ExternalLink size={12} class="shrink-0" />
          </a>
          <h4 class="font-medium text-[var(--th-text-primary,var(--th-text-200))] pt-1">Setup:</h4>
          <ol class="list-decimal list-inside space-y-1 text-xs">
            <li>Download Dribble from the GitHub repository</li>
            <li>Add it as a dependency in your mod's Config.json</li>
            <li>Write tests using the Dribble API in your BootstrapServer.lua</li>
            <li>Run BG3 — test results appear in the SE console</li>
          </ol>
        </div>
      {/if}
    </div>

  </div>
</div>
