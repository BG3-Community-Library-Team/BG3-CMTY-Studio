import type { CompletionPlugin, CompletionItem, CompletionContext } from './completionTypes.js';

class CompletionRegistry {
  private plugins: CompletionPlugin[] = [];

  register(plugin: CompletionPlugin): void {
    // Deduplicate by id
    this.plugins = this.plugins.filter(p => p.id !== plugin.id);
    this.plugins.push(plugin);
    this.plugins.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  unregister(pluginId: string): void {
    this.plugins = this.plugins.filter(p => p.id !== pluginId);
  }

  getCompletions(ctx: CompletionContext, maxResults = 20): CompletionItem[] {
    const results: CompletionItem[] = [];
    for (const plugin of this.plugins) {
      if (!plugin.languages.includes(ctx.language) && !plugin.languages.includes('*')) continue;
      try {
        const items = plugin.getCompletions(ctx);
        for (const item of items) {
          item.source = item.source ?? plugin.id;
          results.push(item);
        }
      } catch (e) {
        console.warn(`[Completions] Plugin ${plugin.id} error:`, e);
      }
    }
    // Sort by sortOrder then alphabetically
    results.sort((a, b) => {
      const oa = a.sortOrder ?? 100;
      const ob = b.sortOrder ?? 100;
      if (oa !== ob) return oa - ob;
      return a.label.localeCompare(b.label);
    });
    return results.slice(0, maxResults);
  }

  getRegisteredPlugins(): readonly CompletionPlugin[] {
    return this.plugins;
  }
}

export const completionRegistry = new CompletionRegistry();
