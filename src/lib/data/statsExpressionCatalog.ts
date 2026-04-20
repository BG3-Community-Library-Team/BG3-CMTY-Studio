/**
 * Catalogs of functors, boosts, targeting keywords, roll
 * functions, and enum values used in BG3 stats expression fields.
 *
 * Consumed by the statsExpressionPlugin to provide context-aware
 * autocompletion in inline CodeMirror editors for expression fields.
 */

export interface StatsExpressionDef {
  /** Function or keyword name */
  name: string;
  /** Brief description */
  description: string;
  /** Parameter signature (for display in detail) */
  params?: string;
}

// ─── Functors ──────────────────────────────────────────────────
// Used in SpellProperties, SpellSuccess, SpellFail, OnApplyFunctors,
// StatsFunctors, ToggleOnFunctors, ToggleOffFunctors, etc.

export const STATS_FUNCTORS: StatsExpressionDef[] = [
  { name: 'DealDamage', description: 'Deal damage to target', params: 'damage, damageType, magical?, nonlethal?' },
  { name: 'ApplyStatus', description: 'Apply a status effect', params: 'statusId, chance, duration' },
  { name: 'RegainHitPoints', description: 'Restore hit points', params: 'amount, type?' },
  { name: 'RemoveStatus', description: 'Remove a status effect', params: 'statusId' },
  { name: 'SavingThrow', description: 'Force a saving throw', params: 'ability, dc' },
  { name: 'Force', description: 'Push/pull target', params: 'distance, origin?, flyOverhead?' },
  { name: 'Summon', description: 'Summon a creature', params: 'template, duration, stat?, aiFlags?' },
  { name: 'SummonInInventory', description: 'Summon item in inventory', params: 'template, count?, isParty?' },
  { name: 'CreateSurface', description: 'Create a surface', params: 'radius, duration, surfaceType' },
  { name: 'CreateExplosion', description: 'Create an explosion', params: 'explosionId' },
  { name: 'FireProjectile', description: 'Fire a projectile', params: 'projectileId' },
  { name: 'Kill', description: 'Kill the target' },
  { name: 'Resurrect', description: 'Resurrect target', params: 'hpPercentage?' },
  { name: 'Stabilize', description: 'Stabilize a dying target' },
  { name: 'Teleport', description: 'Teleport target', params: 'distance' },
  { name: 'RestoreResource', description: 'Restore an action resource', params: 'resource, amount, level?' },
  { name: 'Counterspell', description: 'Counter a spell' },
  { name: 'Douse', description: 'Douse fires/surfaces', params: 'radius?, amount?' },
  { name: 'ExecuteWeaponFunctors', description: 'Execute weapon functors on target' },
  { name: 'Unlock', description: 'Unlock a door/container' },
  { name: 'CreateWall', description: 'Create a wall surface' },
  { name: 'Spawn', description: 'Spawn an entity', params: 'template, count?, lifetime?' },
  { name: 'ApplyEquipmentStatus', description: 'Apply status from equipment', params: 'statusId, chance?, duration?' },
  { name: 'TriggerRandomCast', description: 'Cast a random spell', params: 'maxLevel?, canRepeat?' },
  { name: 'SetStatusDuration', description: 'Set status duration', params: 'statusId, duration, changeType?' },
  { name: 'UseSpell', description: 'Cast a spell', params: 'spellId' },
  { name: 'SpawnExtraProjectiles', description: 'Spawn additional projectiles', params: 'count' },
  { name: 'UseAttack', description: 'Perform an attack' },
  { name: 'GainTemporaryHitPoints', description: 'Gain temporary HP', params: 'amount' },
  { name: 'RemoveUniqueStatus', description: 'Remove unique status', params: 'statusId' },
  { name: 'DisarmWeapon', description: 'Disarm target weapon' },
  { name: 'SwapPlaces', description: 'Swap positions with target' },
  { name: 'Pickup', description: 'Pick up a template', params: 'templateId' },
];

// ─── Boosts ────────────────────────────────────────────────────
// Used in Boosts, BoostsOnEquip, PassiveData.Boosts, StatusData.Boosts

