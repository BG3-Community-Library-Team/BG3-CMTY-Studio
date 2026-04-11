<script lang="ts">
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import ForgeConnectPrompt from "./ForgeConnectPrompt.svelte";
  import ForgePRList from "./ForgePRList.svelte";
  import ForgeIssueList from "./ForgeIssueList.svelte";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  let prLabel = $derived(
    gitStore.forgeInfo?.forgeType === "GitLab" ? "Merge Request" : "Pull Request"
  );

  async function refresh() {
    await gitStore.refreshForge();
  }
</script>

{#if gitStore.forgeInfo && gitStore.forgeInfo.forgeType !== "Unknown"}
  <div class="forge-section">
    <div class="forge-section-header">
      <span class="forge-section-title">{gitStore.forgeInfo.host}</span>
      {#if gitStore.forgeConnected}
        <button class="forge-refresh-btn" onclick={refresh} title="Refresh">
          <RefreshCw size={14} />
        </button>
      {/if}
    </div>

    {#if gitStore.forgeConnected && gitStore.forgeInfo}
      <details class="forge-details" open>
        <summary>{prLabel}s ({gitStore.prs.length})</summary>
        <ForgePRList prs={gitStore.prs} info={gitStore.forgeInfo} {prLabel} />
      </details>

      <details class="forge-details" open>
        <summary>Issues ({gitStore.issues.length})</summary>
        <ForgeIssueList issues={gitStore.issues} />
      </details>
    {:else}
      <ForgeConnectPrompt info={gitStore.forgeInfo} />
    {/if}
  </div>
{/if}

<style>
  .forge-section {
    border-top: 1px solid var(--th-bg-700);
    padding: 0;
  }

  .forge-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: var(--th-sidebar-bg-deep, var(--th-bg-950));
  }

  .forge-section-title {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--th-text-200);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .forge-refresh-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
  }

  .forge-refresh-btn:hover {
    background: var(--th-bg-700);
    color: var(--th-text-200);
  }

  .forge-details {
    border-top: 1px solid var(--th-bg-700);
  }

  .forge-details summary {
    padding: 5px 12px;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--th-text-300);
    cursor: pointer;
    user-select: none;
    list-style: none;
  }

  .forge-details summary::-webkit-details-marker {
    display: none;
  }

  .forge-details summary::before {
    content: "▸ ";
    font-size: 0.7rem;
  }

  .forge-details[open] summary::before {
    content: "▾ ";
  }

  .forge-details summary:hover {
    background: var(--th-bg-800);
  }
</style>
