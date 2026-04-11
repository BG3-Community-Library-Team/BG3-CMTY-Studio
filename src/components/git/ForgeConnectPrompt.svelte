<script lang="ts">
  import type { ForgeInfo } from "../../lib/tauri/git.js";
  import { forgeSetToken } from "../../lib/tauri/git.js";
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import ExternalLink from "@lucide/svelte/icons/external-link";

  interface Props {
    info: ForgeInfo;
  }
  let { info }: Props = $props();

  let token = $state("");
  let connecting = $state(false);

  function tokenUrl(): string {
    switch (info.forgeType) {
      case "GitHub": return "https://github.com/settings/tokens/new?scopes=repo";
      case "GitLab": return `https://${info.host}/-/user_settings/personal_access_tokens`;
      case "Gitea": return `https://${info.host}/user/settings/applications`;
      default: return "";
    }
  }

  async function connect() {
    if (!token.trim()) return;
    connecting = true;
    try {
      const user = await forgeSetToken(info.host, info.forgeType, info.apiBase, token);
      gitStore.forgeUser = user;
      gitStore.forgeConnected = true;
      token = "";
      toastStore.success(`Connected to ${info.host} as ${user.login}`);
      await gitStore.refreshForge();
    } catch (e) {
      toastStore.error(`Failed to connect to ${info.host}`, String(e));
    } finally {
      connecting = false;
    }
  }
</script>

<div class="forge-connect">
  <p class="forge-connect-label">Connect to {info.host}</p>
  <div class="forge-connect-form">
    <input
      type="password"
      class="forge-token-input"
      aria-label="Access token for {info.host}"
      placeholder="Paste access token…"
      bind:value={token}
      onkeydown={(e) => { if (e.key === "Enter") connect(); }}
      disabled={connecting}
    />
    <button class="forge-connect-btn" onclick={connect} disabled={!token.trim() || connecting}>
      {connecting ? "Connecting…" : "Connect"}
    </button>
  </div>
  {#if tokenUrl()}
    <a class="forge-token-link" href={tokenUrl()} target="_blank" rel="noopener noreferrer">
      Create token <ExternalLink size={12} aria-hidden="true" />
    </a>
  {/if}
</div>

<style>
  .forge-connect {
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .forge-connect-label {
    font-size: 0.8rem;
    color: var(--th-text-300);
    margin: 0;
  }

  .forge-connect-form {
    display: flex;
    gap: 4px;
  }

  .forge-token-input {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    font-size: 0.78rem;
    border: 1px solid var(--th-bg-600);
    border-radius: 3px;
    background: var(--th-bg-800);
    color: var(--th-text-200);
    outline: none;
  }

  .forge-token-input:focus {
    border-color: var(--th-accent-400);
  }

  .forge-token-input:disabled {
    opacity: 0.5;
  }

  .forge-connect-btn {
    padding: 5px 14px;
    font-size: 0.78rem;
    font-weight: 600;
    border: 1px solid var(--th-accent-500);
    border-radius: 4px;
    background: var(--th-accent-600, #0284c7);
    color: var(--th-text-100, #fff);
    cursor: pointer;
    white-space: nowrap;
    letter-spacing: 0.02em;
  }

  .forge-connect-btn:hover:not(:disabled) {
    background: var(--th-accent-500, #0ea5e9);
    border-color: var(--th-accent-400);
  }

  .forge-connect-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .forge-token-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    color: var(--th-accent-400);
    text-decoration: none;
  }

  .forge-token-link:hover {
    text-decoration: underline;
  }
</style>
