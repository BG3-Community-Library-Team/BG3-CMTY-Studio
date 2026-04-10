/**
 * Extracted async file operations for ScriptsDrawerContent.
 * These handle create, rename, delete, scaffold, and paste operations
 * for script files in the explorer.
 */
import { uiStore } from "../../lib/stores/uiStore.svelte.js";
import { toastStore } from "../../lib/stores/toastStore.svelte.js";
import { modStore } from "../../lib/stores/modStore.svelte.js";
import {
  scriptDelete, touchFile, createModDirectory, moveModFile, copyModFile,
  scaffoldSeStructure, scaffoldKhonsuStructure, scaffoldOsirisStructure,
  scriptCreateFromTemplate, scriptRename, createFromExternalTemplate,
} from "../../lib/tauri/scripts.js";
import type { ExternalTemplateInfo } from "../../lib/tauri/scripts.js";
import type { FileTreeNode } from "./explorerShared.js";
import {
  isScriptFile,
  getDefaultExtForPath,
  TEMPLATE_EXT,
  SECTION_DEFAULT_EXT,
} from "./explorerShared.js";
import { m } from "../../paraglide/messages.js";

// ── Inline Create ──

export async function commitScriptCreate(params: {
  name: string;
  parent: string;
  type: 'file' | 'folder';
  modsFilePrefix: string;
  modFolder: string;
  templateId: string | null;
  templateCategory: string | null;
  externalTemplates: ExternalTemplateInfo[];
  externalSourcePaths: Record<string, string>;
  refreshModFiles: () => Promise<void>;
}): Promise<void> {
  let finalName = params.name.trim();
  const modPath = modStore.projectPath || modStore.selectedModPath;
  if (!modPath) return;

  if (params.type === 'file' && !finalName.includes('.') && params.parent) {
    const defaultExt = getDefaultExtForPath(params.parent);
    if (defaultExt) finalName = finalName + defaultExt;
  }

  if (params.templateId && params.templateCategory) {
    let templateExt = TEMPLATE_EXT[params.templateId];
    if (!templateExt) {
      const extInfo = params.externalTemplates.find(e => e.id === params.templateId);
      if (extInfo) templateExt = extInfo.extension;
    }
    if (!templateExt) templateExt = SECTION_DEFAULT_EXT[params.templateCategory];
    if (templateExt) {
      const baseName = finalName.includes('.') ? finalName.substring(0, finalName.lastIndexOf('.')) : finalName;
      finalName = baseName + templateExt;
    }
  }

  if (params.templateId && params.type === 'file') {
    const targetDir = `${params.modsFilePrefix}${params.parent}`;
    const relPath = `${targetDir}/${finalName}`;
    const variables: Record<string, string> = {
      FILE_NAME: finalName,
      MOD_NAME: params.modFolder,
      MOD_TABLE: params.modFolder.replace(/[^a-zA-Z0-9_]/g, '_'),
    };
    try {
      const sourcePath = params.externalSourcePaths[params.templateId];
      if (sourcePath) await createFromExternalTemplate(modPath, relPath, sourcePath, variables);
      else await scriptCreateFromTemplate(modPath, relPath, params.templateId, variables);
      await params.refreshModFiles();
      uiStore.openScriptTab(relPath);
      toastStore.success(m.explorer_template_created(), finalName);
    } catch (e) { toastStore.error(m.explorer_template_creation_failed(), String(e)); }
  } else if (params.type === 'file') {
    const relPath = `${params.modsFilePrefix}${params.parent}/${finalName}`;
    try { await touchFile(modPath, relPath); await params.refreshModFiles(); uiStore.openScriptTab(relPath); }
    catch (e) { toastStore.error(m.explorer_create_file_failed(), String(e)); }
  } else {
    const relPath = `${params.modsFilePrefix}${params.parent}/${params.name.trim()}`;
    try { await createModDirectory(modPath, relPath); await params.refreshModFiles(); }
    catch (e) { toastStore.error(m.explorer_create_folder_failed(), String(e)); }
  }
}

// ── Inline Rename ──

