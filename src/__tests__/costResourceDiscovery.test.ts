import { describe, it, expect } from 'vitest';
import {
  parseCostFieldValue,
  serializeCostFieldValue,
  mergeCostResourceOptions,
  rowToCostResourceOption,
  getCostResourceMaxLevel,
  type CostResourceOption,
} from '../lib/services/costResourceDiscovery.js';
import type { EntryRow } from '../lib/types/entryRow.js';

function makeRow(overrides: Partial<EntryRow>): EntryRow {
  return {
    _pk: '1',
    _pk_column: 'UUID',
    _table: 'lsx__ActionResources',
    _is_new: false,
    _is_modified: false,
    _is_deleted: false,
    _source_type: 'lsx',
    ...overrides,
  };
}

describe('costResourceDiscovery', () => {
  describe('parseCostFieldValue', () => {
    it('parses resource, quantity, and optional level', () => {
      expect(parseCostFieldValue('ActionPoint:1;SpellSlot:1:3')).toEqual([
        { resource: 'ActionPoint', quantity: '1', level: '' },
        { resource: 'SpellSlot', quantity: '1', level: '3' },
      ]);
    });

    it('returns empty array for empty input', () => {
      expect(parseCostFieldValue('')).toEqual([]);
    });
  });

  describe('serializeCostFieldValue', () => {
    it('serializes entries without level when max level is not used', () => {
      expect(serializeCostFieldValue([
        { resource: 'ActionPoint', quantity: '1', level: '' },
      ])).toBe('ActionPoint:1');
    });

    it('serializes entries with level when present', () => {
      expect(serializeCostFieldValue([
        { resource: 'SpellSlot', quantity: '1', level: '4' },
      ])).toBe('SpellSlot:1:4');
    });
  });

  describe('rowToCostResourceOption', () => {
    it('creates resource options from staging rows', () => {
      expect(rowToCostResourceOption(makeRow({ Name: 'SpellSlot', MaxLevel: '9' }), 'resource')).toEqual({
        name: 'SpellSlot',
        label: 'SpellSlot',
        maxLevel: 9,
        kind: 'resource',
      });
    });

    it('returns null for deleted rows', () => {
      expect(rowToCostResourceOption(makeRow({ Name: 'SpellSlot', _is_deleted: true }), 'resource')).toBeNull();
    });
  });

  describe('mergeCostResourceOptions', () => {
    const vanilla: CostResourceOption[] = [
      { name: 'ActionPoint', label: 'ActionPoint', maxLevel: 0, kind: 'resource' },
      { name: 'SpellSlot', label: 'SpellSlot', maxLevel: 9, kind: 'resource' },
      { name: 'SpellSlotsGroup', label: 'SpellSlotsGroup (Group)', maxLevel: 0, kind: 'group' },
    ];

    it('overrides vanilla definitions with staging rows', () => {
      const merged = mergeCostResourceOptions(
        vanilla,
        [makeRow({ Name: 'SpellSlot', MaxLevel: '6' })],
        [],
      );
      expect(merged.find(option => option.name === 'SpellSlot')?.maxLevel).toBe(6);
    });

    it('removes deleted staging entries from the merged list', () => {
      const merged = mergeCostResourceOptions(
        vanilla,
        [makeRow({ Name: 'ActionPoint', _is_deleted: true })],
        [],
      );
      expect(merged.find(option => option.name === 'ActionPoint')).toBeUndefined();
    });

    it('adds staged action resource groups', () => {
      const merged = mergeCostResourceOptions(
        vanilla,
        [],
        [makeRow({ Name: 'CustomGroup', _table: 'lsx__ActionResourceGroups' })],
      );
      expect(merged.find(option => option.name === 'CustomGroup')).toEqual({
        name: 'CustomGroup',
        label: 'CustomGroup (Group)',
        maxLevel: 0,
        kind: 'group',
      });
    });

    it('sorts action resource groups before resources and alphabetizes within each type', () => {
      const merged = mergeCostResourceOptions(
        [
          { name: 'RagePoint', label: 'RagePoint', maxLevel: 0, kind: 'resource' },
          { name: 'ActionPoint', label: 'ActionPoint', maxLevel: 0, kind: 'resource' },
          { name: 'ZetaGroup', label: 'ZetaGroup (Group)', maxLevel: 0, kind: 'group' },
          { name: 'AlphaGroup', label: 'AlphaGroup (Group)', maxLevel: 0, kind: 'group' },
        ],
        [],
        [],
      );

      expect(merged.map(option => option.name)).toEqual([
        'AlphaGroup',
        'ZetaGroup',
        'ActionPoint',
        'RagePoint',
      ]);
    });
  });

  describe('getCostResourceMaxLevel', () => {
    it('looks up max level by resource name', () => {
      expect(getCostResourceMaxLevel('SpellSlot', [
        { name: 'SpellSlot', label: 'SpellSlot', maxLevel: 9, kind: 'resource' },
      ])).toBe(9);
    });

    it('returns zero for unknown resources', () => {
      expect(getCostResourceMaxLevel('Missing', [])).toBe(0);
    });
  });
});