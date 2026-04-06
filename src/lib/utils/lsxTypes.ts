/** Rendering category for form fields derived from LSX attr_type. */
export type FieldRenderType = 'text' | 'number' | 'float' | 'boolean' | 'uuid' | 'loca' | 'color' | 'textarea' | 'enum' | 'vector';

/** UUID regex pattern for detecting UUID-like example values */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Color hex pattern */
const COLOR_RE = /^#[0-9A-Fa-f]{6,9}$/;

/**
 * Classify an LSX attr_type to a form rendering category.
 * Uses type string, attribute name heuristics, and example value analysis.
 */
export function classifyLsxType(attrType: string, attrName: string, examples?: string[]): FieldRenderType {
  // Exact type matches
  if (attrType === 'bool') return 'boolean';

  // Integer types
  if (/^(?:int8|int16|int32|int64|uint8|uint16|uint32|uint64)$/.test(attrType)) return 'number';

  // Float types
  if (/^(?:float|double|float64)$/.test(attrType)) return 'float';

  // GUID type
  if (attrType === 'guid') return 'uuid';

  // Translated string types → loca
  if (attrType === 'TranslatedString' || attrType === 'TranslatedFSString') return 'loca';

  // Vector types
  if (/^(?:fvec[234]|ivec[234])$/.test(attrType)) return 'vector';

  // String-like types with heuristic upgrades
  if (attrType === 'FixedString' || attrType === 'LSString' || attrType === 'LSWString') {
    // Name-based heuristics
    if (/(?:UUID|Guid|Id)$/i.test(attrName) && examples?.some(e => UUID_RE.test(e))) return 'uuid';
    if (/^(?:Description|DisplayName|DisplayDescription)$/i.test(attrName)) return 'loca';
    if (examples?.some(e => COLOR_RE.test(e))) return 'color';
    return 'text';
  }

  return 'text';
}

/**
 * Map FieldRenderType to SECTION_CAPS-compatible simplified type string.
 * This bridges between schema attr_type classification and existing LayoutCell rendering.
 */
export function renderTypeToFieldType(renderType: FieldRenderType): string {
  switch (renderType) {
    case 'number': return 'int';
    case 'float': return 'float';
    case 'boolean': return 'bool';
    case 'uuid': return 'string (UUID)';
    case 'loca': return 'string';
    case 'color': return 'string';
    case 'textarea': return 'string';
    case 'vector': return 'string';
    case 'text': return 'string';
    default: return 'string';
  }
}

/** Maps common UUID field name prefixes to section combobox descriptors. */
export const UUID_SECTION_MAP: Record<string, string> = {
  Race: "section:Races",
  SubRace: "section:Races",
  Background: "section:Backgrounds",
  Class: "section:ClassDescriptions",
  Origin: "section:Origins",
  God: "section:Gods",
  Progression: "section:Progressions",
  Feat: "section:Feats",
  Tag: "section:Tags",
  Spell: "section:Spells",
  ParentGuid: "section:RootTemplates",
  ParentTemplateId: "section:RootTemplates",
  RootTemplate: "section:RootTemplates",
  EquipmentType: "section:EquipmentTypes",
  ActionResource: "section:ActionResources",
  VoiceTable: "voiceTable:",
  ProgressionTable: "progressionTable:",
};

/**
 * Infer a combobox descriptor for a schema attribute, or undefined if none.
 */
export function inferComboboxDescriptor(
  attrName: string,
  _attrType: string,
  renderType: FieldRenderType,
  _examples?: string[],
): string | undefined {
  // TranslatedString → loca: combobox
  if (renderType === 'loca') return 'loca:';

  // UUID fields: check name-based mapping
  if (renderType === 'uuid') {
    // Exact matches first
    if (UUID_SECTION_MAP[attrName]) return UUID_SECTION_MAP[attrName];

    // Strip common suffixes and try prefix
    const stripped = attrName.replace(/(?:UUID|Guid|Id)$/i, '');
    if (stripped && UUID_SECTION_MAP[stripped]) return UUID_SECTION_MAP[stripped];
  }

  return undefined;
}
