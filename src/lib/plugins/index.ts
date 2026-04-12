export { completionRegistry } from './completionRegistry.js';
export type { CompletionItem, CompletionContext, CompletionPlugin } from './completionTypes.js';
export { updateModSymbols, clearModSymbols } from './activeModPlugin.js';
export { loadIdeHelpers, reloadIdeHelpers } from './ideHelpersPlugin.js';

import { completionRegistry } from './completionRegistry.js';
import { seApiPlugin } from './seApiPlugin.js';
import { luaStdlibPlugin } from './luaStdlibPlugin.js';
import { activeModPlugin } from './activeModPlugin.js';
import { ideHelpersPlugin } from './ideHelpersPlugin.js';
import { osirisPlugin } from './osirisPlugin.js';
import { statsPlugin } from './statsPlugin.js';
import { khonsuPlugin } from './khonsuPlugin.js';
import { frameworkPlugin } from './frameworkPlugin.js';
import { jsonSchemaPlugin } from './jsonSchemaPlugin.js';

// Register built-in plugins
completionRegistry.register(seApiPlugin);
completionRegistry.register(luaStdlibPlugin);
completionRegistry.register(activeModPlugin);
completionRegistry.register(ideHelpersPlugin);
completionRegistry.register(osirisPlugin);
completionRegistry.register(statsPlugin);
completionRegistry.register(khonsuPlugin);
completionRegistry.register(frameworkPlugin);
completionRegistry.register(jsonSchemaPlugin);
