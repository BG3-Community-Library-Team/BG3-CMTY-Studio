// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import InheritanceBanner from "../components/InheritanceBanner.svelte";

afterEach(cleanup);

function renderBanner(
  overrides: Partial<{
    parentName: string;
    parentFields: Record<string, string>;
    childFields: Record<string, string>;
  }> = {},
) {
  const onClearInheritance = vi.fn();

  render(InheritanceBanner, {
    props: {
      parentName: overrides.parentName ?? "Target_MainHandAttack",
      parentFields: overrides.parentFields ?? {
        Damage: "1d8",
        Level: "1",
        SpellType: "Target",
      },
      childFields: overrides.childFields ?? {
        Using: "Target_MainHandAttack",
        Damage: "2d6",
        Icon: "Spell_Fire",
      },
      onClearInheritance,
    },
  });

  return { onClearInheritance };
}

describe("InheritanceBanner", () => {
  it("renders the parent name and computed inheritance counts", () => {
    renderBanner();

    expect(screen.getByText("Target_MainHandAttack")).toBeTruthy();
    expect(screen.getByLabelText("2 inherited fields")).toBeTruthy();
    expect(screen.getByLabelText("1 overridden fields")).toBeTruthy();
    expect(screen.getByLabelText("1 new fields")).toBeTruthy();
  });

  it("does not count Using as a new child field", () => {
    renderBanner({
      parentFields: {},
      childFields: {
        Using: "_BaseWeapon",
        RootTemplate: "WPN_Shortsword_A",
      },
    });

    expect(screen.getByLabelText("0 inherited fields")).toBeTruthy();
    expect(screen.getByLabelText("0 overridden fields")).toBeTruthy();
    expect(screen.getByLabelText("1 new fields")).toBeTruthy();
  });

  it("calls the action handlers when buttons are clicked", async () => {
    const { onClearInheritance } = renderBanner();

    await fireEvent.click(screen.getByRole("button", { name: "Clear Inheritance" }));

    expect(onClearInheritance).toHaveBeenCalledOnce();
  });
});