export const STATS_BOOSTS: StatsExpressionDef[] = [
  { name: 'AC', description: 'Armor Class bonus', params: 'amount' },
  { name: 'Ability', description: 'Ability score bonus', params: 'ability, amount' },
  { name: 'Skill', description: 'Skill check bonus', params: 'skill, amount' },
  { name: 'ProficiencyBonus', description: 'Proficiency bonus', params: 'amount' },
  { name: 'ActionResource', description: 'Action resource bonus', params: 'resource, amount, level?' },
  { name: 'ActionResourceMultiplier', description: 'Action resource multiplier', params: 'resource, multiplier, level?' },
  { name: 'CharacterWeaponDamage', description: 'Weapon damage bonus', params: 'amount, damageType?' },
  { name: 'DamageBonus', description: 'Damage bonus', params: 'amount, damageType?' },
  { name: 'Resistance', description: 'Damage resistance', params: 'damageType, resistanceType' },
  { name: 'Advantage', description: 'Grant advantage', params: 'rollType' },
  { name: 'Disadvantage', description: 'Impose disadvantage', params: 'rollType' },
  { name: 'CriticalHit', description: 'Critical hit modifier', params: 'type, value, condition?' },
  { name: 'Initiative', description: 'Initiative bonus', params: 'amount' },
  { name: 'RollBonus', description: 'Roll bonus', params: 'rollType, amount, ability?' },
  { name: 'SpellDC', description: 'Spell DC modifier', params: 'amount' },
  { name: 'SpellSaveDC', description: 'Spell save DC', params: 'amount' },
  { name: 'MovementSpeedLimit', description: 'Movement speed limit', params: 'type' },
  { name: 'UnlockSpell', description: 'Unlock a spell', params: 'spellId, ability?, cooldownType?' },
  { name: 'UnlockSpellVariant', description: 'Unlock spell variant', params: 'spellId, condition?' },
  { name: 'Tag', description: 'Apply a tag', params: 'tagId' },
  { name: 'StatusImmunity', description: 'Status immunity', params: 'statusId' },
  { name: 'Sight', description: 'Sight range', params: 'range' },
  { name: 'DarkvisionRange', description: 'Darkvision range', params: 'range' },
  { name: 'ConcentrationIgnoreDamage', description: 'Ignore concentration damage', params: 'type' },
  { name: 'BlockAbilityModifierFromAC', description: 'Block ability modifier from AC', params: 'ability' },
  { name: 'MonkWeaponDamageDiceOverride', description: 'Override monk weapon damage dice', params: 'dice' },
  { name: 'HalveWeaponDamage', description: 'Halve weapon damage' },
  { name: 'CannotHarmCauseEntity', description: 'Cannot harm cause entity' },
  { name: 'MinimumRollResult', description: 'Minimum roll result', params: 'rollType, result' },
  { name: 'TemporaryHP', description: 'Temporary hit points', params: 'amount' },
  { name: 'Weight', description: 'Weight modifier', params: 'amount' },
  { name: 'FallDamageMultiplier', description: 'Fall damage multiplier', params: 'multiplier' },
  { name: 'Savant', description: 'Wizard Savant feature', params: 'school' },
  { name: 'WeaponProperty', description: 'Weapon property', params: 'property' },
  { name: 'AreaDamageEvade', description: 'Evade area damage' },
  { name: 'DodgeAttackRoll', description: 'Dodge attack roll', params: 'condType, condValue?' },
  { name: 'IgnoreResistance', description: 'Ignore damage resistance', params: 'damageType, resistanceType' },
  { name: 'AttackSpellOverride', description: 'Override attack spell', params: 'spellId' },
  { name: 'Lock', description: 'Lock a property', params: 'property, value' },
  { name: 'IgnoreLowGroundPenalty', description: 'Ignore low ground penalty' },
  { name: 'IgnoreSurfaceCover', description: 'Ignore surface cover' },
  { name: 'PhysicalForceRangeBonus', description: 'Physical force range bonus', params: 'amount' },
];

