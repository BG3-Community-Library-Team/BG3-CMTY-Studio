export { completionRegistry } from './completionRegistry.js';
export type { CompletionItem, CompletionContext, CompletionPlugin } from './completionTypes.js';
export { updateModSymbols, clearModSymbols } from './activeModPlugin.js';

import { completionRegistry } from './completionRegistry.js';
import { seApiPlugin } from './seApiPlugin.js';
import { luaStdlibPlugin } from './luaStdlibPlugin.js';
import { activeModPlugin } from './activeModPlugin.js';

// Register built-in plugins
completionRegistry.register(seApiPlugin);
completionRegistry.register(luaStdlibPlugin);
completionRegistry.register(activeModPlugin);
