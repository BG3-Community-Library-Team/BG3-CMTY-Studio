/**
 * Maps each Race child type to its vanilla data source for combobox population.
 *
 * Store types:
 *   - "ccpresets" = CharacterCreationPresets folder (EyeColors, HairColors, SkinColors) — has UIColor
 *   - "cc" = CharacterCreation folder filtered by node type (Tattoo, Makeup, Horn, etc.) — has UIColor
 *   - "color" = ColorDefinitions folder — fallback for generic colors
 *   - "god" / "tag" = respective folders
 *   - "visual" = CharacterCreation folder filtered to CharacterCreationSharedVisual nodes
 */

export interface ChildTypeConfig {
  store: "ccpresets" | "cc" | "color" | "god" | "tag" | "visual" | "classdescription";
  nodeFilter?: string;
}

export const CHILD_TYPE_SOURCE: Record<string, ChildTypeConfig> = {
  EyeColors:           { store: "ccpresets", nodeFilter: "CharacterCreationEyeColor" },
  SkinColors:          { store: "ccpresets", nodeFilter: "CharacterCreationSkinColor" },
  HairColors:          { store: "ccpresets", nodeFilter: "CharacterCreationHairColor" },
  TattooColors:        { store: "color" },
  MakeupColors:        { store: "color" },
  LipsMakeupColors:    { store: "color" },
  HairGrayingColors:   { store: "color" },
  HairHighlightColors: { store: "color" },
  HornColors:          { store: "color" },
  HornTipColors:       { store: "color" },
  Gods:                { store: "god" },
  ExcludedGods:        { store: "god" },
  Tags:                { store: "tag" },
  Visuals:             { store: "visual", nodeFilter: "CharacterCreationSharedVisual" },
  Subclasses:          { store: "classdescription" },
};