export async function commitScriptRename(params: {
  node: FileTreeNode;
  newName: string;
  modsFilePrefix: string;
  refreshModFiles: () => Promise<void>;
}): Promise<void> {
  const modPath = modStore.projectPath || modStore.selectedModPath;
  if (!modPath) return;
  const oldRelPath = `${params.modsFilePrefix}${params.node.relPath}`;
  const parentPath = params.node.relPath.substring(0, params.node.relPath.lastIndexOf('/'));
  const newRelPath = `${params.modsFilePrefix}${parentPath}/${params.newName}`;
  try {
    if (isScriptFile(params.node.extension)) await scriptRename(modPath, oldRelPath, newRelPath);
    else await moveModFile(modPath, oldRelPath, newRelPath);
    const oldTabId = `script:${oldRelPath}`;
    if (uiStore.openTabs.some(t => t.id === oldTabId)) { uiStore.closeTab(oldTabId); uiStore.openScriptTab(newRelPath); }
    await params.refreshModFiles();
    toastStore.success(m.file_explorer_renamed(), `${params.node.name} → ${params.newName}`);
    if (isScriptFile(params.node.extension)) toastStore.info(m.file_explorer_rename_xref_warning_title(), m.file_explorer_rename_xref_warning());
  } catch (e) { toastStore.error(m.explorer_rename_failed(), String(e)); }
}

// ── Scaffold ──

export async function scaffoldScriptCategory(params: {
  catKey: string;
  modFolder: string;
  refreshModFiles: () => Promise<void>;
}): Promise<void> {
  const modPath = modStore.selectedModPath;
  if (!modPath || !params.modFolder) return;
  // Rust scaffold commands construct Mods/{modFolder}/... relative to modPath (selectedModPath).
  // Tab paths must be relative to the listing root (projectPath || selectedModPath).
  const filesPrefix = modStore.modFilesPrefix;
  const modsPrefix = `Mods/${params.modFolder}/`;
  const toListingPath = (p: string): string =>
    filesPrefix !== modsPrefix && p.startsWith(modsPrefix) ? filesPrefix + p.slice(modsPrefix.length) : p;
  try {
    let created: string[];
    if (params.catKey === 'lua-se') {
      created = await scaffoldSeStructure(modPath, params.modFolder, true, true);
    } else if (params.catKey === 'khonsu') {
      created = await scaffoldKhonsuStructure(modPath, params.modFolder);
    } else if (params.catKey === 'osiris') {
      created = await scaffoldOsirisStructure(modPath, params.modFolder);
    } else if (params.catKey === 'anubis') {
      const dirPath = `Mods/${params.modFolder}/Scripts/anubis`;
      await createModDirectory(modPath, dirPath);
      const relPath = `${dirPath}/config.anc`;
      const variables = { FILE_NAME: 'config.anc', MOD_NAME: params.modFolder, MOD_TABLE: params.modFolder.replace(/[^a-zA-Z0-9_]/g, '_') };
      await scriptCreateFromTemplate(modPath, relPath, 'anubis_config', variables);
      created = [relPath];
    } else if (params.catKey === 'constellations') {
      const dirPath = `Mods/${params.modFolder}/Scripts/constellations`;
      await createModDirectory(modPath, dirPath);
      const relPath = `${dirPath}/config.clc`;
      const variables = { FILE_NAME: 'config.clc', MOD_NAME: params.modFolder, MOD_TABLE: params.modFolder.replace(/[^a-zA-Z0-9_]/g, '_') };
      await scriptCreateFromTemplate(modPath, relPath, 'constellations_config', variables);
      created = [relPath];
    } else { return; }
    if (created.length > 0) {
      await params.refreshModFiles();
      toastStore.success(m.explorer_scaffold_created(), m.explorer_scaffold_created_desc({ count: String(created.length) }));
      uiStore.openScriptTab(toListingPath(created[0]));
    }
  } catch (e) { toastStore.error(m.explorer_scaffold_failed(), String(e)); }
}

// ── Paste ──

export async function pasteScriptNode(params: {
  clipboardNode: FileTreeNode;
  clipboardOp: 'cut' | 'copy';
  targetNode: FileTreeNode;
  modsFilePrefix: string;
  refreshModFiles: () => Promise<void>;
}): Promise<boolean> {
  const modPath = modStore.projectPath || modStore.selectedModPath;
  if (!modPath) return false;
  const srcRelPath = `${params.modsFilePrefix}${params.clipboardNode.relPath}`;
  const destDir = params.targetNode.isFile
    ? params.targetNode.relPath.substring(0, params.targetNode.relPath.lastIndexOf('/'))
    : params.targetNode.relPath;
  const destRelPath = `${params.modsFilePrefix}${destDir}/${params.clipboardNode.name}`;
  try {
    if (params.clipboardOp === 'cut') await moveModFile(modPath, srcRelPath, destRelPath);
    else await copyModFile(modPath, srcRelPath, destRelPath);
    await params.refreshModFiles();
    return true;
  } catch (e) {
    toastStore.error(m.explorer_paste_failed(), String(e));
    return false;
  }
}
