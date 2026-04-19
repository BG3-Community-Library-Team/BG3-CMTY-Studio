import { describe, it, expect } from "vitest";
import { statsExpressionPlugin, _CATALOG_COUNTS } from "../lib/plugins/statsExpressionPlugin";
import type { CompletionContext } from "../lib/plugins/completionTypes";

function makeCtx(language: string, typedPrefix: string): CompletionContext {
  return {
    lineTextBeforeCursor: typedPrefix,
    fullText: typedPrefix,
    language,
    cursorOffset: typedPrefix.length,
    typedPrefix,
  };
}

describe("statsExpressionPlugin", () => {
  it("has correct id and name", () => {
    expect(statsExpressionPlugin.id).toBe("bg3-stats-expression");
    expect(statsExpressionPlugin.name).toBe("BG3 Stats Expression");
  });

  it("responds to all 5 expression languages", () => {
    expect(statsExpressionPlugin.languages).toContain("expr:condition");
    expect(statsExpressionPlugin.languages).toContain("expr:effect");
    expect(statsExpressionPlugin.languages).toContain("expr:roll");
    expect(statsExpressionPlugin.languages).toContain("expr:cost");
    expect(statsExpressionPlugin.languages).toContain("expr:display");
    expect(statsExpressionPlugin.languages).toHaveLength(5);
  });

  it("has priority lower than default (40)", () => {
    expect(statsExpressionPlugin.priority).toBe(40);
  });

  describe("condition completions", () => {
    it("returns condition functions for prefix 'Has'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:condition", "Has"));
      expect(results.length).toBeGreaterThan(0);
      const labels = results.map(r => r.label);
      expect(labels).toContain("HasStatus");
      expect(labels).toContain("HasPassive");
    });

    it("returns operators for prefix 'an'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:condition", "an"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("and");
    });

    it("returns context accessors for 'context.'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:condition", "context.S"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("context.Source");
    });

    it("returns HitDescription fields for 'context.HitDescription.'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:condition", "context.HitDescription."));
      expect(results.length).toBe(5);
      const labels = results.map(r => r.label);
      expect(labels).toContain("IsCriticalHit");
      expect(labels).toContain("DamageType");
    });

    it("condition items include functions from conditionFunctions catalog", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:condition", "Se"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("Self");
    });

    it("condition completions do NOT include Lua keywords", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:condition", "lo"));
      const labels = results.map(r => r.label);
      expect(labels).not.toContain("local");
    });

    it("functions insert with parens", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:condition", "Has"));
      const hasStatus = results.find(r => r.label === "HasStatus");
      expect(hasStatus?.insertText).toBe("HasStatus()");
    });
  });

  describe("effect completions", () => {
    it("returns functors for prefix 'Deal'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:effect", "Deal"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("DealDamage");
    });

    it("returns boosts for prefix 'Adv'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:effect", "Adv"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("Advantage");
    });

    it("returns targeting keywords for prefix 'TAR'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:effect", "TAR"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("TARGET");
    });

    it("returns IF wrapper for prefix 'IF'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:effect", "IF"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("IF");
    });

    it("returns damage types for prefix 'Fi'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:effect", "Fi"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("Fire");
    });

    it("functors insert with parens", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:effect", "Deal"));
      const dm = results.find(r => r.label === "DealDamage");
      expect(dm?.insertText).toBe("DealDamage()");
    });

    it("targeting keywords do NOT insert parens", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:effect", "TAR"));
      const target = results.find(r => r.label === "TARGET");
      expect(target?.insertText).toBe("TARGET");
    });
  });

  describe("roll completions", () => {
    it("returns roll functions for prefix 'At'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:roll", "At"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("Attack");
    });

    it("returns attack type enums for prefix 'AttackType.'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:roll", "AttackType.M"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("AttackType.MeleeWeaponAttack");
      expect(labels).toContain("AttackType.MeleeSpellAttack");
    });

    it("returns ability enums for prefix 'Ability.'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:roll", "Ability.S"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("Ability.Strength");
    });
  });

  describe("cost completions", () => {
    it("returns resources for prefix 'Ac'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:cost", "Ac"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("ActionPoint");
    });

    it("returns SpellSlot for prefix 'Sp'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:cost", "Sp"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("SpellSlot");
    });

    it("resources do NOT insert parens", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:cost", "Ac"));
      const ap = results.find(r => r.label === "ActionPoint");
      expect(ap?.insertText).toBe("ActionPoint");
    });
  });

  describe("display completions", () => {
    it("returns functors for prefix 'Deal'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:display", "Deal"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("DealDamage");
    });

    it("returns damage types for prefix 'Ra'", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:display", "Ra"));
      const labels = results.map(r => r.label);
      expect(labels).toContain("Radiant");
    });
  });

  describe("prefix rules", () => {
    it("returns nothing for prefix shorter than 2 chars", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:effect", "D"));
      expect(results).toHaveLength(0);
    });

    it("returns nothing for empty prefix", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:effect", ""));
      expect(results).toHaveLength(0);
    });

    it("returns nothing for unknown language", () => {
      const results = statsExpressionPlugin.getCompletions(makeCtx("expr:unknown", "Deal"));
      expect(results).toHaveLength(0);
    });
  });

  describe("catalog counts", () => {
    it("condition items include condition functions + operators + context accessors", () => {
      expect(_CATALOG_COUNTS.condition).toBeGreaterThan(31);
    });

    it("effect items include functors + boosts + targeting + wrapper + damage types + operators", () => {
      expect(_CATALOG_COUNTS.effect).toBeGreaterThan(80);
    });

    it("cost items match COST_RESOURCES count", () => {
      expect(_CATALOG_COUNTS.cost).toBe(20);
    });
  });
});
