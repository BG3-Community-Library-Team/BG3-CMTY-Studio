export const DEFAULT_INHERITANCE_IGNORED_KEYS = ["Using"] as const;

export type InheritanceFieldStatus = "inherited" | "overridden" | "new";

export interface InheritanceComparisonOptions {
  ignoreKeys?: Iterable<string>;
}

export interface InheritanceComparison {
  inheritedKeys: string[];
  overriddenKeys: string[];
  newKeys: string[];
}

function buildIgnoreSet(options?: InheritanceComparisonOptions): Set<string> {
  return new Set(options?.ignoreKeys ?? DEFAULT_INHERITANCE_IGNORED_KEYS);
}

export function getInheritanceFieldStatus(
  fieldKey: string,
  parentFields: Record<string, string>,
  childFields: Record<string, string>,
  options?: InheritanceComparisonOptions,
): InheritanceFieldStatus | null {
  const ignoreKeys = buildIgnoreSet(options);
  if (ignoreKeys.has(fieldKey)) return null;

  const hasParentField = Object.prototype.hasOwnProperty.call(parentFields, fieldKey);
  const hasChildField = Object.prototype.hasOwnProperty.call(childFields, fieldKey);

  if (hasParentField) {
    if (!hasChildField) return "inherited";
    return parentFields[fieldKey] === childFields[fieldKey] ? "inherited" : "overridden";
  }

  return hasChildField ? "new" : null;
}

export function compareInheritanceFields(
  parentFields: Record<string, string>,
  childFields: Record<string, string>,
  options?: InheritanceComparisonOptions,
): InheritanceComparison {
  const keys = new Set([...Object.keys(parentFields), ...Object.keys(childFields)]);

  const inheritedKeys: string[] = [];
  const overriddenKeys: string[] = [];
  const newKeys: string[] = [];

  for (const fieldKey of [...keys].sort()) {
    const status = getInheritanceFieldStatus(fieldKey, parentFields, childFields, options);
    if (status === "inherited") inheritedKeys.push(fieldKey);
    if (status === "overridden") overriddenKeys.push(fieldKey);
    if (status === "new") newKeys.push(fieldKey);
  }

  return {
    inheritedKeys,
    overriddenKeys,
    newKeys,
  };
}

export function isInheritedField(
  fieldKey: string,
  parentFields: Record<string, string>,
  childFields: Record<string, string>,
  options?: InheritanceComparisonOptions,
): boolean {
  return getInheritanceFieldStatus(fieldKey, parentFields, childFields, options) === "inherited";
}

export function isOverriddenField(
  fieldKey: string,
  parentFields: Record<string, string>,
  childFields: Record<string, string>,
  options?: InheritanceComparisonOptions,
): boolean {
  return getInheritanceFieldStatus(fieldKey, parentFields, childFields, options) === "overridden";
}

export function isNewField(
  fieldKey: string,
  parentFields: Record<string, string>,
  childFields: Record<string, string>,
  options?: InheritanceComparisonOptions,
): boolean {
  return getInheritanceFieldStatus(fieldKey, parentFields, childFields, options) === "new";
}