/**
 * Selector parser tests — Priority 0 coverage for parseRawSelectors.
 * Tests key behavior: basic parsing, param mapping, ReplacePassives normalization,
 * unknown functions, empty input, multi-selector strings.
 */
import { describe, it, expect } from "vitest";
import { parseRawSelectors } from "../lib/utils/selectorParser.js";

describe("parseRawSelectors", () => {
  it("returns empty array for empty/whitespace input", () => {
    expect(parseRawSelectors("")).toEqual([]);
    expect(parseRawSelectors("   ")).toEqual([]);
    expect(parseRawSelectors(null as unknown as string)).toEqual([]);
  });

  it("parses a single SelectSpells selector with positional params", () => {
    const result = parseRawSelectors("SelectSpells(b2c94f10-test-guid,2,Cantrip)");
    expect(result).toHaveLength(1);
    expect(result[0].fn).toBe("SelectSpells");
    expect(result[0].isReplace).toBe(false);
    expect(result[0].params.Guid).toBe("b2c94f10-test-guid");
    expect(result[0].params.Amount).toBe("2");
    expect(result[0].params.SwapAmount).toBe("Cantrip");
  });

  it("parses multiple selectors separated by semicolons", () => {
    const result = parseRawSelectors(
      "SelectSpells(guid1,1,Cantrip);SelectPassives(guid2,3,myId)"
    );
    expect(result).toHaveLength(2);
    expect(result[0].fn).toBe("SelectSpells");
    expect(result[0].params.Guid).toBe("guid1");
    expect(result[1].fn).toBe("SelectPassives");
    expect(result[1].params.Guid).toBe("guid2");
    expect(result[1].params.Amount).toBe("3");
    expect(result[1].params.SelectorId).toBe("myId");
  });

  it("normalizes ReplacePassives to SelectPassives with isReplace=true", () => {
    const result = parseRawSelectors("ReplacePassives(guid1,1,SwarmReplace)");
    expect(result).toHaveLength(1);
    expect(result[0].fn).toBe("SelectPassives");
    expect(result[0].isReplace).toBe(true);
    expect(result[0].params.Guid).toBe("guid1");
    expect(result[0].params.Amount).toBe("1");
    expect(result[0].params.SelectorId).toBe("SwarmReplace");
  });

  it("maps AddSpells params correctly (6 positional fields)", () => {
    const result = parseRawSelectors(
      "AddSpells(spell-guid,my-selector,Wisdom,ActionPoint,Prepared,OncePerShortRest)"
    );
    expect(result).toHaveLength(1);
    expect(result[0].fn).toBe("AddSpells");
    expect(result[0].params.Guid).toBe("spell-guid");
    expect(result[0].params.SelectorId).toBe("my-selector");
    expect(result[0].params.CastingAbility).toBe("Wisdom");
    expect(result[0].params.ActionResource).toBe("ActionPoint");
    expect(result[0].params.PrepareType).toBe("Prepared");
    expect(result[0].params.CooldownType).toBe("OncePerShortRest");
  });

  it("maps SelectSkillsExpertise params including LimitToProficiency", () => {
    const result = parseRawSelectors("SelectSkillsExpertise(guid1,2,true,selectorid)");
    expect(result).toHaveLength(1);
    expect(result[0].params.LimitToProficiency).toBe("true");
    expect(result[0].params.SelectorId).toBe("selectorid");
  });

  it("falls back to Guid/Amount for unknown function names", () => {
    const result = parseRawSelectors("UnknownFunction(some-guid,42)");
    expect(result).toHaveLength(1);
    expect(result[0].fn).toBe("UnknownFunction");
    expect(result[0].params.Guid).toBe("some-guid");
    expect(result[0].params.Amount).toBe("42");
  });

  it("skips malformed selectors without parentheses", () => {
    const result = parseRawSelectors("SelectSpells(guid,1);BadEntry;SelectPassives(guid2,2)");
    expect(result).toHaveLength(2);
    expect(result[0].fn).toBe("SelectSpells");
    expect(result[1].fn).toBe("SelectPassives");
  });

  it("handles selector with no parameters", () => {
    const result = parseRawSelectors("SelectSpells()");
    expect(result).toHaveLength(1);
    expect(result[0].fn).toBe("SelectSpells");
    expect(result[0].params.Guid).toBe("");
  });
});
