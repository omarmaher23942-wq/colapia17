import { describe, expect, it } from "vitest";
import { fallbackPlan, normalizePlan } from "@/ai/build/plan";
import { allPolicyPages, resolvePolicyPage } from "@/blueprint/policy-pages";
import { blueprintSchema } from "@/blueprint/schema";
import { defaultBlueprint } from "@/blueprint/defaults";

const intake = {
  brief: { storeName: "بيت الجلد", industry: "fashion" },
  products: [
    { name: "شنطة كروس", price: 450, category: "شنط" },
    { name: "محفظة رجالي", price: 200, category: "محافظ" },
    { name: "حزام", price: 150 },
  ],
};

describe("build plan", () => {
  it("returns a complete plan when the model output is missing homeOutline (the crash in production)", () => {
    const plan = normalizePlan({ brandDirection: { name: "x" }, categories: [] }, fallbackPlan(intake));
    expect(plan.homeOutline.length).toBeGreaterThanOrEqual(5);
    expect(plan.brandDirection.name).toBe("بيت الجلد");
    expect(plan.categories.map((c) => c.name)).toEqual(["شنط", "محافظ", "منتجاتنا"]);
  });

  it("unwraps a plan nested under a key and keeps the merchant's store name", () => {
    const plan = normalizePlan(
      {
        plan: {
          brandDirection: { name: "اسم آخر", industry: "fashion", voice: "nope" },
          homeOutline: Array.from({ length: 6 }, () => ({ type: "product_grid", variant: "grid" })),
          categories: [{ name: "شنط", productNames: ["شنطة كروس"] }],
        },
      },
      fallbackPlan(intake)
    );
    expect(plan.brandDirection.name).toBe("بيت الجلد");
    expect(plan.brandDirection.voice).toBe("friendly_egyptian");
    expect(plan.homeOutline).toHaveLength(6);
    expect(plan.categories[0]?.name).toBe("شنط");
  });

  it("falls back on garbage", () => {
    for (const raw of [null, "text", 42, [], { homeOutline: "x" }]) {
      expect(normalizePlan(raw, fallbackPlan(intake)).homeOutline.length).toBeGreaterThan(0);
    }
  });
});

describe("policy pages", () => {
  const bp = blueprintSchema.parse(defaultBlueprint({ name: "بيت الجلد", storeId: "s1" } as never));

  it("always provides shipping, returns, privacy and terms from the store's own policy", () => {
    for (const slug of ["shipping", "returns", "privacy", "terms", "contact", "about"]) {
      const p = resolvePolicyPage(bp, slug);
      expect(p?.body.length, slug).toBeGreaterThan(100);
    }
    expect(resolvePolicyPage(bp, "returns")?.body).toContain(`${bp.returns.windowDays} يوماً`);
  });

  it("prefers the merchant's own page and hides a page the merchant disabled", () => {
    const own = { ...bp, pages: [{ slug: "privacy" as const, title: "خصوصيتي", body: "نص التاجر", enabled: true, showInFooter: true }] };
    expect(resolvePolicyPage(own, "privacy")?.body).toBe("نص التاجر");
    const off = { ...bp, pages: [{ slug: "terms" as const, title: "x", body: "y", enabled: false, showInFooter: true }] };
    expect(resolvePolicyPage(off, "terms")).toBeNull();
    expect(allPolicyPages(off).some((p) => p.slug === "terms")).toBe(false);
  });

  it("states no returns honestly when the window is zero", () => {
    const strict = { ...bp, returns: { ...bp.returns, windowDays: 0 } };
    expect(resolvePolicyPage(strict, "returns")?.body).toContain("لا يتاح الاستبدال");
  });
});
