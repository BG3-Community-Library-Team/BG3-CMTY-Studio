/**
 * EXT-9: Git Plugin — reference implementation of the plugin system.
 *
 * Migrates all git functionality into a formal plugin module with
 * manifest declarations and activate/deactivate lifecycle.
 */

import type { PluginModule, PluginContext } from "../pluginTypes.js";
import { commandRegistry, type Command } from "../../utils/commandRegistry.svelte.js";
import { contextKeys } from "../contextKeyService.svelte.js";
import { viewRegistry } from "../viewRegistry.svelte.js";
import { statusBarRegistry } from "../statusBarRegistry.svelte.js";
import { configurationRegistry } from "../configurationRegistry.svelte.js";
import { projectSettingsStore } from "../../stores/projectSettingsStore.svelte.js";
import { gitStore } from "../../stores/gitStore.svelte.js";
import { modStore } from "../../stores/modStore.svelte.js";
import { uiStore } from "../../stores/uiStore.svelte.js";
import { toastStore } from "../../stores/toastStore.svelte.js";
import { m } from "../../../paraglide/messages.js";
import GitPanel from "../../../components/git/GitPanel.svelte";

function getGitPath(): string {
  return modStore.projectPath || modStore.selectedModPath || "";
}

export const gitPlugin: PluginModule = {
  manifest: {
    id: "cmty.git",
    name: "Git",
    description: "Git version control integration",
    version: "1.0.0",
    activationEvents: ["onStartupFinished"],
    contributes: {
      commands: [
        { command: "git:switchBranch", title: "Switch Branch", category: "Git", icon: "git-branch", enablement: "gitRepoActive" },
        { command: "git:createBranch", title: "Create Branch", category: "Git", icon: "git-branch", enablement: "gitRepoActive" },
        { command: "git:createBranchFrom", title: "Create Branch From…", category: "Git", icon: "git-branch", enablement: "gitRepoActive" },
        { command: "git:deleteBranch", title: "Delete Branch", category: "Git", icon: "git-branch", enablement: "gitRepoActive" },
        { command: "git:refresh", title: "Refresh", category: "Git", enablement: "gitRepoActive" },
        { command: "git:init", title: "Initialize Repository", category: "Git", enablement: "modLoaded && !gitRepoActive" },
        { command: "git:commit", title: "Commit", category: "Git", enablement: "gitRepoActive && gitHasChanges" },
        { command: "git:stageAll", title: "Stage All Changes", category: "Git", enablement: "gitRepoActive" },
        { command: "git:unstageAll", title: "Unstage All Changes", category: "Git", enablement: "gitRepoActive" },
        { command: "git:push", title: "Push", category: "Git", enablement: "gitRepoActive" },
        { command: "git:pull", title: "Pull", category: "Git", enablement: "gitRepoActive" },
        { command: "git:fetch", title: "Fetch", category: "Git", enablement: "gitRepoActive" },
        { command: "git:sync", title: "Sync", category: "Git", enablement: "gitRepoActive" },
        { command: "git:stash", title: "Stash Changes", category: "Git", enablement: "gitRepoActive && gitHasChanges" },
        { command: "git:stashPop", title: "Pop Stash", category: "Git", enablement: "gitRepoActive" },
      ],
      configuration: {
        title: "Git",
        properties: {
          "git.userName": {
            type: "string",
            default: "",
            description: "Git user name for commits",
            order: 1,
          },
          "git.userEmail": {
            type: "string",
            default: "",
            description: "Git user email for commits",
            order: 2,
          },
          "git.autoFetchInterval": {
            type: "string",
            default: "off",
            description: "Auto-fetch interval",
            enum: ["off", "1min", "5min", "15min"],
            order: 3,
          },
          "git.defaultRemote": {
            type: "string",
            default: "origin",
            description: "Default remote for push/pull operations",
            order: 4,
          },
        },
      },
      viewsContainers: [
        { id: "cmty-git", title: "Source Control", icon: "git-branch", location: "sidebar" },
      ],
      views: {
        "cmty-git": [
          { id: "git.panel", name: "Git", when: "modLoaded" },
        ],
      },
      statusBarItems: [
        { id: "git.branch", alignment: "left", priority: 100, when: "gitRepoActive" },
        { id: "git.sync", alignment: "left", priority: 99, when: "gitRepoActive" },
      ],
      menus: {
        commandPalette: [
          { command: "git:switchBranch", when: "gitRepoActive" },
          { command: "git:createBranch", when: "gitRepoActive" },
          { command: "git:createBranchFrom", when: "gitRepoActive" },
          { command: "git:deleteBranch", when: "gitRepoActive" },
          { command: "git:refresh", when: "gitRepoActive" },
          { command: "git:init", when: "modLoaded && !gitRepoActive" },
          { command: "git:commit", when: "gitRepoActive && gitHasChanges" },
          { command: "git:stageAll", when: "gitRepoActive" },
          { command: "git:unstageAll", when: "gitRepoActive" },
          { command: "git:push", when: "gitRepoActive" },
          { command: "git:pull", when: "gitRepoActive" },
          { command: "git:fetch", when: "gitRepoActive" },
          { command: "git:sync", when: "gitRepoActive" },
          { command: "git:stash", when: "gitRepoActive && gitHasChanges" },
          { command: "git:stashPop", when: "gitRepoActive" },
        ],
      },
    },
  },

  activate(ctx: PluginContext) {
    // 1. Register command implementations
    const commands: Command[] = [
      {
        id: "git:switchBranch",
        label: m.git_cmd_switch_branch(),
        category: "action",
        icon: "⎇",
        when: "gitRepoActive",
        enabled: () => gitStore.isRepo,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          await gitStore.refreshBranches(modPath);
          registerDynamicBranchCommands();
          uiStore.openCommandPalette(">git:branch/");
        },
      },
      {
        id: "git:createBranch",
        label: m.git_cmd_create_branch(),
        category: "action",
        icon: "⎇",
        when: "gitRepoActive",
        enabled: () => gitStore.isRepo,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          const name = window.prompt(m.git_branch_create_placeholder());
          if (!name?.trim()) return;
          try {
            await gitStore.createBranch(modPath, name.trim());
            await gitStore.checkout(modPath, name.trim());
            toastStore.success(m.git_cmd_branch_created({ name: name.trim() }));
          } catch (e) {
            toastStore.error(m.git_cmd_branch_error(), String(e));
          }
        },
      },
      {
        id: "git:createBranchFrom",
        label: m.git_cmd_create_branch_from(),
        category: "action",
        icon: "⎇",
        when: "gitRepoActive",
        enabled: () => gitStore.isRepo,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          const from = window.prompt(m.git_cmd_base_branch_prompt());
          if (!from?.trim()) return;
          const name = window.prompt(m.git_branch_create_placeholder());
          if (!name?.trim()) return;
          try {
            await gitStore.createBranch(modPath, name.trim(), from.trim());
            await gitStore.checkout(modPath, name.trim());
            toastStore.success(m.git_cmd_branch_created({ name: name.trim() }));
          } catch (e) {
            toastStore.error(m.git_cmd_branch_error(), String(e));
          }
        },
      },
      {
        id: "git:deleteBranch",
        label: m.git_cmd_delete_branch(),
        category: "action",
        icon: "⎇",
        when: "gitRepoActive",
        enabled: () => gitStore.isRepo && gitStore.branches.filter(b => !b.isRemote && !b.isCurrent).length > 0,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          registerDynamicBranchCommands();
          uiStore.openCommandPalette(">git:delete/");
        },
      },
      {
        id: "git:refresh",
        label: m.git_cmd_refresh(),
        category: "action",
        icon: "⎇",
        when: "gitRepoActive",
        enabled: () => gitStore.isRepo,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          await gitStore.refresh(modPath);
          toastStore.info(m.git_cmd_refreshed());
        },
      },
      {
        id: "git:init",
        label: m.git_cmd_init(),
        category: "action",
        icon: "⎇",
        when: "modLoaded && !gitRepoActive",
        enabled: () => !gitStore.isRepo,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          try {
            await gitStore.init(modPath);
            toastStore.success(m.git_cmd_init());
          } catch (e) {
            toastStore.error(String(e));
          }
        },
      },
      {
        id: "git:commit",
        label: m.git_cmd_commit(),
        category: "action",
        icon: "✓",
        when: "gitRepoActive && gitHasChanges",
        enabled: () => gitStore.isRepo && gitStore.changedFileCount > 0,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          try {
            await gitStore.commit(modPath);
          } catch (e) {
            toastStore.error(String(e));
          }
        },
      },
      {
        id: "git:stageAll",
        label: m.git_cmd_stage_all(),
        category: "action",
        icon: "＋",
        when: "gitRepoActive",
        enabled: () => gitStore.isRepo,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          await gitStore.stageAll(modPath);
        },
      },
      {
        id: "git:unstageAll",
        label: m.git_cmd_unstage_all(),
        category: "action",
        icon: "－",
        when: "gitRepoActive",
        enabled: () => gitStore.isRepo,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          // Unstage all staged files
          const paths = gitStore.stagedFiles.map(f => f.path);
          if (paths.length > 0) {
            await gitStore.unstage(modPath, paths);
          }
        },
      },
      {
        id: "git:push",
        label: m.git_cmd_push(),
        category: "action",
        icon: "↑",
        when: "gitRepoActive",
        enabled: () => gitStore.isRepo,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          try {
            await gitStore.push(modPath);
            toastStore.success(m.git_push_success());
          } catch (e) {
            toastStore.error(m.git_push_failed(), String(e));
          }
        },
      },
      {
        id: "git:pull",
        label: m.git_cmd_pull(),
        category: "action",
        icon: "↓",
        when: "gitRepoActive",
        enabled: () => gitStore.isRepo,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          try {
            const result = await gitStore.pull(modPath);
            if (result.mergeResult.conflicts.length > 0) {
              toastStore.warning(m.git_pull_failed(), `${result.mergeResult.conflicts.length} conflicts`);
            } else {
              toastStore.success(m.git_pull_success());
            }
          } catch (e) {
            toastStore.error(m.git_pull_failed(), String(e));
          }
        },
      },
      {
        id: "git:fetch",
        label: m.git_cmd_fetch(),
        category: "action",
        icon: "⟳",
        when: "gitRepoActive",
        enabled: () => gitStore.isRepo,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          try {
            await gitStore.fetch(modPath);
            toastStore.success(m.git_fetch_success());
          } catch (e) {
            toastStore.error(m.git_fetch_failed(), String(e));
          }
        },
      },
      {
        id: "git:sync",
        label: m.git_cmd_sync(),
        category: "action",
        icon: "⟳",
        when: "gitRepoActive",
        enabled: () => gitStore.isRepo,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          try {
            await gitStore.sync(modPath);
            toastStore.success(m.git_sync_success());
          } catch (e) {
            toastStore.error(m.git_sync_failed(), String(e));
          }
        },
      },
      {
        id: "git:stash",
        label: m.git_cmd_stash(),
        category: "action",
        icon: "📦",
        when: "gitRepoActive && gitHasChanges",
        enabled: () => gitStore.isRepo && gitStore.changedFileCount > 0,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          const msg = window.prompt(m.git_stash_save_prompt());
          if (msg === null) return;
          try {
            await gitStore.stash(modPath, msg || undefined);
            toastStore.success(m.git_stash_save_success());
          } catch (e) {
            toastStore.error(m.git_stash_failed(), String(e));
          }
        },
      },
      {
        id: "git:stashPop",
        label: m.git_cmd_stash_pop(),
        category: "action",
        icon: "📦",
        when: "gitRepoActive",
        enabled: () => gitStore.isRepo && gitStore.stashes.length > 0,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          try {
            await gitStore.stashApply(modPath, 0);
            await gitStore.stashDrop(modPath, 0);
            toastStore.success(m.git_stash_apply_success());
          } catch (e) {
            toastStore.error(m.git_stash_failed(), String(e));
          }
        },
      },
    ];
    commandRegistry.registerMany(commands);

    // 2. Set view component for sidebar
    viewRegistry.setViewComponent("git.panel", GitPanel);

    // 3. Find the status bar item registered by the host and configure it
    const branchItem = statusBarRegistry.items.find(i => i.id === "git.branch");
    if (branchItem) {
      branchItem.command = "git:switchBranch";
      branchItem.icon = "git-branch";
    }

    const syncItem = statusBarRegistry.items.find(i => i.id === "git.sync");
    if (syncItem) {
      syncItem.command = "git:sync";
      syncItem.icon = "refresh-ccw";
    }

    // 4. Register project-level mapping for git config keys
    configurationRegistry.registerProjectMapping({
      "git.userName": "gitUserName",
      "git.userEmail": "gitUserEmail",
      "git.autoFetchInterval": "gitAutoFetchInterval",
      "git.defaultRemote": "gitDefaultRemote",
    });

    // 5. Set up context key syncing and status bar text via $effect.root
    const cleanupEffects = $effect.root(() => {
      // Sync gitStore → context keys
      $effect(() => {
        contextKeys.set("gitRepoActive", gitStore.isRepo);
      });
      $effect(() => {
        contextKeys.set("gitBranchName", gitStore.currentBranch ?? gitStore.repoInfo?.headBranch ?? "");
      });
      $effect(() => {
        contextKeys.set("gitHasChanges",
          (gitStore.stagedFiles.length + gitStore.unstagedFiles.length + gitStore.untrackedFiles.length) > 0
        );
      });
      $effect(() => {
        contextKeys.set("gitConflicts", gitStore.conflictedFiles.length > 0);
      });
      // Update status bar item text reactively
      $effect(() => {
        if (branchItem) {
          const branch = gitStore.currentBranch ?? gitStore.repoInfo?.headBranch ?? "";
          const ahead = gitStore.repoInfo?.ahead ?? 0;
          const behind = gitStore.repoInfo?.behind ?? 0;
          let text = branch;
          if (ahead > 0) text += ` ↑${ahead}`;
          if (behind > 0) text += ` ↓${behind}`;
          branchItem.text = text;
          branchItem.tooltip = `Git: ${branch}`;
        }
      });
      $effect(() => {
        if (syncItem) {
          syncItem.text = gitStore.syncProgress ?? "";
          syncItem.tooltip = gitStore.isSyncing ? "Syncing..." : "Sync";
        }
      });
    });

    // Store cleanup in subscriptions
    ctx.subscriptions.push({ dispose: cleanupEffects });
  },

  deactivate() {
    // Clean up context keys
    contextKeys.delete("gitRepoActive");
    contextKeys.delete("gitBranchName");
    contextKeys.delete("gitHasChanges");
    contextKeys.delete("gitConflicts");
    // Commands will be cleaned up by pluginHost via unregisterPrefix
  },
};

