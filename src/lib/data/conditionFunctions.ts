export interface ConditionFunctionDef {
  /** Function name as it appears in expressions */
  name: string;
  /** Brief description of what the function checks */
  description: string;
  /** Parameter signature (for tooltip display) */
  params?: string;
  /** Which expression contexts this function is most relevant in */
  contexts: ConditionContext[];
}

export type ConditionContext =
  | 'target'      // TargetConditions — who/what can be targeted
  | 'requirement' // RequirementConditions — caster requirements
  | 'passive'     // Passive Conditions, BoostConditions
  | 'interrupt'   // Interrupt Conditions, EnableCondition
  | 'filter'      // MetaCondition Filter
  | 'general';    // Applicable everywhere

export const CONDITION_FUNCTIONS: ConditionFunctionDef[] = [
  // Entity checks
  { name: 'Self', description: 'The caster / source entity', contexts: ['target', 'general'] },
  { name: 'Ally', description: 'Target is an ally', contexts: ['target', 'general'] },
  { name: 'Enemy', description: 'Target is an enemy', contexts: ['target', 'general'] },
  { name: 'Character', description: 'Target is a character (not item)', contexts: ['target', 'general'] },
  { name: 'Item', description: 'Target is an item', contexts: ['target', 'general'] },
  { name: 'Dead', description: 'Target is dead', contexts: ['target', 'general'] },
  // Status & passive checks
  { name: 'HasStatus', description: 'Entity has the specified status', params: 'statusName: string', contexts: ['target', 'passive', 'general'] },
  { name: 'HasAppliedStatus', description: 'Entity has applied the specified status', params: 'statusName: string', contexts: ['general'] },
  { name: 'HasAnyStatus', description: 'Entity has any active status', contexts: ['target', 'general'] },
  { name: 'HasPassive', description: 'Entity has the specified passive', params: 'passiveName: string', contexts: ['target', 'passive', 'general'] },
  // Tag & flag checks
  { name: 'Tagged', description: 'Entity has the specified tag', params: 'tagName: string', contexts: ['target', 'passive', 'general'] },
  { name: 'HasFlag', description: 'Entity has the specified flag', params: 'flagName: string', contexts: ['general'] },
  // Spell checks (primarily for MetaCondition filters)
  { name: 'SpellId', description: 'Matches a specific spell by name', params: 'spellName: string', contexts: ['filter', 'general'] },
  { name: 'IsSpellOfSchool', description: 'Spell belongs to a school of magic', contexts: ['filter', 'general'] },
  { name: 'HasSpellFlag', description: 'Spell has a specific flag', params: 'flagName: string', contexts: ['filter', 'general'] },
  { name: 'HasUseCosts', description: 'Spell has specific use costs', contexts: ['filter', 'general'] },
  { name: 'HasFunctor', description: 'Spell has a specific functor', contexts: ['filter', 'general'] },
  // Combat & distance
  { name: 'Distance', description: 'Distance-based check', contexts: ['target', 'general'] },
  { name: 'GetDistanceTo', description: 'Get distance to entity', contexts: ['general'] },
  { name: 'IsInCombat', description: 'Entity is in combat', contexts: ['passive', 'interrupt', 'general'] },
  { name: 'WieldingWeapon', description: 'Entity wields weapon with tag', params: 'weaponTag: string', contexts: ['target', 'passive', 'interrupt', 'general'] },
  // Class & ability checks
  { name: 'IsClass', description: 'Entity is the specified class', params: 'className: string', contexts: ['requirement', 'general'] },
  { name: 'HasSpell', description: 'Entity has the specified spell', params: 'spellName: string', contexts: ['requirement', 'general'] },
  { name: 'HasProficiency', description: 'Entity has the specified proficiency', params: 'proficiency: string', contexts: ['requirement', 'general'] },
  { name: 'HasActionResource', description: 'Entity has the specified action resource', params: 'resource: string', contexts: ['requirement', 'general'] },
  { name: 'GetLevel', description: 'Get entity level', contexts: ['requirement', 'general'] },
  { name: 'GetBaseAbility', description: 'Get base ability score', params: 'ability: string', contexts: ['requirement', 'general'] },
  { name: 'GetAbilityModifier', description: 'Get ability modifier', params: 'ability: string', contexts: ['general'] },
  { name: 'GetProficiencyBonus', description: 'Get proficiency bonus', contexts: ['general'] },
  // Utility
  { name: 'ConditionResult', description: 'Wrap result with error messages (Khonsu only)', contexts: ['general'] },
  { name: 'StatusGetDescriptionParam', description: 'Get status description parameter', contexts: ['general'] },
];
