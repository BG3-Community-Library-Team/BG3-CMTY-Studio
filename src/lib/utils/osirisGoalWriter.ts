/**
 * Osiris goal file generation for race tag DB_RaceTags pairs.
 * Pure functions — no store dependencies, no side effects, fully testable.
 */

export interface RaceTagPair {
  raceTagName: string;   // Uppercase tag name without pipes (e.g., "DUNMER")
  raceTagUuid: string;
  reallyTagName: string; // Uppercase REALLY tag name without pipes (e.g., "REALLY_DUNMER")
  reallyTagUuid: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAGNAME_RE = /^[A-Z0-9_]+$/;

/**
 * Derives the Osiris GUIDSTRING identifier for a tag.
 * Strips pipe wrapping, uppercases, and prepends to the UUID.
 * Example: "|Dunmer|" + "a1b2c3d4-..." → "DUNMER_a1b2c3d4-..."
 */
export function toOsirisGuidString(tagName: string, uuid: string): string {
  const stripped = tagName.replace(/^\|/, '').replace(/\|$/, '').toUpperCase();
  if (!TAGNAME_RE.test(stripped)) {
    throw new Error(`Invalid tag name for Osiris: "${stripped}" — must be uppercase alphanumeric + underscores`);
  }
  if (!UUID_RE.test(uuid)) {
    throw new Error(`Invalid UUID for Osiris goal file: "${uuid}"`);
  }
  return `${stripped}_${uuid}`;
}

/**
 * Generates the complete Osiris goal file content.
 * Returns empty string if pairs is empty (caller should skip file emission).
 */
export function generateRaceTagGoalFile(pairs: RaceTagPair[]): string {
  if (pairs.length === 0) return '';

  const dbLines = pairs.map(({ raceTagName, raceTagUuid, reallyTagName, reallyTagUuid }) =>
    `DB_RaceTags(${toOsirisGuidString(raceTagName, raceTagUuid)}, ${toOsirisGuidString(reallyTagName, reallyTagUuid)});`
  );

  return [
    'Version 1',
    'SubGoalCombiner SGC_AND',
    '',
    'INITSECTION',
    ...dbLines,
    '',
    'KBSECTION',
    '',
    'EXITSECTION',
    '',
    'ENDEXITSECTION',
    '',
    'ParentTargetEdge "__Shared_Campaign"',
  ].join('\n') + '\n';
}
