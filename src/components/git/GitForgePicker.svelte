<script lang="ts">
  import { gitStore } from "../../lib/stores/gitStore.svelte.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import { forgeSetToken, forgeClearToken } from "../../lib/tauri/git.js";
  import Globe from "@lucide/svelte/icons/globe";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import LogOut from "@lucide/svelte/icons/log-out";

  let showDropdown = $state(false);
  let token = $state("");
  let connecting = $state(false);

  let info = $derived(gitStore.forgeInfo);
  let connected = $derived(gitStore.forgeConnected);
  let user = $derived(gitStore.forgeUser);

  function toggleDropdown() {
    showDropdown = !showDropdown;
    if (!showDropdown) {
      token = "";
    }
  }

  function closeDropdown() {
    showDropdown = false;
    token = "";
  }

  function tokenUrl(): string {
    if (!info) return "";
    switch (info.forgeType) {
      case "GitHub": return "https://github.com/settings/tokens/new?scopes=repo";
      case "GitLab": return `https://${info.host}/-/user_settings/personal_access_tokens`;
      case "Gitea": return `https://${info.host}/user/settings/applications`;
      default: return "";
    }
  }

  async function connect() {
    if (!info || !token.trim()) return;
    connecting = true;
    try {
      const u = await forgeSetToken(info.host, info.forgeType, info.apiBase, token);
      gitStore.forgeUser = u;
      gitStore.forgeConnected = true;
      token = "";
      toastStore.success(`Connected to ${info.host} as ${u.login}`);
      await gitStore.refreshForge();
      closeDropdown();
    } catch (e) {
      toastStore.error(`Failed to connect to ${info.host}`, String(e));
    } finally {
      connecting = false;
    }
  }

  async function disconnect() {
    if (!info) return;
    try {
      await forgeClearToken(info.host);
      gitStore.forgeUser = null;
      gitStore.forgeConnected = false;
      gitStore.prs = [];
      gitStore.issues = [];
      toastStore.success(`Disconnected from ${info.host}`);
      closeDropdown();
    } catch (e) {
      toastStore.error("Failed to disconnect", String(e));
    }
  }

  // Close dropdown on outside click
  function handleWindowClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest(".forge-picker");
    if (!el) closeDropdown();
  }

  $effect(() => {
    if (showDropdown) {
      const close = (e: MouseEvent) => {
        const el = (e.target as HTMLElement).closest(".forge-picker");
        if (!el) { showDropdown = false; token = ""; }
      };
      setTimeout(() => window.addEventListener("click", close), 0);
      return () => window.removeEventListener("click", close);
    }
  });
</script>

{#if info && info.forgeType !== "Unknown"}
  <div class="forge-picker">
    <button
      class="forge-picker-btn"
      class:connected
      title={connected ? `${info.forgeType}: ${user?.login ?? info.host}` : `Connect to ${info.host}`}
      aria-label={connected ? `Forge: ${info.forgeType}, connected as ${user?.login ?? info.host}` : `Connect to ${info.host}`}
      aria-expanded={showDropdown}
      aria-haspopup="true"
      onclick={toggleDropdown}
    >
      <Globe size={13} aria-hidden="true" />
      {#if connected}
        <span class="forge-picker-label">{info.forgeType}</span>
        <span class="forge-dot connected" aria-hidden="true"></span>
      {:else}
        <span class="forge-dot" aria-hidden="true"></span>
      {/if}
    </button>

    {#if showDropdown}
      <div class="forge-dropdown">
        {#if connected && user}
          <div class="forge-dd-header">
            {#if user.avatarUrl}
              <img class="forge-dd-avatar" src={user.avatarUrl} alt={user.login} />
            {/if}
            <div class="forge-dd-user">
              <span class="forge-dd-login">{user.login}</span>
              <span class="forge-dd-host">{info.host}</span>
            </div>
          </div>
          <div class="forge-dd-actions">
            <button class="forge-dd-btn danger" onclick={disconnect}>
              <LogOut size={12} aria-hidden="true" />
              Disconnect
            </button>
          </div>
        {:else}
          <div class="forge-dd-connect">
            <span class="forge-dd-connect-label">Connect to {info.host}</span>
            <input
              type="password"
              class="forge-dd-token"
              aria-label="Access token for {info.host}"
              placeholder="Paste access token…"
              bind:value={token}
              onkeydown={(e) => { if (e.key === "Enter") connect(); }}
              disabled={connecting}
            />
            <div class="forge-dd-connect-actions">
              <button
                class="forge-dd-btn primary"
                onclick={connect}
                disabled={!token.trim() || connecting}
              >
                {connecting ? "Connecting…" : "Connect"}
              </button>
              {#if tokenUrl()}
                <a class="forge-dd-token-link" href={tokenUrl()} target="_blank" rel="noopener noreferrer">
                  Create token <ExternalLink size={10} />
                </a>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .forge-picker {
    position: relative;
  }

  .forge-picker-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 24px;
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--th-text-400);
    cursor: pointer;
    font-size: 0.72rem;
  }

  .forge-picker-btn:hover {
    background: var(--th-sidebar-highlight, var(--th-bg-800));
    color: var(--th-text-200);
  }

  .forge-picker-btn.connected {
    color: var(--th-text-300);
  }

  .forge-picker-label {
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .forge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--th-text-600, #666);
    flex-shrink: 0;
  }

  .forge-dot.connected {
    background: var(--th-success, #22c55e);
  }

  .forge-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 10000;
    min-width: 220px;
    margin-top: 4px;
    background: var(--th-bg-800, #27272a);
    border: 1px solid var(--th-border-600, #52525b);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }

  .forge-dd-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--th-border-700, #3f3f46);
  }

  .forge-dd-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
  }

  .forge-dd-user {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .forge-dd-login {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--th-text-200);
  }

  .forge-dd-host {
    font-size: 0.68rem;
    color: var(--th-text-500);
  }

  .forge-dd-actions {
    padding: 6px;
  }

  .forge-dd-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    background: transparent;
    color: var(--th-text-300);
  }

  .forge-dd-btn:hover:not(:disabled) {
    background: var(--th-bg-700);
  }

  .forge-dd-btn.danger:hover {
    color: var(--th-error, #ef4444);
  }

  .forge-dd-btn.primary {
    background: var(--th-accent-500, #007acc);
    color: white;
    justify-content: center;
  }

  .forge-dd-btn.primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .forge-dd-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .forge-dd-connect {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .forge-dd-connect-label {
    font-size: 0.78rem;
    color: var(--th-text-300);
  }

  .forge-dd-token {
    width: 100%;
    padding: 4px 8px;
    font-size: 0.75rem;
    border: 1px solid var(--th-bg-600);
    border-radius: 3px;
    background: var(--th-bg-900);
    color: var(--th-text-200);
    outline: none;
    box-sizing: border-box;
  }

  .forge-dd-token:focus {
    border-color: var(--th-accent-400);
  }

  .forge-dd-connect-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: space-between;
  }

  .forge-dd-token-link {
    font-size: 0.68rem;
    color: var(--th-accent-400, #60a5fa);
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 2px;
    white-space: nowrap;
  }

  .forge-dd-token-link:hover {
    text-decoration: underline;
  }
</style>
