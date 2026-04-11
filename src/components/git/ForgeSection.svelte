<script lang="ts">
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import ForgeConnectPrompt from "./ForgeConnectPrompt.svelte";
  import ForgePRList from "./ForgePRList.svelte";
  import ForgeIssueList from "./ForgeIssueList.svelte";

  let prLabel = $derived(
    gitStore.forgeInfo?.forgeType === "GitLab" ? "Merge Request" : "Pull Request"
  );
</script>

{#if gitStore.forgeInfo && gitStore.forgeInfo.forgeType !== "Unknown"}
  <div class="forge-section" role="region" aria-label="Forge integration">
    {#if gitStore.forgeConnected && gitStore.forgeInfo}
      <details class="forge-details" open>
        <summary>{prLabel}s ({gitStore.prs.length})</summary>
        <ForgePRList prs={gitStore.prs} info={gitStore.forgeInfo} {prLabel} />
      </details>

      <details class="forge-details" open>
        <summary>Issues ({gitStore.issues.length})</summary>
        <ForgeIssueList issues={gitStore.issues} info={gitStore.forgeInfo} />
      </details>
    {:else}
      <ForgeConnectPrompt info={gitStore.forgeInfo} />
    {/if}
  </div>
{/if}

<style>
  .forge-section {
    padding: 0;
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
