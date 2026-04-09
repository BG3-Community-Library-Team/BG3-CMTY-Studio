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
      ],
      menus: {
        commandPalette: [
          { command: "git:switchBranch", when: "gitRepoActive" },
          { command: "git:createBranch", when: "gitRepoActive" },
          { command: "git:createBranchFrom", when: "gitRepoActive" },
          { command: "git:deleteBranch", when: "gitRepoActive" },
          { command: "git:refresh", when: "gitRepoActive" },
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

    // 4. Set up context key syncing and status bar text via $effect.root
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
