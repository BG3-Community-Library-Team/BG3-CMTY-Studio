import { describe, it, expect } from "vitest";
import { CONDITION_FUNCTIONS } from "../lib/data/conditionFunctions";
import type { ConditionContext } from "../lib/data/conditionFunctions";

describe("CONDITION_FUNCTIONS catalog", () => {
  it("has 31 functions", () => {
    expect(CONDITION_FUNCTIONS.length).toBe(31);
  });

  it("all functions have non-empty names", () => {
    for (const fn of CONDITION_FUNCTIONS) {
      expect(fn.name.length).toBeGreaterThan(0);
    }
  });

  it("all functions have non-empty descriptions", () => {
    for (const fn of CONDITION_FUNCTIONS) {
      expect(fn.description.length).toBeGreaterThan(0);
    }
  });

  it("all functions have non-empty contexts array", () => {
    for (const fn of CONDITION_FUNCTIONS) {
      expect(fn.contexts.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate function names", () => {
    const names = CONDITION_FUNCTIONS.map(fn => fn.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("known core functions are present", () => {
    const names = new Set(CONDITION_FUNCTIONS.map(fn => fn.name));
    expect(names.has('HasStatus')).toBe(true);
    expect(names.has('Enemy')).toBe(true);
    expect(names.has('Self')).toBe(true);
    expect(names.has('Tagged')).toBe(true);
    expect(names.has('SpellId')).toBe(true);
    expect(names.has('ConditionResult')).toBe(true);
  });

  it("target context includes entity checks", () => {
    const targetFns = CONDITION_FUNCTIONS.filter(fn => fn.contexts.includes('target'));
    const targetNames = new Set(targetFns.map(fn => fn.name));
    expect(targetNames.has('Self')).toBe(true);
    expect(targetNames.has('Ally')).toBe(true);
    expect(targetNames.has('Enemy')).toBe(true);
    expect(targetNames.has('Character')).toBe(true);
    expect(targetNames.has('Dead')).toBe(true);
  });

  it("filter context includes spell checks", () => {
    const filterFns = CONDITION_FUNCTIONS.filter(fn => fn.contexts.includes('filter'));
    const filterNames = new Set(filterFns.map(fn => fn.name));
    expect(filterNames.has('SpellId')).toBe(true);
    expect(filterNames.has('HasSpellFlag')).toBe(true);
    expect(filterNames.has('IsSpellOfSchool')).toBe(true);
  });

  it("functions with params have non-empty params string", () => {
    const withParams = CONDITION_FUNCTIONS.filter(fn => fn.params);
    expect(withParams.length).toBeGreaterThan(0);
    for (const fn of withParams) {
      expect(fn.params!.length).toBeGreaterThan(0);
    }
  });

  it("all context values are valid", () => {
    const validContexts: ConditionContext[] = ['target', 'requirement', 'passive', 'interrupt', 'filter', 'general'];
    for (const fn of CONDITION_FUNCTIONS) {
      for (const ctx of fn.contexts) {
        expect(validContexts).toContain(ctx);
      }
    }
  });
});
