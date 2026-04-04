/**
 * PF-034: Command Registry.
 *
 * Centralised registry of all application commands.  Each command
 * has an id, label, category, optional shortcut hint, an enabled
 * predicate, and an execute callback.  The registry is reactive
 * (Svelte 5 $state) so the command palette updates automatically
 * when commands are registered or unregistered.
 *
 * Categories act as navigable tree nodes in the command palette —
 * selecting a category drills down into its children.
 */

import { m } from "../../paraglide/messages.js";

export type CommandCategory = "action" | "navigation" | "data" | "setting" | "entry" | "help";

export interface Command {
  id: string;
  label: string;
  category: CommandCategory;
  icon: string;
  shortcut?: string;
  enabled: () => boolean;
  execute: () => void | Promise<void>;
}

const CATEGORY_ICONS: Record<CommandCategory, string> = {
  action: "▶",
  navigation: "◎",
  data: "⊞",
  setting: "⚙",
  entry: "≡",
  help: "?",
};

/** Display labels for command palette category entries */
export const CATEGORY_LABELS: Record<CommandCategory, () => string> = {
  action: () => m.category_actions(),
  navigation: () => m.category_navigation(),
  data: () => m.category_loaded_data(),
  setting: () => m.category_settings(),
  entry: () => m.category_entries(),
  help: () => m.category_help(),
};

/** Categories shown as navigable entries in the palette (ordered) */
export const PALETTE_CATEGORIES: CommandCategory[] = ["action", "data", "setting", "help"];

const MAX_RECENT = 3;
const RECENT_KEY = "bg3-cmty-studio-recent-commands";

class CommandRegistry {
  commands: Command[] = $state([]);
  recentIds: string[] = $state([]);

  constructor() {
    // Load recent commands from localStorage
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) this.recentIds = JSON.parse(stored);
    } catch {}
  }

  register(cmd: Command): void {
    // Avoid duplicates
    if (this.commands.some(c => c.id === cmd.id)) return;
    this.commands.push(cmd);
  }

  registerMany(cmds: Command[]): void {
    for (const cmd of cmds) this.register(cmd);
  }

  unregister(id: string): void {
    this.commands = this.commands.filter(c => c.id !== id);
  }

  /** Unregister all commands whose id starts with the given prefix. */
  unregisterPrefix(prefix: string): void {
    this.commands = this.commands.filter(c => !c.id.startsWith(prefix));
  }

  getAll(): Command[] {
    return this.commands;
  }

  getEnabled(): Command[] {
    return this.commands.filter(c => c.enabled());
  }

  /** Get enabled commands filtered by category */
  getEnabledByCategory(category: CommandCategory): Command[] {
    return this.commands.filter(c => c.category === category && c.enabled());
  }

  getCategoryIcon(category: CommandCategory): string {
    return CATEGORY_ICONS[category];
  }

  /** Command IDs that should never appear in recent commands */
  private excludeFromRecent = new Set(["action.searchEntries"]);

  /** Record a command execution for the recent list */
  recordRecent(id: string): void {
    if (this.excludeFromRecent.has(id)) return;
    this.recentIds = [id, ...this.recentIds.filter(r => r !== id)].slice(0, MAX_RECENT);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(this.recentIds));
    } catch {}
  }

  /** Get the most recently used enabled commands */
  getRecent(): Command[] {
    const result: Command[] = [];
    for (const rid of this.recentIds) {
      const cmd = this.commands.find(c => c.id === rid && c.enabled());
      if (cmd) result.push(cmd);
    }
    return result;
  }

  /** AI-31: Match a keyboard event against registered command shortcuts */
  matchShortcut(e: KeyboardEvent): Command | undefined {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    parts.push(key);
    const combo = parts.join("+");
    const cmd = this.commands.find(c => c.shortcut === combo);
    if (cmd) return cmd;
    // Normalize "+" to "=" for numpad compatibility (Ctrl+= zoom shortcut)
    if (key === "+") {
      const altCombo = [...parts.slice(0, -1), "="].join("+");
      return this.commands.find(c => c.shortcut === altCombo);
    }
    return undefined;
  }
}

export const commandRegistry = new CommandRegistry();
