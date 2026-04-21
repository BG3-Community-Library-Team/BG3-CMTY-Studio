// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import LayoutCell from "../components/manual-entry/LayoutCell.svelte";

afterEach(cleanup);

function renderInheritanceField(options?: {
  fieldValue?: string;
  childFields?: Record<string, string>;
  parentFields?: Record<string, string>;
}) {
  let currentValue = options?.fieldValue ?? "";
  const setFieldValue = vi.fn((key: string, value: string) => {
    if (key === "Damage") currentValue = value;
  });

  render(LayoutCell, {
    props: {
      item: { type: "field", key: "Damage", label: "Damage" },
      caps: { fieldTypes: { Damage: "string" } },
      getFieldValue: (key: string) => (key === "Damage" ? currentValue : ""),
      setFieldValue,
      getBoolValue: () => false,
      setBoolValue: () => {},
      fieldComboboxOptions: () => [],
      resolveLocaText: () => undefined,
      generateUuid: () => "test-uuid",
      parentFields: options?.parentFields ?? { Damage: "1d8" },
      childFields: options?.childFields ?? {},
      statType: "SpellData",
    },
  });

  return { setFieldValue };
}

describe("LayoutCell inheritance UX", () => {
  it("shows inherited values read-only until override is enabled", async () => {
    const { setFieldValue } = renderInheritanceField();

    expect(screen.getByText("Inherited")).toBeTruthy();
    expect(screen.getByText("1d8")).toBeTruthy();

    const checkbox = screen.getByRole("checkbox", { name: "Enable override for Damage" }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    await fireEvent.click(checkbox);

    expect(checkbox.checked).toBe(true);
    expect(screen.getByDisplayValue("1d8")).toBeTruthy();

    await fireEvent.input(screen.getByDisplayValue("1d8"), {
      target: { value: "2d6" },
    });

    expect(setFieldValue).toHaveBeenCalledWith("Damage", "2d6");
  });

  it("clears an explicit override when override is disabled", async () => {
    const { setFieldValue } = renderInheritanceField({
      fieldValue: "2d6",
      childFields: { Damage: "2d6" },
    });

    const checkbox = screen.getByRole("checkbox", { name: "Enable override for Damage" }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    await fireEvent.click(checkbox);

    expect(setFieldValue).toHaveBeenCalledWith("Damage", "");
  });
});
