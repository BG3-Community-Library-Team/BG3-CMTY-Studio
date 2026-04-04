/**
 * PF-030: Contextual Help Tooltips — field-level help text.
 *
 * Keys follow the pattern "section::field" for section-specific fields,
 * or just "field" for global field types.  "section" alone provides
 * the section-level description.
 */

export const FIELD_HELP: Record<string, string> = {
  // ── Section-level help ────────────────────────────────────

  "Races":
    "Configures race modifications — cosmetic options, tags, abilities, and stat changes.  Each entry targets a race by UUID.",
  "Progressions":
    "Defines class/subclass progression changes — spells, passives, selectors, and feature unlocks at each level.",
  "Lists":
    "Manages shared lists (SpellList, PassiveList, SkillList, etc.) that Progressions and other entries reference by UUID.",
  "Feats":
    "Configures feat modifications — selectors, passives, and ability score improvements granted by feats.",
  "Origins":
    "Assigns origin-specific overrides — tags, passives, and flags for custom or vanilla origin characters.",
  "Backgrounds":
    "Defines background modifications — passives and tags associated with character backgrounds.",
  "BackgroundGoals":
    "Configures background inspiration goals — the events that award inspiration for each background.",
  "ActionResources":
    "Defines custom action resources (e.g. spell slots, ki points, sorcery points) and their progression.",
  "ActionResourceGroups":
    "Groups related action resources together for UI display (e.g. all spell slot levels in one group).",
  "ClassDescriptions":
    "Configures class and subclass metadata — display names, icons, parent classes, and equipment.",
  "Spells":
    "Modifies individual spell data entries — stat fields, tooltips, and spell properties.",

  // ── Common fields ─────────────────────────────────────────

  "UUID":
    "A unique identifier (GUID) for this entry.  Must match the target entry in the game data.  Format: 8-4-4-4-12 hexadecimal.",
  "UUIDs":
    "Pipe-separated list of UUIDs for entries that target multiple IDs (e.g. the same list used for several subclasses).",
  "Action":
    "The action to perform: usually 'Insert' to add values or 'Remove' to strip them.",
  "Type":
    "The data type of the list items (e.g. 'SpellList', 'PassiveList', 'SkillList').",
  "Name":
    "A human-readable name or identifier for this entry.",
  "EntryName":
    "The stat entry name (used in Spells section).  Must match the game data stat ID exactly.",
  "modGuid":
    "The mod GUID that owns the values being inserted. Should be the target mod's UUID, NOT your own mod's UUID.",
  "Blacklist":
    "When 'true', removes this subclass from the class selection screen instead of adding it.",

  // ── Progressions fields ───────────────────────────────────

  "Progressions::Selectors":
    "Selector entries define player choices at this level — feats, spells known, cantrips, skill proficiencies, etc.",
  "Progressions::Selectors::Action":
    "Use 'AddSelector' to insert a new choice, or 'ReplaceSelector' to override an existing one.",
  "Progressions::Selectors::Function":
    "The selector type: SelectSpells, SelectPassives, SelectSkills, SelectAbilityBonus, etc.",
  "Progressions::Selectors::Overwrite":
    "When 'true', this selector replaces an existing one with the same key. When 'false', it adds alongside existing selectors.",
  "Progressions::Strings":
    "String values added to this progression: typically Passives, Boosts, or spell slot specifications.",
  "Progressions::Strings::Action":
    "Use 'Insert' to add or 'Remove' to delete the string values from this progression.",
  "Progressions::Strings::Type":
    "The string category: 'PassivesAdded', 'PassivesRemoved', 'Boosts', 'Boosts2', etc.",
  "Progressions::Strings::Values":
    "Semicolon-separated list of the actual values (passive names, boost strings, etc.).",
  "Progressions::Booleans":
    "Boolean flags for this progression: 'AllowImprovement' (enables ASI), 'IsMulticlass', etc.",

  // ── Lists fields ──────────────────────────────────────────

  "Lists::Items":
    "The UUIDs or stat IDs to add/remove from this list, separated by semicolons.",
  "Lists::Inherit":
    "A UUID of another list whose contents this list inherits (copies entries from).",
  "Lists::Exclude":
    "UUIDs of entries to exclude from an inherited list.",

  // ── Races fields ──────────────────────────────────────────

  "Races::Children":
    "Child entries attached to this race — Tags, Gods, Visuals, EyeColors, HairColors, SkinColors, etc.",
  "Races::Children::Type":
    "The child category: Tags, Gods, Visuals, EyeColors, HairColors, SkinColors, MakeupColors, TattooColors.",
  "Races::Children::Values":
    "Semicolon-separated UUIDs of the child entries to add or remove.",
  "Races::Children::Action":
    "Use 'Insert' to add children or 'Remove' to delete them.",

  // ── Spells fields ─────────────────────────────────────────

  "Spells::SpellField":
    "A data field on the spell stat entry.  Common fields: SpellType, Level, SpellSchool, TargetConditions, etc.",

  // ── ClassDescriptions fields ──────────────────────────────

  "ClassDescriptions::Subclasses":
    "Defines which subclass UUIDs are added to or removed from this class.",
  "ClassDescriptions::Subclasses::Action":
    "Use 'Insert' to add a subclass or 'Remove' to hide it from the selection screen.",
  "ClassDescriptions::Subclasses::UUID":
    "The ClassDescription UUID of the subclass to add or remove.",

  // ── ActionResources fields ────────────────────────────────

  "ActionResources::MaxLevel":
    "The highest level at which this resource is available.",
  "ActionResources::MaxValue":
    "The maximum amount of this resource the character can have.",
  "ActionResources::ReplenishType":
    "How the resource replenishes: 'ShortRest', 'LongRest', 'Never', etc.",

  // ── Badge labels ──────────────────────────────────────────

  "badge::MOD":
    "Modified — this entry was changed by the mod compared to vanilla.",
  "badge::NEW":
    "New — this entry was added by the mod and does not exist in vanilla data.",
  "badge::IMP":
    "Imported — this entry was loaded from an existing config file.",
  "badge::MAN":
    "Manual — this entry was created manually by the user in the form.",
  "badge::EDIT":
    "Edited — this auto-detected entry has manual field overrides applied.",
  "badge::warning":
    "This entry may have issues — check the form for validation warnings.",
};

/**
 * Look up help text for a given key.
 * Returns undefined if no help text exists (tooltip should not render).
 */
export function getHelpText(key: string): string | undefined {
  return FIELD_HELP[key];
}
