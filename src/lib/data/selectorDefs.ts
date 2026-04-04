/**
 * Selector function definitions for the CF Selector API.
 *
 * Contains:
 * - SELECTOR_FUNCTIONS: Available selector function names
 * - SELECTOR_PARAMS_BY_FN: Which Params fields are relevant per function type
 * - PARAM_PLACEHOLDERS: Human-friendly placeholder text per param field
 * - emptyParams(): Factory for empty params objects
 *
 * Note (gotchas §10.1.16): SELECTOR_PARAMS_BY_FN here defines which params
 * each function supports in the UI. SELECTOR_POSITIONAL_PARAMS in
 * selectorParser.ts defines param order for parsing raw LSX strings.
 * These two maps must stay in sync.
 */

/** Selector Function options per the CF Selector API */
export const SELECTOR_FUNCTIONS = [
  "SelectSpells", "AddSpells", "SelectSkills", "SelectAbilities",
  "SelectAbilityBonus", "SelectEquipment", "SelectSkillsExpertise", "SelectPassives",
] as const;

export type SelectorFunctionName = typeof SELECTOR_FUNCTIONS[number];

/** Which Params fields are relevant for each Function type */
export const SELECTOR_PARAMS_BY_FN: Record<string, string[]> = {
  SelectSpells:          ["Guid", "Amount", "SwapAmount", "SelectorId", "CastingAbility", "ActionResource", "PrepareType", "CooldownType"],
  AddSpells:             ["Guid", "SelectorId", "CastingAbility", "ActionResource", "PrepareType", "CooldownType"],
  SelectSkills:          ["Guid", "Amount", "SelectorId"],
  SelectAbilities:       ["Guid", "Amount", "SelectorId"],
  SelectAbilityBonus:    ["Guid", "Amount", "BonusType", "Amounts"],
  SelectEquipment:       ["Guid", "Amount", "SelectorId"],
  SelectSkillsExpertise: ["Guid", "Amount", "LimitToProficiency", "SelectorId"],
  SelectPassives:        ["Guid", "Amount", "SelectorId"],
};

/** Human-friendly placeholder text for Params fields */
export const PARAM_PLACEHOLDERS: Record<string, string> = {
  Guid: "UUID of list",
  Amount: "Number of selections (default 1)",
  SwapAmount: "Spells that can be swapped (default 0)",
  SelectorId: "SelectorId (e.g. BardCantrip)",
  CastingAbility: "Casting ability (e.g. Charisma)",
  ActionResource: "Action Resource UUID (optional)",
  PrepareType: "AlwaysPrepared or Default",
  CooldownType: "UntilRest or Default",
  BonusType: "AbilityBonus",
  Amounts: "Comma-separated amounts (e.g. 2,1)",
  LimitToProficiency: "true or false (default true)",
};

/** Selector param fields shape. */
export interface SelectorParamValues {
  Guid: string;
  Amount: string;
  SwapAmount: string;
  SelectorId: string;
  CastingAbility: string;
  ActionResource: string;
  PrepareType: string;
  CooldownType: string;
  BonusType: string;
  Amounts: string;
  LimitToProficiency: string;
}

/** Create an empty params object with all fields set to "". */
export function emptyParams(): SelectorParamValues {
  return {
    Guid: "", Amount: "", SwapAmount: "", SelectorId: "",
    CastingAbility: "", ActionResource: "", PrepareType: "",
    CooldownType: "", BonusType: "", Amounts: "", LimitToProficiency: "",
  };
}

/** BonusType preset options */
export const BONUS_TYPE_OPTIONS = [
  { value: "AbilityBonus", label: "AbilityBonus" },
  { value: "SavingThrowBonus", label: "SavingThrowBonus" },
];
