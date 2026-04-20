/**
 * Discovers user-defined Khonsu (.khn) function names from the active mod's
 * Scripts directory. These are condition functions that modders add and can
 * reference from condition/functor expression fields in their stats.
 *
 * Uses `scriptList` + `scriptRead` IPC commands to read .khn files from disk,
 * then extracts function definitions via regex (matching the pattern used by
 * the Rust khonsu_handler validator).
 *
 * Consumers: statsExpressionPlugin (inline expression fields), khonsuPlugin
 * (.khn editor completions).
 */
import { scriptList, scriptRead } from '../tauri/scripts.js';
import type { CompletionItem } from '../plugins/completionTypes.js';

/** Regex matching Khonsu/Lua function declarations: `function FnName(` */
const FN_DECL_REGEX = /(?:^|\n)\s*(?:local\s+)?function\s+([A-Za-z_]\w*)\s*\(/g;

let cachedItems: CompletionItem[] = [];
let cachedModKey = '';

/**
 * Extract function names from Khonsu source text.
 * Exported for testing.
 */
export function extractKhnFunctionNames(source: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  FN_DECL_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FN_DECL_REGEX.exec(source)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/**
 * Scan the active mod for .khn scripts and cache their function names
 * as CompletionItems. Call after mod scan completes.
 *
 * @param modPath  The mod root directory (e.g. H:\BG3\Mods\MyMod)
 * @param modFolder  The Mods/{folder} name from mod_meta (e.g. "MyModFolder")
 */
export async function updateModKhonsuFunctions(modPath: string, modFolder: string): Promise<void> {
  if (!modPath || !modFolder) {
    cachedItems = [];
    cachedModKey = '';
    return;
  }

  const modKey = `${modPath}::${modFolder}`;

  // Don't rescan if the mod path hasn't changed
  if (modKey === cachedModKey && cachedItems.length > 0) return;

  try {
    // .khn files live under {modPath}/Mods/{modFolder}/Scripts/
    const scriptsPrefix = `Mods/${modFolder}/Scripts`;
    const listedFiles = await scriptList(modPath, scriptsPrefix);
    const files = Array.isArray(listedFiles) ? listedFiles : [];
    const khnFiles = files.filter(f => f.path.endsWith('.khn'));

    if (khnFiles.length === 0) {
      cachedItems = [];
      cachedModKey = modKey;
      return;
    }

    const seen = new Set<string>();
    const items: CompletionItem[] = [];

    for (const file of khnFiles) {
      try {
        const content = await scriptRead(modPath, file.path);
        if (!content) continue;

        const fileName = file.path.split('/').pop() ?? file.path;
        const names = extractKhnFunctionNames(content);

        for (const name of names) {
          if (!seen.has(name)) {
            seen.add(name);
            items.push({
              label: name,
              insertText: `${name}()`,
              detail: `Mod condition — ${fileName}`,
              kind: 'function',
              sortOrder: 15,
            });
          }
        }
      } catch (e) {
        console.warn(`[KHN Discovery] Failed to read ${file.path}:`, e);
      }
    }

    cachedItems = items;
    cachedModKey = modKey;

    if (items.length > 0) {
      console.info(`[KHN Discovery] Found ${items.length} mod condition function(s)`);
    }
  } catch (e) {
    console.warn('[KHN Discovery] Failed to list scripts:', e);
    cachedItems = [];
    cachedModKey = modKey;
  }
}

/** Get cached mod .khn function CompletionItems. */
export function getModKhonsuFunctions(): CompletionItem[] {
  return cachedItems;
}

/** Clear cached mod functions (e.g., on mod switch or reset). */
export function clearModKhonsuFunctions(): void {
  cachedItems = [];
  cachedModKey = '';
}
