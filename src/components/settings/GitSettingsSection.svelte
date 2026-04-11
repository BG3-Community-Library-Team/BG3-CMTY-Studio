<!--
  GitSettingsSection — Custom settings component for forge account management.
  Registered via configurationRegistry.registerCustomRenderer() from the git plugin.
-->
<script lang="ts">
  import { forgeSetToken, forgeClearToken, forgeAuthStatus } from "../../lib/tauri/git.js";
  import type { ForgeUser, ForgeType } from "../../lib/tauri/git.js";
  import { toastStore } from "../../lib/stores/toastStore.svelte.js";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Check from "@lucide/svelte/icons/check";
  import X from "@lucide/svelte/icons/x";
  import Plus from "@lucide/svelte/icons/plus";

  interface ForgeAccount {
    host: string;
    forgeType: ForgeType;
    apiBase: string;
    user: ForgeUser | null;
    tokenCreationUrl: string;
    loading: boolean;
  }

  const KNOWN_FORGES: ForgeAccount[] = [
    { host: "github.com", forgeType: "GitHub", apiBase: "https://api.github.com", user: null, tokenCreationUrl: "https://github.com/settings/tokens/new?scopes=repo", loading: true },
    { host: "gitlab.com", forgeType: "GitLab", apiBase: "https://gitlab.com/api/v4", user: null, tokenCreationUrl: "https://gitlab.com/-/user_settings/personal_access_tokens", loading: true },
    { host: "codeberg.org", forgeType: "Gitea", apiBase: "https://codeberg.org/api/v1", user: null, tokenCreationUrl: "https://codeberg.org/user/settings/applications", loading: true },
  ];

  let accounts = $state<ForgeAccount[]>(structuredClone(KNOWN_FORGES));
  let tokenInputs = $state<Record<string, string>>({});
  let showAddHost = $state(false);
  let newHost = $state("");
  let selectedHost = $state(KNOWN_FORGES[0].host);

  let selectedAcct = $derived(accounts.find(a => a.host === selectedHost) ?? null);

  // Check auth on mount
  $effect(() => {
    for (const acct of accounts) {
      checkAuth(acct);
    }
  });

  async function checkAuth(acct: ForgeAccount) {
    acct.loading = true;
    try {
      acct.user = await forgeAuthStatus(acct.host, acct.forgeType, acct.apiBase);
    } catch {
      acct.user = null;
    } finally {
      acct.loading = false;
    }
  }

  async function connect(acct: ForgeAccount) {
    const token = tokenInputs[acct.host]?.trim();
    if (!token) return;
    acct.loading = true;
    try {
      acct.user = await forgeSetToken(acct.host, acct.forgeType, acct.apiBase, token);
      tokenInputs[acct.host] = "";
      toastStore.success(`Connected to ${acct.host}`);
    } catch (e) {
      toastStore.error(`Failed to connect to ${acct.host}`, String(e));
    } finally {
      acct.loading = false;
    }
  }

  async function disconnect(acct: ForgeAccount) {
    acct.loading = true;
    try {
      await forgeClearToken(acct.host);
      acct.user = null;
      toastStore.info(`Disconnected from ${acct.host}`);
    } catch (e) {
      toastStore.error("Disconnect failed", String(e));
    } finally {
      acct.loading = false;
    }
  }

  function addHost() {
    const host = newHost.trim();
    if (!host || accounts.some(a => a.host === host)) return;
    accounts = [...accounts, {
      host,
      forgeType: "Gitea" as ForgeType,
      apiBase: `https://${host}/api/v1`,
      user: null,
      tokenCreationUrl: `https://${host}/user/settings/applications`,
      loading: false,
    }];
    newHost = "";
    showAddHost = false;
  }
</script>

