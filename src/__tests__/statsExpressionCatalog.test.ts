import { describe, it, expect } from "vitest";
import {
  STATS_FUNCTORS,
  STATS_BOOSTS,
  TARGETING_KEYWORDS,
  ROLL_FUNCTIONS,
  DAMAGE_TYPE_ENUM,
  ATTACK_TYPE_ENUM,
  ABILITY_ENUM,
  CONDITION_OPERATORS,
  FUNCTOR_WRAPPER,
} from "../lib/data/statsExpressionCatalog";
import type { StatsExpressionDef } from "../lib/data/statsExpressionCatalog";

function expectNonEmpty(defs: StatsExpressionDef[], label: string) {
  it(`${label} has entries`, () => {
    expect(defs.length).toBeGreaterThan(0);
  });

  it(`${label} entries have non-empty names`, () => {
    for (const d of defs) {
      expect(d.name.length).toBeGreaterThan(0);
    }
  });

  it(`${label} entries have non-empty descriptions`, () => {
    for (const d of defs) {
      expect(d.description.length).toBeGreaterThan(0);
    }
  });

  it(`${label} has no duplicate names`, () => {
    const names = defs.map(d => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
}

describe("Stats Expression Catalog", () => {
  describe("STATS_FUNCTORS", () => {
    expectNonEmpty(STATS_FUNCTORS, "STATS_FUNCTORS");

    it("has at least 30 functors", () => {
      expect(STATS_FUNCTORS.length).toBeGreaterThanOrEqual(30);
    });

    it("includes core functors", () => {
      const names = STATS_FUNCTORS.map(f => f.name);
      expect(names).toContain("DealDamage");
      expect(names).toContain("ApplyStatus");
      expect(names).toContain("RegainHitPoints");
      expect(names).toContain("SavingThrow");
      expect(names).toContain("Force");
      expect(names).toContain("Summon");
      expect(names).toContain("CreateSurface");
      expect(names).toContain("Kill");
    });

    it("DealDamage has params", () => {
      const dd = STATS_FUNCTORS.find(f => f.name === "DealDamage");
      expect(dd?.params).toBeDefined();
      expect(dd!.params).toContain("damage");
    });
  });

  describe("STATS_BOOSTS", () => {
    expectNonEmpty(STATS_BOOSTS, "STATS_BOOSTS");

    it("has at least 35 boosts", () => {
      expect(STATS_BOOSTS.length).toBeGreaterThanOrEqual(35);
    });

    it("includes core boosts", () => {
      const names = STATS_BOOSTS.map(b => b.name);
      expect(names).toContain("AC");
      expect(names).toContain("Ability");
      expect(names).toContain("Resistance");
      expect(names).toContain("Advantage");
      expect(names).toContain("UnlockSpell");
      expect(names).toContain("DamageBonus");
    });
  });

  describe("TARGETING_KEYWORDS", () => {
    expectNonEmpty(TARGETING_KEYWORDS, "TARGETING_KEYWORDS");

    it("includes spell-level targeting", () => {
      const names = TARGETING_KEYWORDS.map(t => t.name);
      expect(names).toContain("TARGET");
      expect(names).toContain("GROUND");
      expect(names).toContain("AOE");
    });

    it("includes functor-level targeting", () => {
      const names = TARGETING_KEYWORDS.map(t => t.name);
      expect(names).toContain("SELF");
      expect(names).toContain("SWAP");
    });

    it("includes interrupt targeting", () => {
      const names = TARGETING_KEYWORDS.map(t => t.name);
      expect(names).toContain("OBSERVER_SOURCE");
      expect(names).toContain("OBSERVER_TARGET");
      expect(names).toContain("OBSERVER_OBSERVER");
    });
  });

  describe("ROLL_FUNCTIONS", () => {
    expectNonEmpty(ROLL_FUNCTIONS, "ROLL_FUNCTIONS");

    it("includes core roll functions", () => {
      const names = ROLL_FUNCTIONS.map(r => r.name);
      expect(names).toContain("Attack");
      expect(names).toContain("SavingThrow");
      expect(names).toContain("SkillCheck");
    });
  });

  describe("Enum catalogs", () => {
    it("DAMAGE_TYPE_ENUM has 13 types", () => {
      expect(DAMAGE_TYPE_ENUM.length).toBe(13);
    });

    it("includes all physical damage types", () => {
      const names = DAMAGE_TYPE_ENUM.map(d => d.name);
      expect(names).toContain("Bludgeoning");
      expect(names).toContain("Piercing");
      expect(names).toContain("Slashing");
    });

    it("ATTACK_TYPE_ENUM has 6 types", () => {
      expect(ATTACK_TYPE_ENUM.length).toBe(6);
    });

    it("all attack types use AttackType. prefix", () => {
      for (const at of ATTACK_TYPE_ENUM) {
        expect(at.name).toMatch(/^AttackType\./);
      }
    });

    it("ABILITY_ENUM has 6 abilities", () => {
      expect(ABILITY_ENUM.length).toBe(6);
    });

    it("all abilities use Ability. prefix", () => {
      for (const ab of ABILITY_ENUM) {
        expect(ab.name).toMatch(/^Ability\./);
      }
    });
  });

  describe("Syntax elements", () => {
    it("CONDITION_OPERATORS has and, or, not", () => {
      const names = CONDITION_OPERATORS.map(o => o.name);
      expect(names).toEqual(["and", "or", "not"]);
    });

    it("FUNCTOR_WRAPPER is IF", () => {
      expect(FUNCTOR_WRAPPER.name).toBe("IF");
      expect(FUNCTOR_WRAPPER.params).toBeDefined();
    });
  });
});