// ─── Targeting Keywords ────────────────────────────────────────

export const TARGETING_KEYWORDS: StatsExpressionDef[] = [
  { name: 'TARGET', description: 'Direct target of the spell' },
  { name: 'GROUND', description: 'Target the ground/floor' },
  { name: 'AOE', description: 'Area of effect entities' },
  { name: 'SELF', description: 'Change functor target to source entity' },
  { name: 'SWAP', description: 'Swap source and target entities' },
  { name: 'AI_IGNORE', description: 'AI ignores this expression' },
  { name: 'AI_ONLY', description: 'Only used by AI calculations' },
  { name: 'OBSERVER_SOURCE', description: 'Interrupt: source entity' },
  { name: 'OBSERVER_TARGET', description: 'Interrupt: target entity' },
  { name: 'OBSERVER_OBSERVER', description: 'Interrupt: observer entity' },
];

// ─── Roll Functions ────────────────────────────────────────────

export const ROLL_FUNCTIONS: StatsExpressionDef[] = [
  { name: 'Attack', description: 'Attack roll', params: 'AttackType.*' },
  { name: 'SavingThrow', description: 'Saving throw', params: 'Ability.*, DC' },
  { name: 'RawAbility', description: 'Raw ability check', params: 'Ability.*' },
  { name: 'SkillCheck', description: 'Skill check', params: 'Skill.*' },
];

// ─── Enum Values ───────────────────────────────────────────────

export const DAMAGE_TYPE_ENUM: StatsExpressionDef[] = [
  { name: 'Bludgeoning', description: 'Physical: bludgeoning' },
  { name: 'Piercing', description: 'Physical: piercing' },
  { name: 'Slashing', description: 'Physical: slashing' },
  { name: 'Fire', description: 'Elemental: fire' },
  { name: 'Cold', description: 'Elemental: cold' },
  { name: 'Lightning', description: 'Elemental: lightning' },
  { name: 'Thunder', description: 'Elemental: thunder' },
  { name: 'Poison', description: 'Elemental: poison' },
  { name: 'Acid', description: 'Elemental: acid' },
  { name: 'Necrotic', description: 'Magical: necrotic' },
  { name: 'Radiant', description: 'Magical: radiant' },
  { name: 'Psychic', description: 'Magical: psychic' },
  { name: 'Force', description: 'Magical: force' },
];

export const ATTACK_TYPE_ENUM: StatsExpressionDef[] = [
  { name: 'AttackType.MeleeWeaponAttack', description: 'Melee weapon attack' },
  { name: 'AttackType.RangedWeaponAttack', description: 'Ranged weapon attack' },
  { name: 'AttackType.MeleeSpellAttack', description: 'Melee spell attack' },
  { name: 'AttackType.RangedSpellAttack', description: 'Ranged spell attack' },
  { name: 'AttackType.MeleeUnarmedAttack', description: 'Melee unarmed attack' },
  { name: 'AttackType.RangedUnarmedAttack', description: 'Ranged unarmed attack' },
];

export const ABILITY_ENUM: StatsExpressionDef[] = [
  { name: 'Ability.Strength', description: 'Strength ability' },
  { name: 'Ability.Dexterity', description: 'Dexterity ability' },
  { name: 'Ability.Constitution', description: 'Constitution ability' },
  { name: 'Ability.Intelligence', description: 'Intelligence ability' },
  { name: 'Ability.Wisdom', description: 'Wisdom ability' },
  { name: 'Ability.Charisma', description: 'Charisma ability' },
];

// ─── Expression Syntax ─────────────────────────────────────────

export const CONDITION_OPERATORS: StatsExpressionDef[] = [
  { name: 'and', description: 'Boolean AND' },
  { name: 'or', description: 'Boolean OR' },
  { name: 'not', description: 'Boolean NOT / negation' },
];

export const FUNCTOR_WRAPPER: StatsExpressionDef = {
  name: 'IF',
  description: 'Conditional wrapper — functor only executes when condition is true',
  params: 'condition',
};