/** Dynamic branch commands — same as original gitCommands.svelte.ts */
function registerDynamicBranchCommands(): void {
  commandRegistry.unregisterPrefix("git:branch/");
  commandRegistry.unregisterPrefix("git:delete/");

  const locals = gitStore.branches.filter(b => !b.isRemote);

  for (const branch of locals) {
    if (!branch.isCurrent) {
      commandRegistry.register({
        id: `git:branch/${branch.name}`,
        label: `${branch.name}${branch.ahead > 0 ? ` ↑${branch.ahead}` : ""}${branch.behind > 0 ? ` ↓${branch.behind}` : ""}`,
        category: "action",
        icon: branch.isCurrent ? "●" : "○",
        enabled: () => true,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          try {
            await gitStore.checkout(modPath, branch.name);
            toastStore.success(m.git_cmd_switched({ name: branch.name }));
          } catch (e) {
            toastStore.error(m.git_cmd_branch_error(), String(e));
          }
        },
      });

      commandRegistry.register({
        id: `git:delete/${branch.name}`,
        label: `Delete: ${branch.name}`,
        category: "action",
        icon: "✕",
        enabled: () => true,
        execute: async () => {
          const modPath = getGitPath();
          if (!modPath) return;
          if (!confirm(m.git_branch_delete_confirm({ name: branch.name }))) return;
          try {
            await gitStore.deleteBranch(modPath, branch.name);
            toastStore.success(m.git_cmd_branch_deleted({ name: branch.name }));
          } catch (e) {
            toastStore.error(m.git_cmd_branch_error(), String(e));
          }
        },
      });
    }
  }

  // Recent commits for detached checkout
  for (const commit of gitStore.commits.slice(0, 3)) {
    commandRegistry.register({
      id: `git:branch/commit:${commit.oid}`,
      label: `${commit.oid.slice(0, 7)} — ${commit.message.split("\n")[0]}`,
      category: "action",
      icon: "◆",
      enabled: () => true,
      execute: async () => {
        const modPath = getGitPath();
        if (!modPath) return;
        try {
          await gitStore.checkout(modPath, commit.oid);
          toastStore.success(m.git_cmd_switched({ name: commit.oid.slice(0, 7) }));
        } catch (e) {
          toastStore.error(m.git_cmd_branch_error(), String(e));
        }
      },
    });
  }
}

// Re-export for StatusBar to use during the transition
export { registerDynamicBranchCommands };
