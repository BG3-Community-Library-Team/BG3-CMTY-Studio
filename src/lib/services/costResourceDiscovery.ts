import { projectStore, sectionToTable } from '../stores/projectStore.svelte.js';
import { getCostResources, type CostResourceInfo } from '../tauri/vanilla-data.js';
import type { EntryRow } from '../types/entryRow.js';
import { localeCompare } from '../utils/localeSort.js';

export interface CostResourceOption {
  name: string;
  label: string;
  maxLevel: number;
  kind: 'resource' | 'group';
}

export interface CostFieldEntry {
  resource: string;
  quantity: string;
  level: string;
}

function parseIntField(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toOption(info: CostResourceInfo): CostResourceOption {
  const kind = info.kind === 'group' ? 'group' : 'resource';
  return {
    name: info.name,
    label: kind === 'group' ? `${info.name} (Group)` : info.name,
    maxLevel: info.max_level,
    kind,
  };
}

export function rowToCostResourceOption(row: EntryRow, kind: 'resource' | 'group'): CostResourceOption | null {
  const rawName = row.Name;
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (!name || row._is_deleted) return null;

  return {
    name,
    label: kind === 'group' ? `${name} (Group)` : name,
    maxLevel: kind === 'resource' ? parseIntField(row.MaxLevel) : 0,
    kind,
  };
}

function sortOptions(options: CostResourceOption[]): CostResourceOption[] {
  return [...options].sort((left, right) => {
    const kindOrder = (option: CostResourceOption): number => option.kind === 'group' ? 0 : 1;
    const kindDiff = kindOrder(left) - kindOrder(right);
    if (kindDiff !== 0) {
      return kindDiff;
    }

    const nameDiff = localeCompare(left.name, right.name);
    if (nameDiff !== 0) {
      return nameDiff;
    }

    return localeCompare(left.label, right.label);
  });
}

export function mergeCostResourceOptions(
  vanillaOptions: CostResourceOption[],
  stagedResourceRows: EntryRow[],
  stagedGroupRows: EntryRow[],
): CostResourceOption[] {
  const merged = new Map<string, CostResourceOption>();

  for (const option of vanillaOptions) {
    merged.set(option.name.toLowerCase(), option);
  }

  for (const row of stagedResourceRows) {
    const key = String(row.Name ?? '').trim().toLowerCase();
    if (!key) continue;
    if (row._is_deleted) {
      merged.delete(key);
      continue;
    }

    const option = rowToCostResourceOption(row, 'resource');
    if (option) merged.set(key, option);
  }

  for (const row of stagedGroupRows) {
    const key = String(row.Name ?? '').trim().toLowerCase();
    if (!key) continue;
    if (row._is_deleted) {
      merged.delete(key);
      continue;
    }

    const option = rowToCostResourceOption(row, 'group');
    if (option) merged.set(key, option);
  }

  return sortOptions([...merged.values()]);
}

async function ensureProjectSectionsLoaded(): Promise<void> {
  const resourceTable = sectionToTable('ActionResources');
  const groupTable = sectionToTable('ActionResourceGroups');
  const pending: Promise<unknown>[] = [];

  if (!projectStore.isSectionLoaded(resourceTable)) {
    pending.push(projectStore.loadSection(resourceTable));
  }
  if (!projectStore.isSectionLoaded(groupTable)) {
    pending.push(projectStore.loadSection(groupTable));
  }

  await Promise.all(pending);
}

export async function listCostResourceOptions(): Promise<CostResourceOption[]> {
  const [resources] = await Promise.all([
    getCostResources(),
    ensureProjectSectionsLoaded(),
  ]);

  const vanillaOptions = sortOptions(resources.map(toOption));

  const resourceTable = sectionToTable('ActionResources');
  const groupTable = sectionToTable('ActionResourceGroups');
  return mergeCostResourceOptions(
    vanillaOptions,
    projectStore.getEntries(resourceTable),
    projectStore.getEntries(groupTable),
  );
}

export function parseCostFieldValue(value: string): CostFieldEntry[] {
  return value
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const pieces = part.split(':');
      return {
        resource: pieces[0]?.trim() ?? '',
        quantity: pieces[1]?.trim() ?? '',
        level: pieces.slice(2).join(':').trim(),
      };
    });
}

export function serializeCostFieldValue(entries: CostFieldEntry[]): string {
  return entries
    .map(entry => {
      const resource = entry.resource.trim();
      const quantity = entry.quantity.trim();
      const level = entry.level.trim();

      if (!resource) return '';
      if (level) return `${resource}:${quantity}:${level}`;
      return quantity ? `${resource}:${quantity}` : resource;
    })
    .filter(Boolean)
    .join(';');
}

export function getCostResourceMaxLevel(resourceName: string, options: CostResourceOption[]): number {
  const match = options.find(option => option.name.toLowerCase() === resourceName.trim().toLowerCase());
  return match?.maxLevel ?? 0;
}
