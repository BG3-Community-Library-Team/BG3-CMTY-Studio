/**
 * Git plugin commands for the command palette.
 *
 * Registers `git:*` commands that appear in the command palette when a
 * git repo is active.  The branch-picker button in the toolbar and
 * status bar opens the palette pre-filtered to `>git:` to show only
 * git branch operations.
 *
 * Convention: plugin command IDs use `PLUGIN:action` format.
 */

import { commandRegistry, type Command } from "../utils/commandRegistry.svelte.js";
import { gitStore } from "../stores/gitStore.svelte.js";
import { modStore } from "../stores/modStore.svelte.js";
import { uiStore } from "../stores/uiStore.svelte.js";
import { toastStore } from "../stores/toastStore.svelte.js";
import { m } from "../../paraglide/messages.js";

const PREFIX = "git:";

function getGitPath(): string {
  return modStore.projectPath || modStore.selectedModPath || "";
}

function buildGitCommands(): Command[] {
  return [
    // ── Branch switching ────────────────────────────────────
    {
      id: "git:switchBranch",
      label: m.git_cmd_switch_branch(),
      category: "action",
      icon: "⎇",
      enabled: () => gitStore.isRepo,
      execute: async () => {
        const modPath = getGitPath();
        if (!modPath) return;
        await gitStore.refreshBranches(modPath);
        const locals = gitStore.branches.filter(b => !b.isRemote && !b.isCurrent);
        if (locals.length === 0) {
          toastStore.info(m.git_cmd_no_other_branches());
          return;
        }
        // Re-open palette filtered to branch names for user selection
        uiStore.openCommandPalette(">git:branch/");
      },
    },
    {
      id: "git:createBranch",
      label: m.git_cmd_create_branch(),
      category: "action",
      icon: "⎇",
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
      enabled: () => gitStore.isRepo && gitStore.branches.filter(b => !b.isRemote && !b.isCurrent).length > 0,
      execute: async () => {
        const modPath = getGitPath();
        if (!modPath) return;
        uiStore.openCommandPalette(">git:delete/");
      },
    },
    {
      id: "git:refresh",
      label: m.git_cmd_refresh(),
      category: "action",
      icon: "⎇",
      enabled: () => gitStore.isRepo,
      execute: async () => {
        const modPath = getGitPath();
        if (!modPath) return;
        await gitStore.refresh(modPath);
        toastStore.info(m.git_cmd_refreshed());
      },
    },
  ];
}

/**
 * Dynamically register branch checkout commands for each local branch.
 * Called when the palette opens with `>git:branch/` prefix.
 */
export function registerDynamicBranchCommands(): void {
  // Remove stale dynamic branch commands
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

      // Delete variant
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

  // Also register recent commits for detached checkout
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

/** Register all static git plugin commands. Call once at app startup. */
export function registerGitCommands(): void {
  commandRegistry.registerMany(buildGitCommands());
}

/** Unregister all git plugin commands (static + dynamic). */
export function unregisterGitCommands(): void {
  commandRegistry.unregisterPrefix(PREFIX);
}