<div class="forge-accounts">
  <h4 class="forge-section-title">Remote Accounts</h4>

  <div class="forge-selector-row">
    <select
      class="forge-select"
      bind:value={selectedHost}
    >
      {#each accounts as acct (acct.host)}
        <option value={acct.host}>
          {acct.host}{acct.user ? ` — ${acct.user.login}` : ""}
        </option>
      {/each}
    </select>
  </div>

  {#if selectedAcct}
    <div class="forge-account-row">
      <div class="forge-account-info">
        <span class="forge-host">{selectedAcct.host}</span>
        <span class="forge-type-badge">{selectedAcct.forgeType}</span>
        {#if selectedAcct.loading}
          <span class="forge-status loading">Checking…</span>
        {:else if selectedAcct.user}
          <span class="forge-status connected">
            <Check size={12} />
            {selectedAcct.user.login}
          </span>
        {:else}
          <span class="forge-status disconnected">Not connected</span>
        {/if}
      </div>

      <div class="forge-account-actions">
        {#if selectedAcct.user}
          <button class="forge-btn danger" onclick={() => disconnect(selectedAcct!)}>
            <X size={14} /> Disconnect
          </button>
        {:else}
          <div class="forge-connect-row">
            <input
              type="password"
              class="forge-token-input"
              placeholder="Paste token…"
              bind:value={tokenInputs[selectedAcct.host]}
              onkeydown={(e) => { if (e.key === "Enter") connect(selectedAcct!); }}
            />
            <a
              class="forge-create-link"
              href={selectedAcct.tokenCreationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Create token <ExternalLink size={12} />
            </a>
            <button
              class="forge-btn primary"
              onclick={() => connect(selectedAcct!)}
              disabled={!tokenInputs[selectedAcct.host]?.trim()}
            >
              Connect
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if showAddHost}
    <div class="forge-add-row">
      <input
        class="forge-token-input"
        placeholder="hostname (e.g., gitea.example.com)"
        bind:value={newHost}
        onkeydown={(e) => { if (e.key === "Enter") addHost(); }}
      />
      <button class="forge-btn primary" onclick={addHost}>Add</button>
      <button class="forge-btn" onclick={() => { showAddHost = false; newHost = ""; }}>Cancel</button>
    </div>
  {:else}
    <button class="forge-btn add-host" onclick={() => { showAddHost = true; }}>
      <Plus size={14} /> Add remote host…
    </button>
  {/if}
</div>

<style>
  .forge-accounts {
    padding: 0.25rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .forge-section-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--th-text-300);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 0.25rem;
  }

  .forge-selector-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .forge-select {
    flex: 1;
    background: var(--th-bg-800);
    border: 1px solid var(--th-border-600, var(--th-bg-600));
    color: var(--th-text-200);
    border-radius: 0.25rem;
    padding: 0.35rem 0.5rem;
    font-size: 0.78rem;
    cursor: pointer;
    outline: none;
  }

  .forge-select:focus {
    border-color: var(--th-accent-500, #0ea5e9);
  }

  .forge-type-badge {
    font-size: 0.65rem;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--th-bg-600);
    color: var(--th-text-300);
  }

  .forge-account-row {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    border-bottom: 1px solid var(--th-border-800, var(--th-bg-700));
    padding-bottom: 0.625rem;
  }

  .forge-account-row:last-of-type {
    border-bottom: none;
  }

  .forge-account-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .forge-host {
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--th-text-200);
  }

  .forge-status {
    font-size: 0.7rem;
  }

  .forge-status.loading {
    color: var(--th-text-500);
    font-style: italic;
  }

  .forge-status.connected {
    color: var(--th-success-400, #22c55e);
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .forge-status.disconnected {
    color: var(--th-text-500);
  }

  .forge-account-actions {
    padding-left: 0.25rem;
  }

  .forge-connect-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }

  .forge-token-input {
    flex: 1;
    min-width: 140px;
    background: var(--th-bg-800);
    border: 1px solid var(--th-border-600, var(--th-bg-600));
    color: var(--th-text-200);
    border-radius: 0.25rem;
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
  }

  .forge-token-input:focus {
    border-color: var(--th-accent-500, #0ea5e9);
    outline: none;
  }

  .forge-token-input::placeholder {
    color: var(--th-text-600);
  }

  .forge-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.7rem;
    border-radius: 0.25rem;
    border: 1px solid var(--th-border-700, var(--th-bg-600));
    cursor: pointer;
    background: var(--th-bg-700);
    color: var(--th-text-300);
    transition: background-color 0.15s, border-color 0.15s;
  }

  .forge-btn:hover {
    background: var(--th-bg-600);
    border-color: var(--th-border-600, var(--th-bg-500));
    color: var(--th-text-200);
  }

  .forge-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .forge-btn.primary {
    background: var(--th-accent-600, var(--th-bg-600));
    color: var(--th-text-100);
    border-color: var(--th-accent-500, var(--th-border-600));
  }

  .forge-btn.primary:hover {
    background: var(--th-accent-500, var(--th-bg-500));
    border-color: var(--th-accent-400, var(--th-border-500));
  }

  .forge-btn.danger {
    border-color: var(--th-border-700, var(--th-bg-600));
  }

  .forge-btn.danger:hover {
    background: var(--th-error-600, var(--th-bg-500));
    border-color: var(--th-error-500, var(--th-border-500));
    color: var(--th-text-100);
  }

  .forge-btn.add-host {
    align-self: flex-start;
    margin-top: 0.25rem;
  }

  .forge-create-link {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.65rem;
    color: var(--th-text-400);
    text-decoration: none;
    transition: color 0.15s;
  }

  .forge-create-link:hover {
    color: var(--th-accent-400, #38bdf8);
  }

  .forge-add-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
</style>
