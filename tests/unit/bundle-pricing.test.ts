import { describe, expect, it } from "vitest";
import { applyBundleDiscounts } from "@/server/pricing/bundles";

const bp = {
  home: [{ id: "b1", type: "bundle", productSlugs: ["a", "b"], bundleDiscountPercent: 10 }],
} as never;

const line = (id: string, slug: string, unit: number, qty: number) => ({ p: { id, slug }, unit, total: unit * qty });

describe("bundle discount", () => {
  it("discounts only complete sets, from the blueprint percent", () => {
    const lines = [line("A", "a", 10000, 2), line("B", "b", 5000, 1)];
    applyBundleDiscounts(lines, [
      { productId: "A", qty: 2, bundleId: "b1" },
      { productId: "B", qty: 1, bundleId: "b1" },
    ], bp);
    expect(lines[0]!.total).toBe(20000 - 1000);
    expect(lines[1]!.total).toBe(5000 - 500);
  });

  it("gives nothing for an incomplete set or an unknown bundle", () => {
    const lines = [line("A", "a", 10000, 1)];
    applyBundleDiscounts(lines, [{ productId: "A", qty: 1, bundleId: "b1" }], bp);
    expect(lines[0]!.total).toBe(10000);
    const other = [line("A", "a", 10000, 1), line("B", "b", 5000, 1)];
    applyBundleDiscounts(other, [
      { productId: "A", qty: 1, bundleId: "nope" },
      { productId: "B", qty: 1, bundleId: "nope" },
    ], bp);
    expect(other.map((l) => l.total)).toEqual([10000, 5000]);
  });

  it("ignores items added outside the bundle", () => {
    const lines = [line("A", "a", 10000, 1), line("B", "b", 5000, 1)];
    applyBundleDiscounts(lines, [{ productId: "A", qty: 1 }, { productId: "B", qty: 1 }], bp);
    expect(lines.map((l) => l.total)).toEqual([10000, 5000]);
  });
});
