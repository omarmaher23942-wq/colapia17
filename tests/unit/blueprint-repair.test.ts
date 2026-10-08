import { describe, it, expect } from "vitest";
import { repairBlueprint } from "@/blueprint/repair";
import { defaultBlueprint } from "@/blueprint/defaults";
import { blueprintSchema } from "@/blueprint/schema";

describe("repairBlueprint", () => {
  const valid = defaultBlueprint({ name: "متجر سارة", storeId: "11111111-1111-4111-8111-111111111111" });

  it("returns a valid blueprint untouched", () => {
    const { blueprint, report } = repairBlueprint(valid, { name: "x" });
    expect(report.repaired).toBe(false);
    expect(blueprint.brand.name).toBe("متجر سارة");
  });

  it("keeps valid sections, drops invalid ones, and always produces a schema-valid result", () => {
    const broken = {
      ...valid,
      home: [...valid.home, { type: "hero", nonsense: true }, { type: "unknown_section" }],
      theme: "not a theme",
    };
    const { blueprint, report } = repairBlueprint(broken, { name: "متجر سارة" });
    expect(report.repaired).toBe(true);
    expect(report.droppedSections).toBe(2);
    expect(report.replacedKeys).toContain("theme");
    expect(blueprint.home.length).toBe(valid.home.length);
    expect(blueprintSchema.safeParse(blueprint).success).toBe(true);
  });

  it("falls back to a full default when the input is garbage", () => {
    const { blueprint } = repairBlueprint(null, { name: "متجري" });
    expect(blueprintSchema.safeParse(blueprint).success).toBe(true);
    expect(blueprint.brand.name).toBe("متجري");
  });
});
